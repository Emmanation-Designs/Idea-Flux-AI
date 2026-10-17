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
    daily_ai_capacity_used INT DEFAULT 0 NOT NULL CHECK (daily_ai_capacity_used >= 0),
    last_capacity_reset TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    tts_characters_used_monthly INT DEFAULT 0 NOT NULL CHECK (tts_characters_used_monthly >= 0),
    last_daily_reset TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_monthly_reset TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    rewarded_bonus JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Ensure columns exist if table was already created
ALTER TABLE public.user_usage_tracking ADD COLUMN IF NOT EXISTS daily_ai_capacity_used INT DEFAULT 0 NOT NULL CHECK (daily_ai_capacity_used >= 0);
ALTER TABLE public.user_usage_tracking ADD COLUMN IF NOT EXISTS last_capacity_reset TIMESTAMPTZ DEFAULT NOW() NOT NULL;

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
    -- Strict caller authorization: service_role or authenticated user matching user_uuid
    IF (auth.jwt() ->> 'role') <> 'service_role' AND auth.role() <> 'service_role' THEN
        IF auth.uid() IS NULL OR auth.uid() <> user_uuid THEN
            RAISE EXCEPTION 'Unauthorized: Caller may only view own TTS usage.';
        END IF;
    END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_monthly_tts_usage(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_monthly_tts_usage(UUID) TO service_role, authenticated;

-- 8. HARDENED ATOMIC USAGE & CAPACITY INFRASTRUCTURE
-- A. Reservation & Idempotent Refund Tracking Table
CREATE TABLE IF NOT EXISTS public.capacity_reservations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_id TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature TEXT NOT NULL,
    cost INT NOT NULL CHECK (cost > 0),
    status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'completed', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS capacity_reservations_user_idx ON public.capacity_reservations(user_id, status);
CREATE INDEX IF NOT EXISTS capacity_reservations_resid_idx ON public.capacity_reservations(reservation_id);

ALTER TABLE public.capacity_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages capacity reservations" ON public.capacity_reservations;
CREATE POLICY "Service role manages capacity reservations" ON public.capacity_reservations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users view own capacity reservations" ON public.capacity_reservations;
CREATE POLICY "Users view own capacity reservations" ON public.capacity_reservations
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- B. Hardened increment_usage_field with explicit allowlists and fixed search_path
CREATE OR REPLACE FUNCTION public.increment_usage_field(
    user_uuid UUID,
    field_name TEXT,
    increment_by INT
)
RETURNS VOID AS $$
BEGIN
    -- 1. Input validation: only allow strictly positive increments (use refund functions for decrements)
    IF increment_by <= 0 THEN
        RAISE EXCEPTION 'increment_by must be greater than zero. Use dedicated refund RPCs for refunds.';
    END IF;

    -- 2. Strict caller authorization: service_role or authenticated user matching user_uuid
    IF (auth.jwt() ->> 'role') <> 'service_role' AND auth.role() <> 'service_role' THEN
        IF auth.uid() IS NULL OR auth.uid() <> user_uuid THEN
            RAISE EXCEPTION 'Unauthorized: Caller may only update own usage tracking.';
        END IF;
    END IF;

    -- 3. Explicit strict column allowlist to eliminate SQL injection and arbitrary column modification
    IF field_name NOT IN (
        'chat_today',
        'image_generation_today',
        'image_edit_today',
        'image_analysis_today',
        'document_ai_today',
        'pdf_today',
        'ocr_today',
        'daily_ai_capacity_used',
        'tts_characters_used_monthly'
    ) THEN
        RAISE EXCEPTION 'Invalid field_name: % is not an allowed usage tracking counter.', field_name;
    END IF;

    -- Ensure usage tracking row exists
    INSERT INTO public.user_usage_tracking (user_id)
    VALUES (user_uuid)
    ON CONFLICT (user_id) DO NOTHING;

    -- 4. Safe dynamic SQL execution with fixed search_path
    EXECUTE FORMAT('
        UPDATE public.user_usage_tracking 
        SET %I = %I + %L,
            updated_at = NOW()
        WHERE user_id = %L', 
        field_name, field_name, increment_by, user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.increment_usage_field(UUID, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_usage_field(UUID, TEXT, INT) TO service_role, authenticated;

-- C. Atomic Capacity Reservation RPC (Checks limits & reserves in a single transaction)
CREATE OR REPLACE FUNCTION public.reserve_ai_capacity(
    p_user_id UUID,
    p_cost INT,
    p_feature TEXT DEFAULT 'general',
    p_reservation_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_plan TEXT;
    v_total_capacity INT;
    v_used INT;
    v_bonus INT;
    v_limit INT;
    v_last_capacity_reset TIMESTAMPTZ;
    v_res_id TEXT;
BEGIN
    IF p_cost <= 0 THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Cost must be positive', 'code', 'INVALID_COST');
    END IF;

    -- Strict authorization check: caller must be service_role or authenticated matching target user
    IF (auth.jwt() ->> 'role') <> 'service_role' AND auth.role() <> 'service_role' THEN
        IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'Unauthorized: caller identity does not match target user', 'code', 'UNAUTHORIZED');
        END IF;
    END IF;

    -- Ensure row exists and lock FOR UPDATE to eliminate concurrency race conditions
    INSERT INTO public.user_usage_tracking (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT daily_ai_capacity_used, last_capacity_reset, COALESCE((rewarded_bonus->>'ai_capacity')::INT, 0)
    INTO v_used, v_last_capacity_reset, v_bonus
    FROM public.user_usage_tracking
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Daily lazy reset check (UTC midnight)
    IF v_last_capacity_reset IS NULL OR (v_last_capacity_reset AT TIME ZONE 'UTC')::DATE < (NOW() AT TIME ZONE 'UTC')::DATE THEN
        UPDATE public.user_usage_tracking
        SET daily_ai_capacity_used = 0,
            chat_today = 0,
            image_generation_today = 0,
            image_edit_today = 0,
            image_analysis_today = 0,
            document_ai_today = 0,
            pdf_today = 0,
            ocr_today = 0,
            rewarded_bonus = '{}'::jsonb,
            last_daily_reset = NOW(),
            last_capacity_reset = NOW(),
            updated_at = NOW()
        WHERE user_id = p_user_id;

        v_used := 0;
        v_bonus := 0;
    END IF;

    -- Determine authoritative plan
    SELECT COALESCE(current_plan, plan, 'free') INTO v_plan
    FROM public.profiles
    WHERE id = p_user_id;

    v_plan := LOWER(COALESCE(v_plan, 'free'));
    IF v_plan = 'pro' THEN
        v_total_capacity := 10000;
    ELSIF v_plan = 'plus' THEN
        v_total_capacity := 2000;
    ELSE
        v_total_capacity := 100;
    END IF;

    v_limit := v_total_capacity + v_bonus;

    IF v_used + p_cost > v_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', FORMAT('Your daily AI capacity of %s credits has been exhausted. Please upgrade your plan for more daily capacity.', v_limit),
            'code', 'CAPACITY_EXHAUSTED',
            'current', v_used,
            'limit', v_limit
        );
    END IF;

    -- Atomically reserve capacity
    UPDATE public.user_usage_tracking
    SET daily_ai_capacity_used = daily_ai_capacity_used + p_cost,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    v_res_id := COALESCE(p_reservation_id, 'res_' || gen_random_uuid()::text);

    IF p_reservation_id IS NOT NULL THEN
        PERFORM 1 FROM public.capacity_reservations WHERE reservation_id = v_res_id FOR UPDATE;
        IF FOUND THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'Duplicate reservation ID', 'code', 'DUPLICATE_RESERVATION');
        END IF;

        INSERT INTO public.capacity_reservations (reservation_id, user_id, feature, cost, status)
        VALUES (v_res_id, p_user_id, p_feature, p_cost, 'reserved');
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'cost', p_cost,
        'current', v_used + p_cost,
        'limit', v_limit,
        'reservation_id', v_res_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.reserve_ai_capacity(UUID, INT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_ai_capacity(UUID, INT, TEXT, TEXT) TO service_role, authenticated;

-- D. Atomic TTS Reservation RPC
CREATE OR REPLACE FUNCTION public.reserve_tts_usage(
    p_user_id UUID,
    p_character_count INT,
    p_reservation_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_plan TEXT;
    v_monthly_allowance INT;
    v_max_char_per_gen INT;
    v_characters_used INT;
    v_last_monthly_reset TIMESTAMPTZ;
    v_res_id TEXT;
BEGIN
    IF p_character_count <= 0 THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Character count must be positive', 'code', 'INVALID_COUNT');
    END IF;

    -- Strict authorization check: caller must be service_role or authenticated matching target user
    IF (auth.jwt() ->> 'role') <> 'service_role' AND auth.role() <> 'service_role' THEN
        IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'Unauthorized: caller identity does not match target user', 'code', 'UNAUTHORIZED');
        END IF;
    END IF;

    INSERT INTO public.user_usage_tracking (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT tts_characters_used_monthly, last_monthly_reset
    INTO v_characters_used, v_last_monthly_reset
    FROM public.user_usage_tracking
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_last_monthly_reset IS NULL OR NOW() >= v_last_monthly_reset + INTERVAL '1 month' THEN
        UPDATE public.user_usage_tracking
        SET tts_characters_used_monthly = 0,
            last_monthly_reset = NOW(),
            updated_at = NOW()
        WHERE user_id = p_user_id;

        v_characters_used := 0;
    END IF;

    SELECT COALESCE(current_plan, plan, 'free') INTO v_plan
    FROM public.profiles
    WHERE id = p_user_id;

    v_plan := LOWER(COALESCE(v_plan, 'free'));
    SELECT tts_monthly_limit, tts_max_chars
    INTO v_monthly_allowance, v_max_char_per_gen
    FROM public.plan_limits
    WHERE plan_name = v_plan;

    IF NOT FOUND THEN
        IF v_plan = 'pro' THEN
            v_monthly_allowance := 2000000;
            v_max_char_per_gen := 100000;
        ELSIF v_plan = 'plus' THEN
            v_monthly_allowance := 500000;
            v_max_char_per_gen := 20000;
        ELSE
            v_monthly_allowance := 10000;
            v_max_char_per_gen := 2000;
        END IF;
    END IF;

    IF p_character_count > v_max_char_per_gen THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', FORMAT('Requested text of %s characters exceeds the single-generation maximum of %s characters on the %s plan.', p_character_count, v_max_char_per_gen, UPPER(v_plan)),
            'code', 'MAX_CHARS_EXCEEDED'
        );
    END IF;

    IF v_characters_used + p_character_count > v_monthly_allowance THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', FORMAT('Monthly speech characters allowance exhausted. Generation requires %s characters, but only %s characters are remaining on your %s plan.', p_character_count, GREATEST(0, v_monthly_allowance - v_characters_used), UPPER(v_plan)),
            'code', 'TTS_LIMIT_EXHAUSTED'
        );
    END IF;

    UPDATE public.user_usage_tracking
    SET tts_characters_used_monthly = tts_characters_used_monthly + p_character_count,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    v_res_id := COALESCE(p_reservation_id, 'res_tts_' || gen_random_uuid()::text);

    IF p_reservation_id IS NOT NULL THEN
        PERFORM 1 FROM public.capacity_reservations WHERE reservation_id = v_res_id FOR UPDATE;
        IF FOUND THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'Duplicate reservation ID', 'code', 'DUPLICATE_RESERVATION');
        END IF;

        INSERT INTO public.capacity_reservations (reservation_id, user_id, feature, cost, status)
        VALUES (v_res_id, p_user_id, 'tts', p_character_count, 'reserved');
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'cost', p_character_count,
        'current', v_characters_used + p_character_count,
        'limit', v_monthly_allowance,
        'reservation_id', v_res_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.reserve_tts_usage(UUID, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_tts_usage(UUID, INT, TEXT) TO service_role, authenticated;

-- E. Strict Idempotent AI Capacity Refund RPC
CREATE OR REPLACE FUNCTION public.refund_ai_capacity(
    p_user_id UUID,
    p_cost INT,
    p_reservation_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_res RECORD;
BEGIN
    IF p_cost <= 0 THEN
        RETURN jsonb_build_object('refunded', false, 'reason', 'Cost must be positive');
    END IF;

    IF p_reservation_id IS NULL OR TRIM(p_reservation_id) = '' THEN
        RETURN jsonb_build_object('refunded', false, 'reason', 'Reservation ID is required for safe refunds');
    END IF;

    -- Strict authorization check: caller must be service_role or authenticated matching target user
    IF (auth.jwt() ->> 'role') <> 'service_role' AND auth.role() <> 'service_role' THEN
        IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
            RETURN jsonb_build_object('refunded', false, 'reason', 'Unauthorized: caller identity does not match target user');
        END IF;
    END IF;

    -- Lock and check reservation strictly
    SELECT id, user_id, feature, cost, status
    INTO v_res
    FROM public.capacity_reservations
    WHERE reservation_id = p_reservation_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('refunded', false, 'reason', 'Reservation not found or does not belong to user');
    END IF;

    IF v_res.status <> 'reserved' THEN
        RETURN jsonb_build_object('refunded', false, 'reason', FORMAT('Cannot refund reservation in %s state', v_res.status));
    END IF;

    IF v_res.cost <> p_cost THEN
        RETURN jsonb_build_object('refunded', false, 'reason', FORMAT('Reservation cost mismatch: requested %s, stored %s', p_cost, v_res.cost));
    END IF;

    UPDATE public.capacity_reservations
    SET status = 'refunded', updated_at = NOW()
    WHERE reservation_id = p_reservation_id;

    UPDATE public.user_usage_tracking
    SET daily_ai_capacity_used = GREATEST(0, daily_ai_capacity_used - p_cost),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('refunded', true, 'cost', p_cost);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.refund_ai_capacity(UUID, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_ai_capacity(UUID, INT, TEXT) TO service_role, authenticated;

-- F. Strict Idempotent TTS Refund RPC
CREATE OR REPLACE FUNCTION public.refund_tts_usage(
    p_user_id UUID,
    p_character_count INT,
    p_reservation_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_res RECORD;
BEGIN
    IF p_character_count <= 0 THEN
        RETURN jsonb_build_object('refunded', false, 'reason', 'Character count must be positive');
    END IF;

    IF p_reservation_id IS NULL OR TRIM(p_reservation_id) = '' THEN
        RETURN jsonb_build_object('refunded', false, 'reason', 'Reservation ID is required for safe refunds');
    END IF;

    -- Strict authorization check: caller must be service_role or authenticated matching target user
    IF (auth.jwt() ->> 'role') <> 'service_role' AND auth.role() <> 'service_role' THEN
        IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
            RETURN jsonb_build_object('refunded', false, 'reason', 'Unauthorized: caller identity does not match target user');
        END IF;
    END IF;

    -- Lock and check reservation strictly
    SELECT id, user_id, feature, cost, status
    INTO v_res
    FROM public.capacity_reservations
    WHERE reservation_id = p_reservation_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('refunded', false, 'reason', 'Reservation not found or does not belong to user');
    END IF;

    IF v_res.status <> 'reserved' THEN
        RETURN jsonb_build_object('refunded', false, 'reason', FORMAT('Cannot refund TTS reservation in %s state', v_res.status));
    END IF;

    IF v_res.cost <> p_character_count THEN
        RETURN jsonb_build_object('refunded', false, 'reason', FORMAT('TTS Reservation cost mismatch: requested %s, stored %s', p_character_count, v_res.cost));
    END IF;

    UPDATE public.capacity_reservations
    SET status = 'refunded', updated_at = NOW()
    WHERE reservation_id = p_reservation_id;

    UPDATE public.user_usage_tracking
    SET tts_characters_used_monthly = GREATEST(0, tts_characters_used_monthly - p_character_count),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('refunded', true, 'cost', p_character_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.refund_tts_usage(UUID, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_tts_usage(UUID, INT, TEXT) TO service_role, authenticated;

-- G. Strict Usage Success Recording RPC
CREATE OR REPLACE FUNCTION public.record_usage_success(
    p_user_id UUID,
    p_feature TEXT,
    p_reservation_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_res RECORD;
BEGIN
    -- Strict authorization check: caller must be service_role or authenticated matching target user
    IF (auth.jwt() ->> 'role') <> 'service_role' AND auth.role() <> 'service_role' THEN
        IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
            RAISE EXCEPTION 'Unauthorized: Caller may only record own usage success.';
        END IF;
    END IF;

    IF p_reservation_id IS NOT NULL THEN
        SELECT id, user_id, status
        INTO v_res
        FROM public.capacity_reservations
        WHERE reservation_id = p_reservation_id AND user_id = p_user_id
        FOR UPDATE;

        IF FOUND THEN
            IF v_res.status <> 'reserved' THEN
                RAISE EXCEPTION 'Reservation % cannot be completed from % state', p_reservation_id, v_res.status;
            END IF;

            UPDATE public.capacity_reservations
            SET status = 'completed', updated_at = NOW()
            WHERE reservation_id = p_reservation_id;
        END IF;
    END IF;

    IF p_feature IN ('chat_simple', 'chat_reasoning', 'chat', 'chat_maximum') THEN
        UPDATE public.user_usage_tracking SET chat_today = chat_today + 1, updated_at = NOW() WHERE user_id = p_user_id;
        UPDATE public.profiles SET messages_used_today = COALESCE(messages_used_today, 0) + 1, updated_at = NOW() WHERE id = p_user_id;
    ELSIF p_feature = 'image_generation' THEN
        UPDATE public.user_usage_tracking SET image_generation_today = image_generation_today + 1, updated_at = NOW() WHERE user_id = p_user_id;
        UPDATE public.profiles SET images_used_today = COALESCE(images_used_today, 0) + 1, updated_at = NOW() WHERE id = p_user_id;
    ELSIF p_feature = 'image_edit' THEN
        UPDATE public.user_usage_tracking SET image_edit_today = image_edit_today + 1, updated_at = NOW() WHERE user_id = p_user_id;
        UPDATE public.profiles SET analysis_used_today = COALESCE(analysis_used_today, 0) + 1, updated_at = NOW() WHERE id = p_user_id;
    ELSIF p_feature IN ('image_analysis', 'ocr', 'document_ai', 'pdf') THEN
        EXECUTE FORMAT('UPDATE public.user_usage_tracking SET %I = %I + 1, updated_at = NOW() WHERE user_id = %L', p_feature || '_today', p_feature || '_today', p_user_id);
        UPDATE public.profiles SET analysis_used_today = COALESCE(analysis_used_today, 0) + 1, updated_at = NOW() WHERE id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.record_usage_success(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_usage_success(UUID, TEXT, TEXT) TO service_role, authenticated;

-- H. Database-Side Trigger To Protect Privileged Profile Data from Direct Browser Modification
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow service_role (backend server) or superuser postgres full write access
    IF (auth.jwt() ->> 'role') = 'service_role' OR current_user = 'postgres' THEN
        RETURN NEW;
    END IF;

    -- Block authenticated end-users from modifying privileged/server-owned columns
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
        RAISE EXCEPTION 'Unauthorized: is_admin cannot be modified directly by clients.';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Unauthorized: role cannot be modified directly by clients.';
    END IF;

    IF NEW.plan IS DISTINCT FROM OLD.plan OR NEW.current_plan IS DISTINCT FROM OLD.current_plan THEN
        RAISE EXCEPTION 'Unauthorized: plan entitlements cannot be modified directly by clients.';
    END IF;

    IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR
       NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier OR
       NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at OR
       NEW.subscription_provider IS DISTINCT FROM OLD.subscription_provider OR
       NEW.subscription_start IS DISTINCT FROM OLD.subscription_start OR
       NEW.subscription_end IS DISTINCT FROM OLD.subscription_end OR
       NEW.billing_cycle IS DISTINCT FROM OLD.billing_cycle OR
       NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id OR
       NEW.paypal_subscription_id IS DISTINCT FROM OLD.paypal_subscription_id OR
       NEW.lemon_squeezy_subscription_id IS DISTINCT FROM OLD.lemon_squeezy_subscription_id THEN
        RAISE EXCEPTION 'Unauthorized: subscription properties cannot be modified directly by clients.';
    END IF;

    IF NEW.messages_used_today IS DISTINCT FROM OLD.messages_used_today OR
       NEW.analysis_used_today IS DISTINCT FROM OLD.analysis_used_today OR
       NEW.images_used_today IS DISTINCT FROM OLD.images_used_today OR
       NEW.last_usage_reset IS DISTINCT FROM OLD.last_usage_reset OR
       NEW.tts_characters_used IS DISTINCT FROM OLD.tts_characters_used OR
       NEW.tts_reset_date IS DISTINCT FROM OLD.tts_reset_date THEN
        RAISE EXCEPTION 'Unauthorized: usage tracking counters cannot be modified directly by clients.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_protect_privileged_profile_fields ON public.profiles;
CREATE TRIGGER tr_protect_privileged_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_privileged_profile_fields();

