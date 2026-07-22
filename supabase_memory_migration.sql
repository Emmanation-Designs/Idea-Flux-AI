-- Production-ready Supabase SQL Migration for User Memories System
-- File: supabase_memory_migration.sql

CREATE TABLE IF NOT EXISTS public.user_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    memory TEXT NOT NULL,
    category TEXT,
    importance INTEGER DEFAULT 1,
    source_conversation UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    archived BOOLEAN DEFAULT FALSE
);

-- Performance & Retrieval Indexes
CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON public.user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_user_archived ON public.user_memories(user_id, archived);
CREATE INDEX IF NOT EXISTS idx_user_memories_category ON public.user_memories(category);
CREATE INDEX IF NOT EXISTS idx_user_memories_source_conv ON public.user_memories(source_conversation);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

-- RLS Security Policies
DROP POLICY IF EXISTS "Users can select own memories" ON public.user_memories;
CREATE POLICY "Users can select own memories"
ON public.user_memories FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own memories" ON public.user_memories;
CREATE POLICY "Users can insert own memories"
ON public.user_memories FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own memories" ON public.user_memories;
CREATE POLICY "Users can update own memories"
ON public.user_memories FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own memories" ON public.user_memories;
CREATE POLICY "Users can delete own memories"
ON public.user_memories FOR DELETE
USING (auth.uid() = user_id);
