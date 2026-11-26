-- ============================================================================
-- Trelvix AI - Payment Transactions & Webhook Idempotency Ledger
-- Description: Tracks checkout references (WittyPay, PayPal, etc.) to enforce
--              amount verification and prevent duplicate activations on retries.
-- Target Environment: Supabase / PostgreSQL 14+
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_transactions (
    reference TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    plan TEXT NOT NULL,
    interval TEXT NOT NULL DEFAULT 'month',
    region TEXT NOT NULL DEFAULT 'nigeria',
    expected_amount NUMERIC NOT NULL,
    paid_amount NUMERIC,
    currency TEXT NOT NULL DEFAULT 'NGN',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    order_no TEXT,
    pay_method TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS payment_transactions_user_idx
    ON public.payment_transactions(user_id, created_at DESC);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages payment_transactions" ON public.payment_transactions;
CREATE POLICY "Service role manages payment_transactions"
    ON public.payment_transactions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users view own payment_transactions" ON public.payment_transactions;
CREATE POLICY "Users view own payment_transactions"
    ON public.payment_transactions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
