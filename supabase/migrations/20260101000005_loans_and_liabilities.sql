-- ==============================================================================
-- WealthNest Phase 5: Loans & Liabilities Module Schema Migration
-- ==============================================================================

-- 1. Asset Valuations Table (Dated historical valuations for properties and assets)
CREATE TABLE IF NOT EXISTS public.asset_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  valuation_cents bigint NOT NULL CHECK (valuation_cents >= 0),
  currency text NOT NULL DEFAULT 'INR',
  as_of_date date NOT NULL,
  source text NOT NULL DEFAULT 'manual_appraisal',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_asset_valuation_date UNIQUE (user_id, asset_id, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_asset_valuations_asset_date 
  ON public.asset_valuations (asset_id, as_of_date DESC);

CREATE INDEX IF NOT EXISTS idx_asset_valuations_user_date 
  ON public.asset_valuations (user_id, as_of_date DESC);

-- 2. Liabilities Table (Household/user-owned loans and debt obligations)
CREATE TABLE IF NOT EXISTS public.liabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  loan_type text NOT NULL CHECK (
    loan_type IN ('home_loan', 'vehicle_loan', 'personal_loan', 'education_loan', 'credit_card', 'gold_loan', 'business_loan', 'other')
  ),
  lender text NOT NULL,
  account_number text,
  original_principal_cents bigint NOT NULL CHECK (original_principal_cents > 0),
  interest_rate numeric(5, 2) NOT NULL CHECK (interest_rate >= 0),
  interest_type text NOT NULL DEFAULT 'floating' CHECK (interest_type IN ('fixed', 'floating')),
  tenure_months integer CHECK (tenure_months > 0),
  emi_amount_cents bigint NOT NULL DEFAULT 0 CHECK (emi_amount_cents >= 0),
  currency text NOT NULL DEFAULT 'INR',
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'refinanced', 'defaulted')),
  linked_asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_liabilities_user_status 
  ON public.liabilities (user_id, status);

CREATE INDEX IF NOT EXISTS idx_liabilities_linked_asset 
  ON public.liabilities (linked_asset_id) WHERE linked_asset_id IS NOT NULL;

-- 3. Liability Balances Table (Dated outstanding principal snapshots)
CREATE TABLE IF NOT EXISTS public.liability_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liability_id uuid NOT NULL REFERENCES public.liabilities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cents bigint NOT NULL CHECK (balance_cents >= 0),
  as_of_date date NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_liability_balance_date UNIQUE (liability_id, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_liability_balances_lookup 
  ON public.liability_balances (liability_id, as_of_date DESC);

CREATE INDEX IF NOT EXISTS idx_liability_balances_user_date 
  ON public.liability_balances (user_id, as_of_date DESC);

-- 4. Asset Liability Links Table (Supports multiple loans per property / asset)
CREATE TABLE IF NOT EXISTS public.asset_liability_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  liability_id uuid NOT NULL REFERENCES public.liabilities(id) ON DELETE CASCADE,
  link_type text NOT NULL DEFAULT 'mortgage' CHECK (
    link_type IN ('mortgage', 'collateral', 'pledge', 'hypothecation', 'unsecured')
  ),
  ownership_share_percentage numeric(5, 2) NOT NULL DEFAULT 100.00 CHECK (
    ownership_share_percentage > 0 AND ownership_share_percentage <= 100
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_asset_liability_link UNIQUE (asset_id, liability_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_liability_links_asset 
  ON public.asset_liability_links (asset_id);

CREATE INDEX IF NOT EXISTS idx_asset_liability_links_liability 
  ON public.asset_liability_links (liability_id);

-- 5. Loan Payments Table (Principal and interest components separated)
CREATE TABLE IF NOT EXISTS public.loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liability_id uuid NOT NULL REFERENCES public.liabilities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_date date NOT NULL,
  total_payment_cents bigint NOT NULL CHECK (total_payment_cents >= 0),
  principal_cents bigint NOT NULL DEFAULT 0 CHECK (principal_cents >= 0),
  interest_cents bigint NOT NULL DEFAULT 0 CHECK (interest_cents >= 0),
  extra_payment_cents bigint NOT NULL DEFAULT 0 CHECK (extra_payment_cents >= 0),
  currency text NOT NULL DEFAULT 'INR',
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_payment_components CHECK (principal_cents + interest_cents + extra_payment_cents <= total_payment_cents)
);

CREATE INDEX IF NOT EXISTS idx_loan_payments_liability_date 
  ON public.loan_payments (liability_id, payment_date DESC);

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- Strict multi-tenant isolation: Users can ONLY access their own records
-- ==============================================================================

ALTER TABLE public.asset_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liability_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_liability_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

-- asset_valuations RLS
CREATE POLICY "Users can manage their own asset valuations"
  ON public.asset_valuations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- liabilities RLS
CREATE POLICY "Users can manage their own liabilities"
  ON public.liabilities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- liability_balances RLS
CREATE POLICY "Users can manage their own liability balances"
  ON public.liability_balances FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- asset_liability_links RLS
CREATE POLICY "Users can manage their own asset liability links"
  ON public.asset_liability_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- loan_payments RLS
CREATE POLICY "Users can manage their own loan payments"
  ON public.loan_payments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
