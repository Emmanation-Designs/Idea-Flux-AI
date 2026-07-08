-- ============================================================================
-- Trelvix AI - Text-to-Speech (TTS) Migration Script
-- Description: Migration to support robust, multi-tier TTS usage tracking,
--              flexible limit controls, database-level security policies,
--              and future scalability for enterprise and team scopes.
-- Target Environment: Supabase / PostgreSQL 14+
-- ============================================================================

-- 1. CLEANUP (IF RERUNNING MIGRATION)
-- Safe cleanup to ensure clean state on initialization.
-- Note: Dropping a trigger on a non-existent table throws an error in PostgreSQL.
-- We wrap this in a safe conditional block to check table existence first.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'tts_plan_limits'
    ) THEN
        DROP TRIGGER IF EXISTS set_tts_plan_limits_updated_at ON public.tts_plan_limits;
    END IF;
END $$;

DROP FUNCTION IF EXISTS public.can_generate_tts(UUID, INT);
DROP FUNCTION IF EXISTS public.get_today_tts_usage(UUID);
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- ============================================================================
-- 2. SCHEMAS & TABLES
-- ============================================================================

-- Create Configuration Table for Subscription Limits
CREATE TABLE IF NOT EXISTS public.tts_plan_limits (
    plan_name TEXT PRIMARY KEY,
    max_generations_per_day INT NULL, -- NULL or negative denotes unlimited
    max_characters_per_generation INT NOT NULL,
    unlimited_generations BOOLEAN DEFAULT FALSE NOT NULL,
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.tts_plan_limits IS 'Stores dynamic per-subscription plan limitations for Text-to-Speech generation.';
COMMENT ON COLUMN public.tts_plan_limits.plan_name IS 'Primary Key. Matches plan values from public.profiles (e.g., free, pro, plus).';
COMMENT ON COLUMN public.tts_plan_limits.max_generations_per_day IS 'Maximum allowed TTS generation requests within a single UTC calendar day.';
COMMENT ON COLUMN public.tts_plan_limits.max_characters_per_generation IS 'Hard limit on character count allowed in a single request.';
COMMENT ON COLUMN public.tts_plan_limits.unlimited_generations IS 'Flag indicating bypass of daily count checks.';

-- Create Generations Logs Table with extensive fields for usage tracing & performance auditing
CREATE TABLE IF NOT EXISTS public.tts_generations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    character_count INT NOT NULL CHECK (character_count > 0),
    selected_voice TEXT NOT NULL,
    selected_model TEXT NOT NULL,
    generation_status TEXT DEFAULT 'pending' NOT NULL CHECK (generation_status IN ('pending', 'completed', 'failed')),
    generation_time_ms INT NULL,
    audio_duration_seconds NUMERIC(8,2) NULL,
    download_count INT DEFAULT 0 NOT NULL,
    file_size_bytes BIGINT NULL,
    
    -- Future Scalability Columns
    provider TEXT DEFAULT 'openai' NOT NULL, -- 'openai', 'elevenlabs', 'google_tts', etc.
    language_code TEXT NULL, -- e.g., 'en-US', 'es-ES'
    voice_id TEXT NULL, -- For custom voice cloning or API IDs
    team_id UUID NULL, -- For corporate/team account shared tracking
    metadata JSONB DEFAULT '{}'::jsonb NULL
);

COMMENT ON TABLE public.tts_generations IS 'Audit logs of all Text-to-Speech requests utilized for billing, analysis, and usage checking.';
COMMENT ON COLUMN public.tts_generations.character_count IS 'Total characters requested for generation. Multi-byte safe measurement.';
COMMENT ON COLUMN public.tts_generations.provider IS 'Synthesizer service used. Ensures seamless migration to multi-provider pipelines.';
COMMENT ON COLUMN public.tts_generations.team_id IS 'Enables shared usage quotas across team hierarchies in future updates.';

-- ============================================================================
-- 3. INDEX OPTIMIZATIONS
-- ============================================================================

-- B-Tree Index for general lookup of a user's generations
CREATE INDEX IF NOT EXISTS tts_generations_user_id_idx 
ON public.tts_generations (user_id);

-- B-Tree Index for temporal analytics and cleaning routines
CREATE INDEX IF NOT EXISTS tts_generations_created_at_idx 
ON public.tts_generations (created_at DESC);

-- Highly Optimized Composite Index for ultra-fast daily usage evaluation checks
CREATE INDEX IF NOT EXISTS tts_generations_user_created_status_idx 
ON public.tts_generations (user_id, created_at DESC, generation_status);

-- Filter Index for system diagnostics on failed/stuck requests
CREATE INDEX IF NOT EXISTS tts_generations_status_idx 
ON public.tts_generations (generation_status) 
WHERE generation_status != 'completed';

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE public.tts_plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tts_generations ENABLE ROW LEVEL SECURITY;

-- Plan Limits: Anyone authenticated can read limits configuration, modifications restricted
CREATE POLICY "Allow read access to authenticated users" 
ON public.tts_plan_limits 
FOR SELECT 
TO authenticated 
USING (true);

-- Generations: Users can select and view only their own logs
CREATE POLICY "Users can select own tts generations" 
ON public.tts_generations 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Generations: Users can insert logs associated with their own accounts
CREATE POLICY "Users can insert own tts generations" 
ON public.tts_generations 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Note: No UPDATE or DELETE policies are granted to authenticated/public roles.
-- Consequently, only the privileged 'service_role' (bypassing RLS) can alter or purge logs.

-- ============================================================================
-- 5. TRIGGER ENGINES
-- ============================================================================

-- Standard function to keep updated_at timestamps current
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind update trigger to plan limits configuration table
CREATE TRIGGER set_tts_plan_limits_updated_at
BEFORE UPDATE ON public.tts_plan_limits
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 6. SEED DATA
-- ============================================================================

