-- ==============================================================================
-- WealthNest Phase 15: Inter-Account Transfers & Double-Entry Cashflow
-- ==============================================================================
-- 1. Update CHECK constraint on transactions.type to include 'transfer'
-- 2. Add destination_account_id to transactions table for inter-account money movements
-- 3. Update RLS policies and indices
-- ==============================================================================

-- 1. Drop old constraint and add updated CHECK constraint including 'transfer'
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions 
  ADD CONSTRAINT transactions_type_check 
  CHECK (type IN ('buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'fee', 'transfer'));

-- 2. Add destination_account_id column to track destination demat/bank account
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS destination_account_id uuid REFERENCES public.portfolio_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_dest_account 
  ON public.transactions (destination_account_id);

