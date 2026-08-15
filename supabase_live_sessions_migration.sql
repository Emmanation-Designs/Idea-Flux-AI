-- ============================================================================
-- Trelvix AI - Live Mode Realtime Voice Sessions Schema Migration
-- Safe Run Guarantee: Idempotent migration
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.live_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_session_id TEXT NULL,
    model TEXT DEFAULT 'gpt-realtime-2.1',
    voice TEXT DEFAULT 'marin',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ NULL,
    last_accounted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_seconds INTEGER DEFAULT 0,
    capacity_consumed INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user lookups and active session filtering
CREATE INDEX IF NOT EXISTS idx_live_sessions_user_id ON public.live_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON public.live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_created_at ON public.live_sessions(created_at DESC);

-- Enable RLS
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own live sessions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'live_sessions' AND policyname = 'Users can view own live sessions'
    ) THEN
        CREATE POLICY "Users can view own live sessions"
        ON public.live_sessions FOR SELECT
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- RLS Policy: Users can insert their own live sessions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'live_sessions' AND policyname = 'Users can insert own live sessions'
    ) THEN
        CREATE POLICY "Users can insert own live sessions"
        ON public.live_sessions FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Automatically update updated_at column
CREATE OR REPLACE FUNCTION public.handle_live_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_live_sessions_updated_at ON public.live_sessions;
CREATE TRIGGER set_live_sessions_updated_at
BEFORE UPDATE ON public.live_sessions
FOR EACH ROW
EXECUTE FUNCTION public.handle_live_sessions_updated_at();