-- Populate default plan rules for TTS tracking
INSERT INTO public.tts_plan_limits (plan_name, max_generations_per_day, max_characters_per_generation, unlimited_generations, enabled)
VALUES 
    ('free', 3, 2000, FALSE, TRUE),
    ('pro', NULL, 10000, TRUE, TRUE),
    ('plus', NULL, 50000, TRUE, TRUE)
ON CONFLICT (plan_name) 
DO UPDATE SET 
    max_generations_per_day = EXCLUDED.max_generations_per_day,
    max_characters_per_generation = EXCLUDED.max_characters_per_generation,
    unlimited_generations = EXCLUDED.unlimited_generations,
    enabled = EXCLUDED.enabled,
    updated_at = NOW();

-- ============================================================================
-- 7. HELPER FUNCTIONS (API INTERFACE)
-- ============================================================================

-- Helper 1: Retrieve detailed usage stats for a user on the current UTC calendar day
CREATE OR REPLACE FUNCTION public.get_today_tts_usage(user_uuid UUID)
RETURNS TABLE (
    generations_today INT,
    characters_today INT,
    remaining_generations INT,
    remaining_characters INT,
    current_plan TEXT
) AS $$
DECLARE
    v_plan TEXT;
    v_generations_today INT;
    v_characters_today INT;
    v_max_gen INT;
    v_max_char INT;
    v_unlimited BOOLEAN;
BEGIN
    -- 1. Identify user's active membership tier
    SELECT COALESCE(plan, 'free') INTO v_plan
    FROM public.profiles
    WHERE id = user_uuid;
    
    IF v_plan IS NULL THEN
        v_plan := 'free';
    END IF;

    -- 2. Fetch limit metadata for the plan
    SELECT max_generations_per_day, max_characters_per_generation, unlimited_generations
    INTO v_max_gen, v_max_char, v_unlimited
    FROM public.tts_plan_limits
    WHERE plan_name = v_plan AND enabled = TRUE;

    -- Fallback safety check if a plan row is absent
    IF NOT FOUND THEN
        v_max_gen := 3;
        v_max_char := 2000;
        v_unlimited := FALSE;
    END IF;

    -- 3. Calculate current day's performance (exclude failed records)
    SELECT COALESCE(COUNT(*), 0)::INT, COALESCE(SUM(character_count), 0)::INT
    INTO v_generations_today, v_characters_today
    FROM public.tts_generations
    WHERE user_id = user_uuid 
      AND created_at >= CURRENT_DATE 
      AND generation_status != 'failed';

    -- 4. Formulate response variables
    IF v_unlimited THEN
        remaining_generations := -1; -- Standard convention for infinite/unrestricted
    ELSE
        remaining_generations := GREATEST(0, v_max_gen - v_generations_today);
    END IF;

    -- Return the maximum character limit allowed per generation under current plan
    remaining_characters := v_max_char;
    generations_today := v_generations_today;
    characters_today := v_characters_today;
    current_plan := v_plan;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper 2: Validation query executed by APIs before processing TTS generations
CREATE OR REPLACE FUNCTION public.can_generate_tts(
    user_uuid UUID,
    requested_character_count INT
)
RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT,
    current_usage JSONB,
    remaining_usage JSONB
) AS $$
DECLARE
    v_plan TEXT;
    v_generations_today INT;
    v_characters_today INT;
    v_max_gen INT;
    v_max_char INT;
    v_unlimited BOOLEAN;
BEGIN
    -- 1. Determine active plan tier
    SELECT COALESCE(plan, 'free') INTO v_plan
    FROM public.profiles
    WHERE id = user_uuid;
    
    IF v_plan IS NULL THEN
        v_plan := 'free';
    END IF;

    -- 2. Fetch specific plan controls
    SELECT max_generations_per_day, max_characters_per_generation, unlimited_generations
    INTO v_max_gen, v_max_char, v_unlimited
    FROM public.tts_plan_limits
    WHERE plan_name = v_plan AND enabled = TRUE;

    -- Fallback rule
    IF NOT FOUND THEN
        v_max_gen := 3;
        v_max_char := 2000;
        v_unlimited := FALSE;
    END IF;

    -- 3. Accumulate active usage records from the current UTC day
    SELECT COALESCE(COUNT(*), 0)::INT, COALESCE(SUM(character_count), 0)::INT
    INTO v_generations_today, v_characters_today
    FROM public.tts_generations
    WHERE user_id = user_uuid 
      AND created_at >= CURRENT_DATE 
      AND generation_status != 'failed';

    -- 4. Apply validation conditions
    IF requested_character_count > v_max_char THEN
        allowed := FALSE;
        reason := FORMAT('Requested length of %s characters exceeds the limit of %s per generation on your %s subscription.', 
                         requested_character_count, v_max_char, UPPER(v_plan));
                         
    ELSIF NOT v_unlimited AND v_generations_today >= v_max_gen THEN
        allowed := FALSE;
        reason := FORMAT('Daily generation threshold (%s requests) reached on your %s subscription tier.', 
                         v_max_gen, UPPER(v_plan));
    ELSE
        allowed := TRUE;
        reason := 'Authorization successful. Request is within the subscription tier quotas.';
    END IF;

    -- 5. Build dynamic tracking paylods
    current_usage := JSONB_BUILD_OBJECT(
        'plan', v_plan,
        'generations_today', v_generations_today,
        'characters_today', v_characters_today
    );

    remaining_usage := JSONB_BUILD_OBJECT(
        'remaining_generations', CASE WHEN v_unlimited THEN -1 ELSE GREATEST(0, v_max_gen - v_generations_today) END,
        'max_characters_per_generation', v_max_char
    );

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
