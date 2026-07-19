-- ============================================================================
-- Trelvix AI - Temporary Chat Migration Script
-- Description: Migration to support robust temporary conversations which
--              are omitted from the permanent sidebar history.
-- Target Environment: Supabase / PostgreSQL 14+
-- ============================================================================

-- 1. SCHEMAS & TABLES
-- Add the is_temporary column to the public.conversations table if it doesn't exist
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT FALSE NOT NULL;

COMMENT ON COLUMN public.conversations.is_temporary IS 'Flag indicating if a conversation is temporary and should not be saved in permanent sidebar history.';

-- 2. INDEX OPTIMIZATIONS
-- Index to quickly filter out temporary conversations for normal history loads
CREATE INDEX IF NOT EXISTS conversations_user_is_temporary_idx 
ON public.conversations (user_id, is_temporary, updated_at DESC);
