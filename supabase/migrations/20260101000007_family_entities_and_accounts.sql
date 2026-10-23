-- ==============================================================================
-- WealthNest Phase 6A: Multi-Demat & Family Portfolios Schema Migration
-- ==============================================================================

-- 1. Family Members Table (Legal entities, HUF, Spouse, Children, Self)
CREATE TABLE IF NOT EXISTS public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text NOT NULL CHECK (
    relationship IN ('self', 'spouse', 'huf', 'child', 'parent', 'other')
  ),
  pan_masked text,
  color_hex text NOT NULL DEFAULT '#3b82f6',
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_members_user_rel 
  ON public.family_members (user_id, relationship);

-- 2. Portfolio Accounts Table (Demat accounts, Mutual Fund Folios, PPF/NPS accounts)
CREATE TABLE IF NOT EXISTS public.portfolio_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  broker_name text NOT NULL,
  depository text NOT NULL DEFAULT 'CDSL' CHECK (
    depository IN ('CDSL', 'NSDL', 'CAMS', 'KFINTECH', 'RBI', 'OTHER')
  ),
  account_number_masked text,
  account_type text NOT NULL DEFAULT 'demat' CHECK (
    account_type IN ('demat', 'mutual_fund_folio', 'savings_bank', 'ppf_epf', 'nps', 'other')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_accounts_user_member 
  ON public.portfolio_accounts (user_id, member_id);

-- 3. Extend Holdings with Entity & Account References
ALTER TABLE public.holdings 
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.family_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.portfolio_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_holdings_member 
  ON public.holdings (member_id);

CREATE INDEX IF NOT EXISTS idx_holdings_account 
  ON public.holdings (account_id);

-- 4. Extend Transactions with Entity & Account References
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.family_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.portfolio_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_member 
  ON public.transactions (member_id);

CREATE INDEX IF NOT EXISTS idx_transactions_account 
  ON public.transactions (account_id);

-- ==============================================================================
-- Row-Level Security (RLS)
-- ==============================================================================

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_accounts ENABLE ROW LEVEL SECURITY;

-- Family Members Policies
CREATE POLICY "Users can manage their own family members"
  ON public.family_members FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Portfolio Accounts Policies
CREATE POLICY "Users can manage their own portfolio accounts"
  ON public.portfolio_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
