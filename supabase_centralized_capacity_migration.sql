-- ============================================================================
-- Trelvix AI - Consolidated Centralized Capacity Database Migration
-- Target Environment: Supabase / PostgreSQL 14+
-- Safe Run Guarantee: Fully idempotent. Running it multiple times is safe.
-- ============================================================================

-- 1. PURGE OBSOLETE LEGACY OBJECTS
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'tts_plan_limits'
    ) THEN
        DROP TRIGGER IF EXISTS set_tts_plan_limits_updated_at ON public.tts_plan_limits;
    END IF;
END $$;

DROP TABLE IF EXISTS public.tts_plan_limits CASCADE;
DROP FUNCTION IF EXISTS public.can_generate_tts(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS public.can_generate_tts_monthly(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_today_tts_usage(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.check_and_reset_tts_monthly(UUID) CASCADE;

-- 2. CREATE SHARED AUTOMATIC TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ALIGN SYSTEM TABLES & SCHEMAS

-- A. USER PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NULL,
    plan TEXT DEFAULT 'free' NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NULL
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_plan TEXT DEFAULT 'free' NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_provider TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMPTZ DEFAULT NOW() NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_usage_reset TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country_code TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_country TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD' NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_currency TEXT DEFAULT 'USD' NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NULL;

UPDATE public.profiles 
SET current_plan = COALESCE(plan, 'free') 
WHERE current_plan IS NULL;

-- B. CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT DEFAULT 'New Conversation' NULL,
    type TEXT DEFAULT 'general' NULL,
    messages JSONB DEFAULT '[]'::jsonb NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NULL
);

-- C. IMAGES
CREATE TABLE IF NOT EXISTS public.images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NULL,
    prompt TEXT NULL,
    image_url TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NULL
);

-- D. PLAN LIMITS (Key-Value Store Mapping for Paypal Adapter)
CREATE TABLE IF NOT EXISTS public.plan_limits (
    plan_name TEXT PRIMARY KEY,
    chat_limit INT NOT NULL DEFAULT 0,
    image_generation_limit INT NOT NULL DEFAULT 0,
    image_edit_limit INT NOT NULL DEFAULT 0,
    image_analysis_limit INT NOT NULL DEFAULT 0,
    document_ai_limit INT NOT NULL DEFAULT 0,
    pdf_limit INT NOT NULL DEFAULT 0,
    ocr_limit INT NOT NULL DEFAULT 0,
    tts_monthly_limit INT NOT NULL DEFAULT 0,
    tts_max_chars INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- E. CENTRALIZED USAGE TRACKING
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

INSERT INTO public.plan_limits (
    plan_name, chat_limit, image_generation_limit, image_edit_limit, image_analysis_limit, 
    document_ai_limit, pdf_limit, ocr_limit, tts_monthly_limit, tts_max_chars
)
VALUES 
    ('free', 10, 3, 2, 2, 2, 2, 2, 10000, 2000),
    ('plus', 100, 20, 15, 15, 10, 10, 10, 500000, 20000),
    ('pro', 1000, 100, 50, 50, 30, 30, 30, 2000000, 100000)
ON CONFLICT (plan_name) DO NOTHING;

INSERT INTO public.user_usage_tracking (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- F. TEXT-TO-SPEECH GENERATIONS
CREATE TABLE IF NOT EXISTS public.tts_generations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    character_count INT NOT NULL CHECK (character_count > 0),
    selected_voice TEXT NOT NULL,
    selected_model TEXT NOT NULL,
    generation_status TEXT DEFAULT 'pending' NOT NULL CHECK (generation_status IN ('pending', 'completed', 'failed')),
    generation_time_ms INT NULL,
    audio_duration_seconds NUMERIC(8,2) NULL,
    download_count INT DEFAULT 0 NOT NULL,
    file_size_bytes BIGINT NULL,
    provider TEXT DEFAULT 'openai' NOT NULL,
    language_code TEXT NULL,
    voice_id TEXT NULL,
    team_id UUID NULL,
    metadata JSONB DEFAULT '{}'::jsonb NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. DATABASE LOOKUP OPTIMIZATIONS (INDICES)
CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON public.conversations (user_id);
CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON public.conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS images_user_id_idx ON public.images (user_id);
CREATE INDEX IF NOT EXISTS tts_generations_user_id_idx ON public.tts_generations (user_id);
CREATE INDEX IF NOT EXISTS tts_generations_created_at_idx ON public.tts_generations (created_at DESC);
CREATE INDEX IF NOT EXISTS tts_generations_composite_idx ON public.tts_generations (user_id, created_at DESC, generation_status);

-- 5. ATTACH TIMESTAMPTZ AUTO-UPDATER TRIGGERS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_profiles_updated_at') THEN
        CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_conversations_updated_at') THEN
        CREATE TRIGGER set_conversations_updated_at BEFORE UPDATE ON public.conversations
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_plan_limits_updated_at') THEN
        CREATE TRIGGER set_plan_limits_updated_at BEFORE UPDATE ON public.plan_limits
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_user_usage_tracking_updated_at') THEN
        CREATE TRIGGER set_user_usage_tracking_updated_at BEFORE UPDATE ON public.user_usage_tracking
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;

-- 6. SECURITY & ROW-LEVEL ACCESS CONTROLS (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tts_generations ENABLE ROW LEVEL SECURITY;

-- Clean existing policies for idempotency
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;

DROP POLICY IF EXISTS "Users can view own images" ON public.images;
DROP POLICY IF EXISTS "Users can insert own images" ON public.images;
DROP POLICY IF EXISTS "Users can delete own images" ON public.images;

DROP POLICY IF EXISTS "Allow read access to plan_limits for authenticated" ON public.plan_limits;
DROP POLICY IF EXISTS "Allow read access to user_usage_tracking for owner" ON public.user_usage_tracking;

DROP POLICY IF EXISTS "Users can select own tts generations" ON public.tts_generations;
DROP POLICY IF EXISTS "Users can insert own tts generations" ON public.tts_generations;

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles 
    FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles 
    FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Conversations
CREATE POLICY "Users can view own conversations" ON public.conversations 
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON public.conversations 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON public.conversations 
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" ON public.conversations 
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Images
CREATE POLICY "Users can view own images" ON public.images 
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Plan Limits
CREATE POLICY "Allow read access to plan_limits for authenticated" ON public.plan_limits
    FOR SELECT TO authenticated USING (true);

-- User Usage Tracking
CREATE POLICY "Allow read access to user_usage_tracking for owner" ON public.user_usage_tracking
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- TTS Generations
CREATE POLICY "Users can select own tts generations" ON public.tts_generations
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tts generations" ON public.tts_generations
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
