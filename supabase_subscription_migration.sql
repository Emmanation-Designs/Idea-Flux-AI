-- ============================================================================
-- Trelvix AI - Monthly Subscription Limits & Character Allowance Migration
-- Description: Extends the database schema to support professional, tiered
--              monthly character limits for Text-to-Speech (and future AI tools).
-- Target Environment: Supabase / PostgreSQL
-- ============================================================================

-- 1. Extend public.tts_plan_limits to support monthly character limits
ALTER TABLE public.tts_plan_limits 
ADD COLUMN IF NOT EXISTS monthly_character_allowance INT NOT NULL DEFAULT 10000;

-- 2. Extend public.profiles to track character usage and reset schedules
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tts_characters_used INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS tts_reset_date TIMESTAMPTZ;

-- Update existing profiles that have null reset dates to default to 1 month from now
UPDATE public.profiles 
SET tts_reset_date = NOW() + INTERVAL '1 month'
WHERE tts_reset_date IS NULL;

-- 3. Seed/Update Tier Limits
-- Free: 10,000 char allowance, 2,000 max per generation
-- Pro: 500,000 char allowance, 20,000 max per generation
-- Plus: 2,000,000 char allowance, 100,000 max per generation
INSERT INTO public.tts_plan_limits (plan_name, max_generations_per_day, max_characters_per_generation, unlimited_generations, enabled, monthly_character_allowance)
VALUES 
    ('free', NULL, 2000, TRUE, TRUE, 10000),
    ('pro', NULL, 20000, TRUE, TRUE, 500000),
    ('plus', NULL, 100000, TRUE, TRUE, 2000000)
ON CONFLICT (plan_name) 
DO UPDATE SET 
    max_characters_per_generation = EXCLUDED.max_characters_per_generation,
    monthly_character_allowance = EXCLUDED.monthly_character_allowance,
    unlimited_generations = EXCLUDED.unlimited_generations,
    updated_at = NOW();

-- 4. Lazy Monthly Reset Logic Helper
-- Resets the user's monthly character counter if the reset date has passed.
CREATE OR REPLACE FUNCTION public.check_and_reset_tts_monthly(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
    v_reset_date TIMESTAMPTZ;
BEGIN
    SELECT tts_reset_date INTO v_reset_date
    FROM public.profiles
    WHERE id = user_uuid;

    -- If reset date has passed (or is NULL), reset characters_used and advance reset date
    IF v_reset_date IS NULL OR NOW() >= v_reset_date THEN
        UPDATE public.profiles
        SET tts_characters_used = 0,
            tts_reset_date = COALESCE(v_reset_date, NOW()) + INTERVAL '1 month'
        WHERE id = user_uuid;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Helper function: Fetch current usage and limits (with automatic lazy reset)
CREATE OR REPLACE FUNCTION public.get_monthly_tts_usage(user_uuid UUID)
RETURNS TABLE (
    characters_used INT,
    monthly_allowance INT,
    remaining_characters INT,
    max_characters_per_generation INT,
    reset_date TIMESTAMPTZ,
    current_plan TEXT
) AS $$
DECLARE
    v_plan TEXT;
    v_characters_used INT;
    v_reset_date TIMESTAMPTZ;
    v_monthly_allowance INT;
    v_max_char_per_gen INT;
BEGIN
    -- Perform lazy reset first
    PERFORM public.check_and_reset_tts_monthly(user_uuid);

    -- Identify plan and usage
    SELECT COALESCE(plan, 'free'), COALESCE(tts_characters_used, 0), tts_reset_date
    INTO v_plan, v_characters_used, v_reset_date
    FROM public.profiles
    WHERE id = user_uuid;

    IF v_plan IS NULL THEN
        v_plan := 'free';
    END IF;

    -- Fetch limit metadata for the plan
    SELECT monthly_character_allowance, max_characters_per_generation
    INTO v_monthly_allowance, v_max_char_per_gen
    FROM public.tts_plan_limits
    WHERE plan_name = v_plan AND enabled = TRUE;

    -- Fallback safety check
    IF NOT FOUND THEN
        v_monthly_allowance := 10000;
        v_max_char_per_gen := 2000;
    END IF;

    characters_used := v_characters_used;
    monthly_allowance := v_monthly_allowance;
    remaining_characters := GREATEST(0, v_monthly_allowance - v_characters_used);
    max_characters_per_generation := v_max_char_per_gen;
    reset_date := v_reset_date;
    current_plan := v_plan;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Helper function: Authorization check before generating TTS
CREATE OR REPLACE FUNCTION public.can_generate_tts_monthly(
    user_uuid UUID,
    requested_character_count INT
)
RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT,
    characters_used INT,
    monthly_allowance INT,
    remaining_characters INT,
    max_characters_per_generation INT,
    reset_date TIMESTAMPTZ,
    current_plan TEXT
) AS $$
DECLARE
    v_plan TEXT;
    v_characters_used INT;
    v_reset_date TIMESTAMPTZ;
    v_monthly_allowance INT;
    v_max_char_per_gen INT;
BEGIN
    -- Perform lazy reset
    PERFORM public.check_and_reset_tts_monthly(user_uuid);

    -- Identify plan and usage
    SELECT COALESCE(plan, 'free'), COALESCE(tts_characters_used, 0), tts_reset_date
    INTO v_plan, v_characters_used, v_reset_date
    FROM public.profiles
    WHERE id = user_uuid;

    IF v_plan IS NULL THEN
        v_plan := 'free';
    END IF;

    -- Fetch plan limits
    SELECT monthly_character_allowance, max_characters_per_generation
    INTO v_monthly_allowance, v_max_char_per_gen
    FROM public.tts_plan_limits
    WHERE plan_name = v_plan AND enabled = TRUE;

    IF NOT FOUND THEN
        v_monthly_allowance := 10000;
        v_max_char_per_gen := 2000;
    END IF;

    -- Check limits
    IF requested_character_count > v_max_char_per_gen THEN
        allowed := FALSE;
        reason := FORMAT('Requested length of %s characters exceeds the maximum limit of %s characters per generation on your %s plan.', 
                         requested_character_count, v_max_char_per_gen, UPPER(v_plan));
    ELSIF v_characters_used + requested_character_count > v_monthly_allowance THEN
        allowed := FALSE;
        reason := FORMAT('Monthly character allowance exhausted. Generation requires %s characters, but you only have %s remaining on your %s plan. Upgrade your plan to continue generating speech.', 
                         requested_character_count, GREATEST(0, v_monthly_allowance - v_characters_used), UPPER(v_plan));
    ELSE
        allowed := TRUE;
        reason := 'Authorized.';
    END IF;

    characters_used := v_characters_used;
    monthly_allowance := v_monthly_allowance;
    remaining_characters := GREATEST(0, v_monthly_allowance - v_characters_used);
    max_characters_per_generation := v_max_char_per_gen;
    reset_date := v_reset_date;
    current_plan := v_plan;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
