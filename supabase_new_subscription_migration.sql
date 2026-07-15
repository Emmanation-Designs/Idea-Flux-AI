-- ============================================================================
-- Trelvix AI - Clean Subscription Engine & Centralized Limit Migration
-- Description: Completely replaces old tiered limit architecture with a generic,
--              scalable subscription, usage tracking, and centralized limit engine.
-- Target Environment: Supabase / PostgreSQL 14+
-- ============================================================================

-- 1. CLEANUP OLD LIMIT TABLES & LEGACY FUNCTIONS
DROP TRIGGER IF EXISTS set_tts_plan_limits_updated_at ON public.tts_plan_limits;
DROP TABLE IF EXISTS public.tts_plan_limits CASCADE;
DROP FUNCTION IF EXISTS public.can_generate_tts_monthly(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS public.can_generate_tts(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_today_tts_usage(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_monthly_tts_usage(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.check_and_reset_tts_monthly(UUID) CASCADE;

-- 2. EXTEND public.profiles FOR SCALE-FREE SUBSCRIPTIONS
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_plan TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_provider TEXT,
ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS country_code TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Migrate existing plan data safely
UPDATE public.profiles 
SET current_plan = COALESCE(plan, 'free')
WHERE current_plan IS NULL;

-- 3. CREATE DYNAMIC PLAN LIMITS TABLE
CREATE TABLE IF NOT EXISTS public.plan_limits (
    plan_name TEXT PRIMARY KEY, -- 'free', 'plus', 'pro'
    chat_limit INT NOT NULL,
    image_generation_limit INT NOT NULL,
    image_edit_limit INT NOT NULL,
    image_analysis_limit INT NOT NULL,
    document_ai_limit INT NOT NULL,
    pdf_limit INT NOT NULL,
    ocr_limit INT NOT NULL,
    tts_monthly_limit INT NOT NULL,
    tts_max_chars INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.plan_limits IS 'Dynamic table for centralizing limits across different tiers.';

-- Seed plan limits data
INSERT INTO public.plan_limits (plan_name, chat_limit, image_generation_limit, image_edit_limit, image_analysis_limit, document_ai_limit, pdf_limit, ocr_limit, tts_monthly_limit, tts_max_chars)
VALUES 
    ('free', 10, 3, 2, 2, 2, 2, 2, 10000, 2000),
    ('plus', 100, 20, 15, 15, 10, 10, 10, 500000, 20000),
    ('pro', 1000, 100, 50, 50, 30, 30, 30, 2000000, 100000)
ON CONFLICT (plan_name) 
DO UPDATE SET 
    chat_limit = EXCLUDED.chat_limit,
    image_generation_limit = EXCLUDED.image_generation_limit,
    image_edit_limit = EXCLUDED.image_edit_limit,
    image_analysis_limit = EXCLUDED.image_analysis_limit,
    document_ai_limit = EXCLUDED.document_ai_limit,
    pdf_limit = EXCLUDED.pdf_limit,
    ocr_limit = EXCLUDED.ocr_limit,
    tts_monthly_limit = EXCLUDED.tts_monthly_limit,
    tts_max_chars = EXCLUDED.tts_max_chars,
    updated_at = NOW();

-- 4. CREATE SYSTEMATIC DAILY & MONTHLY USAGE TRACKING TABLE
CREATE TABLE IF NOT EXISTS public.user_usage_tracking (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    chat_today INT DEFAULT 0 NOT NULL CHECK (chat_today >= 0),
    image_generation_today INT DEFAULT 0 NOT NULL CHECK (image_generation_today >= 0),
    image_edit_today INT DEFAULT 0 NOT NULL CHECK (image_edit_today >= 0),
    image_analysis_today INT DEFAULT 0 NOT NULL CHECK (image_analysis_today >= 0),
    document_ai_today INT DEFAULT 0 NOT NULL CHECK (document_ai_today >= 0),
    pdf_today INT DEFAULT 0 NOT NULL CHECK (pdf_today >= 0),
    ocr_today INT DEFAULT 0 NOT NULL CHECK (ocr_today >= 0),
    tts_characters_used_monthly INT DEFAULT 0 NOT NULL CHECK (tts_characters_used_monthly >= 0),
    last_daily_reset TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_monthly_reset TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    rewarded_bonus JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.user_usage_tracking IS 'Tracks user active usage counts, resettable lazily on demand.';

-- Migrate existing profiles to usage tracking table
INSERT INTO public.user_usage_tracking (user_id, tts_characters_used_monthly, last_monthly_reset)
SELECT 
    id, 
    COALESCE(tts_characters_used, 0),
    COALESCE(tts_reset_date, NOW())
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- 5. TRIGGER FOR AUTOMATIC UPDATED_AT ON PLAN LIMITS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_plan_limits_updated_at'
    ) THEN
        CREATE TRIGGER set_plan_limits_updated_at
        BEFORE UPDATE ON public.plan_limits
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;

-- 6. ROW LEVEL SECURITY & EXPLICIT POLICIES
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies if they exist before recreating
DROP POLICY IF EXISTS "Allow read access to plan_limits for authenticated" ON public.plan_limits;
DROP POLICY IF EXISTS "Allow read access to user_usage_tracking for owner" ON public.user_usage_tracking;

CREATE POLICY "Allow read access to plan_limits for authenticated" 
ON public.plan_limits FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to user_usage_tracking for owner" 
ON public.user_usage_tracking FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 7. RE-IMPLEMENT COMPATIBILITY RPC get_monthly_tts_usage
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
    v_last_monthly_reset TIMESTAMPTZ;
    v_monthly_allowance INT;
    v_max_char_per_gen INT;
BEGIN
    -- Ensure usage tracking row exists
    INSERT INTO public.user_usage_tracking (user_id)
    VALUES (user_uuid)
    ON CONFLICT (user_id) DO NOTHING;

    -- 1. Identify user's active membership plan
    SELECT COALESCE(current_plan, 'free') INTO v_plan
    FROM public.profiles
    WHERE id = user_uuid;
    
    IF v_plan IS NULL THEN
        v_plan := 'free';
    END IF;

    -- 2. Retrieve limits
    SELECT tts_monthly_limit, tts_max_chars
    INTO v_monthly_allowance, v_max_char_per_gen
    FROM public.plan_limits
    WHERE plan_name = v_plan;

    IF NOT FOUND THEN
        v_monthly_allowance := 10000;
        v_max_char_per_gen := 2000;
    END IF;

    -- 3. Retrieve and perform lazy reset of monthly usage if needed
    SELECT tts_characters_used_monthly, last_monthly_reset
    INTO v_characters_used, v_last_monthly_reset
    FROM public.user_usage_tracking
    WHERE user_id = user_uuid;

    IF v_last_monthly_reset IS NULL OR NOW() >= v_last_monthly_reset + INTERVAL '1 month' THEN
        UPDATE public.user_usage_tracking
        SET tts_characters_used_monthly = 0,
            last_monthly_reset = NOW()
        WHERE user_id = user_uuid;
        v_characters_used := 0;
        v_last_monthly_reset := NOW();
    END IF;

    characters_used := v_characters_used;
    monthly_allowance := v_monthly_allowance;
    remaining_characters := GREATEST(0, v_monthly_allowance - v_characters_used);
    max_characters_per_generation := v_max_char_per_gen;
    reset_date := v_last_monthly_reset + INTERVAL '1 month';
    current_plan := v_plan;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. ATOMIC FIELD INCREMENT HELPER
CREATE OR REPLACE FUNCTION public.increment_usage_field(
    user_uuid UUID,
    field_name TEXT,
    increment_by INT
)
RETURNS VOID AS $$
BEGIN
    EXECUTE FORMAT('
        UPDATE public.user_usage_tracking 
        SET %I = %I + %L,
            updated_at = NOW()
        WHERE user_id = %L', 
        field_name, field_name, increment_by, user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
