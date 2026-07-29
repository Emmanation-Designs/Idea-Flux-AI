-- ====================================================================
-- SUPABASE LIBRARY & ASSETS MIGRATION
-- Enables central tracking for user uploads and cross-feature asset management
-- ====================================================================

-- 1. CREATE USER_UPLOADS TABLE
CREATE TABLE IF NOT EXISTS public.user_uploads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT DEFAULT 'other' NOT NULL, -- 'image', 'video', 'audio', 'speech', 'document', 'other'
    category TEXT DEFAULT 'uploaded' NOT NULL, -- 'uploaded', 'generated'
    file_size BIGINT DEFAULT 0 NOT NULL,
    mime_type TEXT NULL,
    file_url TEXT NULL,
    file_path TEXT NULL,
    file_format TEXT NULL,
    thumbnail_url TEXT NULL,
    originating_feature TEXT DEFAULT 'Upload' NOT NULL, -- 'Vision', 'PDF', 'Video Studio', 'Chat', 'OCR', 'Library', etc.
    prompt TEXT NULL,
    model_used TEXT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. CREATE INDEXES FOR FAST PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_user_uploads_user_id ON public.user_uploads (user_id);
CREATE INDEX IF NOT EXISTS idx_user_uploads_created_at ON public.user_uploads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_uploads_category ON public.user_uploads (user_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_uploads_file_type ON public.user_uploads (user_id, file_type);

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.user_uploads ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES FOR USER_UPLOADS
DROP POLICY IF EXISTS "Users can view own uploads" ON public.user_uploads;
DROP POLICY IF EXISTS "Users can insert own uploads" ON public.user_uploads;
DROP POLICY IF EXISTS "Users can update own uploads" ON public.user_uploads;
DROP POLICY IF EXISTS "Users can delete own uploads" ON public.user_uploads;

CREATE POLICY "Users can view own uploads" ON public.user_uploads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own uploads" ON public.user_uploads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own uploads" ON public.user_uploads
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own uploads" ON public.user_uploads
    FOR DELETE USING (auth.uid() = user_id);
