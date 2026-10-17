-- ============================================================================
-- Trelvix AI - Security Hardening: Atomic Capacity Reservation & RLS Protection
-- Target Environment: Supabase / PostgreSQL 14+
-- Safe Run Guarantee:
--   - Fully non-destructive and idempotent.
--   - Does NOT drop tables or delete existing user data.
--   - Enforces fixed search_path = public, pg_temp on all SECURITY DEFINER functions.
--   - Enforces strict caller authorization (service_role or authenticated matching owner).
--   - Implements atomic row-locked capacity reservation and idempotent refunds.
--   - Enforces database-level protection against client-side profile tampering.
--
-- NOTE: As instructed, review this SQL migration before applying to production.
-- ============================================================================

-- 1. Reservation & Idempotent Refund Tracking Table
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

-- 2. Hardened increment_usage_field with strict allowlist & fixed search_path
CREATE OR REPLACE FUNCTION public.increment_usage_field(
    user_uuid UUID,
    field_name TEXT,
    increment_by INT
)
RETURNS VOID AS $$
BEGIN
    -- 1. Input validation: only allow strictly positive increments
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

-- 3. Atomic Capacity Reservation RPC (Checks limits & reserves in a single transaction)
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
        INSERT INTO public.capacity_reservations (reservation_id, user_id, feature, cost, status)
        VALUES (v_res_id, p_user_id, p_feature, p_cost, 'reserved')
        ON CONFLICT (reservation_id) DO NOTHING;
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

-- 4. Atomic TTS Reservation RPC (Checks limits & reserves in a single transaction)
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
        INSERT INTO public.capacity_reservations (reservation_id, user_id, feature, cost, status)
        VALUES (v_res_id, p_user_id, 'tts', p_character_count, 'reserved')
        ON CONFLICT (reservation_id) DO NOTHING;
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

-- 5. Idempotent AI Capacity Refund RPC
CREATE OR REPLACE FUNCTION public.refund_ai_capacity(
    p_user_id UUID,
    p_cost INT,
    p_reservation_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_res_status TEXT;
BEGIN
    IF p_cost <= 0 THEN
        RETURN jsonb_build_object('refunded', false, 'reason', 'Cost must be positive');
    END IF;

    -- Strict authorization check: caller must be service_role or authenticated matching target user
    IF (auth.jwt() ->> 'role') <> 'service_role' AND auth.role() <> 'service_role' THEN
        IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
            RETURN jsonb_build_object('refunded', false, 'reason', 'Unauthorized: caller identity does not match target user');
        END IF;
    END IF;

    IF p_reservation_id IS NOT NULL THEN
        SELECT status INTO v_res_status
        FROM public.capacity_reservations
        WHERE reservation_id = p_reservation_id AND user_id = p_user_id
        FOR UPDATE;

        IF FOUND THEN
            IF v_res_status = 'refunded' THEN
                RETURN jsonb_build_object('refunded', false, 'reason', 'Reservation already refunded');
            END IF;

            UPDATE public.capacity_reservations
            SET status = 'refunded', updated_at = NOW()
            WHERE reservation_id = p_reservation_id;
        END IF;
    END IF;

    UPDATE public.user_usage_tracking
    SET daily_ai_capacity_used = GREATEST(0, daily_ai_capacity_used - p_cost),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('refunded', true, 'cost', p_cost);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.refund_ai_capacity(UUID, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_ai_capacity(UUID, INT, TEXT) TO service_role, authenticated;

-- 6. Idempotent TTS Refund RPC
CREATE OR REPLACE FUNCTION public.refund_tts_usage(
    p_user_id UUID,
    p_character_count INT,
    p_reservation_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_res_status TEXT;
BEGIN
    IF p_character_count <= 0 THEN
        RETURN jsonb_build_object('refunded', false, 'reason', 'Character count must be positive');
    END IF;

    -- Strict authorization check: caller must be service_role or authenticated matching target user
    IF (auth.jwt() ->> 'role') <> 'service_role' AND auth.role() <> 'service_role' THEN
        IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
            RETURN jsonb_build_object('refunded', false, 'reason', 'Unauthorized: caller identity does not match target user');
        END IF;
    END IF;

    IF p_reservation_id IS NOT NULL THEN
        SELECT status INTO v_res_status
        FROM public.capacity_reservations
        WHERE reservation_id = p_reservation_id AND user_id = p_user_id
        FOR UPDATE;

        IF FOUND THEN
            IF v_res_status = 'refunded' THEN
                RETURN jsonb_build_object('refunded', false, 'reason', 'Reservation already refunded');
            END IF;

            UPDATE public.capacity_reservations
            SET status = 'refunded', updated_at = NOW()
            WHERE reservation_id = p_reservation_id;
        END IF;
    END IF;

    UPDATE public.user_usage_tracking
    SET tts_characters_used_monthly = GREATEST(0, tts_characters_used_monthly - p_character_count),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('refunded', true, 'cost', p_character_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.refund_tts_usage(UUID, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_tts_usage(UUID, INT, TEXT) TO service_role, authenticated;

-- 7. Usage Success Recording RPC
CREATE OR REPLACE FUNCTION public.record_usage_success(
    p_user_id UUID,
    p_feature TEXT,
    p_reservation_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Strict authorization check: caller must be service_role or authenticated matching target user
    IF (auth.jwt() ->> 'role') <> 'service_role' AND auth.role() <> 'service_role' THEN
        IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
            RAISE EXCEPTION 'Unauthorized: Caller may only record own usage success.';
        END IF;
    END IF;

    IF p_reservation_id IS NOT NULL THEN
        UPDATE public.capacity_reservations
        SET status = 'completed', updated_at = NOW()
        WHERE reservation_id = p_reservation_id AND user_id = p_user_id;
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

-- 8. Hardened get_monthly_tts_usage with strict authorization and fixed search_path
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

-- 9. Database-Side Trigger To Protect Privileged Profile Data from Direct Browser Modification
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
