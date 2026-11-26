-- ============================================================================
-- Trelvix AI - Dynamic Billing FX Rate Configuration (Admin-Editable)
-- Description: Stores the USD -> NGN conversion rate (default 1400) so both
--              the Trelvix AI app and Admin Portal stay synchronized.
-- Target Environment: Supabase / PostgreSQL 14+
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.platform_settings IS 'Platform-wide runtime settings configurable from the Admin Portal.';

-- Seed default USD -> NGN conversion rate (1400) without overwriting admin edits
INSERT INTO public.platform_settings (key, value, description)
VALUES (
    'billing_fx_rates',
    '{"usd_to_ngn": 1400}'::jsonb,
    'Fixed USD to NGN exchange rate used for Nigerian checkout pricing'
)
ON CONFLICT (key) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Public / authenticated users can read runtime settings (needed for pricing display)
DROP POLICY IF EXISTS "Allow public read of platform_settings" ON public.platform_settings;
CREATE POLICY "Allow public read of platform_settings"
    ON public.platform_settings
    FOR SELECT
    USING (true);

-- Only verified admins can insert/update/delete platform settings via client JWT
-- (Backend service_role bypasses RLS automatically)
DROP POLICY IF EXISTS "Allow admins to manage platform_settings" ON public.platform_settings;
CREATE POLICY "Allow admins to manage platform_settings"
    ON public.platform_settings
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
        )
    );
