-- WealthNest Database Migration Scaffold (Phase 0)
-- Production-oriented PostgreSQL schema definitions will be added in Phase 1+.
-- Do not run migrations yet; local Supabase instance is not required for Phase 0.

-- Placeholder migration entry to establish version control tracking
COMMENT ON SCHEMA public IS 'WealthNest core schema - Phase 0 scaffold initialized';
-- ==============================================================================
-- WealthNest Phase 1: Core PostgreSQL Schema Migration
-- ==============================================================================

-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  default_currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Asset Classes (Taxonomy with visual tokens)
CREATE TABLE IF NOT EXISTS public.asset_classes (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  color_hex text NOT NULL,
  display_order int NOT NULL DEFAULT 0
);

-- Seed standard institutional asset classes (India First taxonomy)
INSERT INTO public.asset_classes (id, name, description, color_hex, display_order)
VALUES
  ('cash', 'Cash & Liquid Savings', 'Savings accounts, emergency fund, liquid mutual funds', '#10b981', 1),
  ('equity', 'Equities & Mutual Funds', 'NSE/BSE stocks, mutual funds, SIPs, Nifty index ETFs', '#3b82f6', 2),
  ('fixed_income', 'Fixed Income & Debt', 'Fixed deposits (FD), PPF, EPF, government bonds', '#8b5cf6', 3),
  ('commodity', 'Gold & Precious Metals', 'Sovereign Gold Bonds (SGB), physical 24K gold, silver', '#eab308', 4),
  ('real_estate', 'Real Estate & Land', 'Primary residence, commercial property, Indian REITs', '#f59e0b', 5),
  ('crypto', 'Digital Assets & Crypto', 'Major cryptocurrencies (subject to Indian VDA tax)', '#ec4899', 6),
  ('alternative', 'Alternative & Startups', 'Angel investments, private equity, collectibles', '#6366f1', 7)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color_hex = EXCLUDED.color_hex,
  display_order = EXCLUDED.display_order;

-- 3. Assets Table (User asset definitions)
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  ticker text,
  asset_class_id text NOT NULL REFERENCES public.asset_classes(id),
  currency text NOT NULL DEFAULT 'INR',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Holdings Table (Quantities and integer paise valuations)
CREATE TABLE IF NOT EXISTS public.holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  quantity numeric(20, 8) NOT NULL DEFAULT 0,
  unit_cost_cents bigint NOT NULL DEFAULT 0,
  current_value_cents bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_asset UNIQUE (user_id, asset_id)
);

-- 5. Transactions Table (Cashflow and trade audit log)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'fee')),
  quantity numeric(20, 8),
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  transaction_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- Strict multi-tenant isolation: Users can ONLY access their own records
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Asset Classes Policy (Readable by all authenticated users)
CREATE POLICY "Asset classes are readable by authenticated users"
  ON public.asset_classes FOR SELECT
  TO authenticated, anon
  USING (true);

-- Assets Policies
CREATE POLICY "Users can view their own assets"
  ON public.assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assets"
  ON public.assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assets"
  ON public.assets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets"
  ON public.assets FOR DELETE
  USING (auth.uid() = user_id);

-- Holdings Policies
CREATE POLICY "Users can view their own holdings"
  ON public.holdings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own holdings"
  ON public.holdings FOR ALL
  USING (auth.uid() = user_id);

-- Transactions Policies
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- Automatic User Profile Trigger on Signup
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, default_currency)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'USD'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Migration: 20260101000002_cas_import_schema.sql
-- Description: Add ISIN to assets table and create import_batches audit table for NSDL/CDSL CAS ingestion

-- 1. Add ISIN column to assets table
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS isin text;

-- Index for fast lookup and duplicate prevention per user
CREATE INDEX IF NOT EXISTS idx_assets_user_isin ON public.assets (user_id, isin) WHERE isin IS NOT NULL;

-- 2. Import Batches Table (Audit trail without storing document contents)
CREATE TABLE IF NOT EXISTS public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('NSDL', 'CDSL', 'UNKNOWN')),
  statement_date date NOT NULL,
  total_records int NOT NULL DEFAULT 0,
  imported_records int NOT NULL DEFAULT 0,
  updated_records int NOT NULL DEFAULT 0,
  skipped_records int NOT NULL DEFAULT 0,
  failed_records int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'partial')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Row Level Security (RLS) for import_batches
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own import batches"
  ON public.import_batches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own import batches"
  ON public.import_batches FOR INSERT
  WITH CHECK (auth.uid() = user_id);
-- Migration 20260101000003: Add Mutual Funds as distinct institutional asset class
-- Separates direct listed equities and mutual fund schemes for precise asset allocation and taxation

INSERT INTO public.asset_classes (id, name, description, color_hex, display_order)
VALUES
  ('equity', 'Equities & Stocks', 'NSE/BSE listed stocks, shares, and Demat holdings', '#3b82f6', 1),
  ('mutual_fund', 'Mutual Funds', 'Direct & regular mutual fund folios, SIPs, ELSS', '#06b6d4', 2),
  ('fixed_income', 'Fixed Income & Debt', 'Fixed deposits (FD), PPF, EPF, government bonds', '#8b5cf6', 3),
  ('commodity', 'Gold & Precious Metals', 'Sovereign Gold Bonds (SGB), physical 24K gold, silver', '#eab308', 4),
  ('real_estate', 'Real Estate & Land', 'Primary residence, commercial property, Indian REITs', '#f59e0b', 5),
  ('cash', 'Cash & Liquid Savings', 'Savings accounts, emergency fund, liquid savings', '#10b981', 6),
  ('crypto', 'Digital Assets & Crypto', 'Major cryptocurrencies (subject to Indian VDA tax)', '#ec4899', 7),
  ('alternative', 'Alternative & Startups', 'Angel investments, private equity, collectibles', '#6366f1', 8)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color_hex = EXCLUDED.color_hex,
  display_order = EXCLUDED.display_order;
-- Migration 20260101000004: Separate Direct Equities and Mutual Funds
-- Adds structured instrument details, folios, demat accounts, and relaxes single-holding per asset constraint

-- 1. Structured instrument fields on assets table
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS instrument_type text DEFAULT 'equity_share';
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS amc_name text;

-- 2. Structured holding columns for Demat accounts, Folios, Plans, and Cost Basis verification
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS demat_account_id text;
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS folio_number text;
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS amc_name text;
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS scheme_plan text;
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS cost_basis_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- 3. Relax single-holding constraint to support multiple folios of the same scheme or multiple demat accounts
ALTER TABLE public.holdings DROP CONSTRAINT IF EXISTS unique_user_asset;

-- Unique index ensuring idempotent holdings per user + asset + folio + demat account
CREATE UNIQUE INDEX IF NOT EXISTS idx_holdings_user_asset_account 
  ON public.holdings (user_id, asset_id, COALESCE(folio_number, ''), COALESCE(demat_account_id, ''));

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_holdings_folio ON public.holdings (user_id, folio_number) WHERE folio_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_holdings_demat ON public.holdings (user_id, demat_account_id) WHERE demat_account_id IS NOT NULL;
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
-- ==============================================================================
-- WealthNest Phase 5: Financial Goals & Milestones Schema Migration
-- ==============================================================================

-- 1. Goals Table (User-defined financial targets, retirement, emergency fund)
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (
    category IN ('emergency_fund', 'retirement', 'home_purchase', 'education', 'wealth_creation', 'vehicle', 'vacation', 'other')
  ),
  target_amount_cents bigint NOT NULL CHECK (target_amount_cents > 0),
  target_date date NOT NULL,
  initial_saved_cents bigint NOT NULL DEFAULT 0 CHECK (initial_saved_cents >= 0),
  monthly_contribution_cents bigint NOT NULL DEFAULT 0 CHECK (monthly_contribution_cents >= 0),
  expected_return_rate numeric(5, 2) NOT NULL DEFAULT 12.00 CHECK (expected_return_rate >= 0),
  inflation_rate numeric(5, 2) NOT NULL DEFAULT 6.00 CHECK (inflation_rate >= 0),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  currency text NOT NULL DEFAULT 'INR',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_category 
  ON public.goals (user_id, category);

CREATE INDEX IF NOT EXISTS idx_goals_user_target_date 
  ON public.goals (user_id, target_date ASC);

-- 2. Goal Holding Allocations Table (Links specific assets/holdings to a goal)
CREATE TABLE IF NOT EXISTS public.goal_holding_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  holding_id uuid NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allocation_percentage numeric(5, 2) NOT NULL DEFAULT 100.00 CHECK (
    allocation_percentage > 0 AND allocation_percentage <= 100.00
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_goal_holding UNIQUE (goal_id, holding_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_holding_allocations_goal 
  ON public.goal_holding_allocations (goal_id);

CREATE INDEX IF NOT EXISTS idx_goal_holding_allocations_holding 
  ON public.goal_holding_allocations (holding_id);

-- ==============================================================================
-- Row-Level Security (RLS)
-- ==============================================================================

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_holding_allocations ENABLE ROW LEVEL SECURITY;

-- Goals Policies
CREATE POLICY "Users can manage their own goals"
  ON public.goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Goal Holding Allocations Policies
CREATE POLICY "Users can manage their own goal holding allocations"
  ON public.goal_holding_allocations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
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
-- ==============================================================================
-- WealthNest Phase 6A Extended: Family Goals & Liabilities Scoping Migration
-- ==============================================================================

-- 1. Extend Goals Table with Family Member / Beneficiary Reference
ALTER TABLE public.goals 
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.family_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_goals_member 
  ON public.goals (member_id);

-- 2. Extend Liabilities Table with Primary Borrower & Co-Borrower References
ALTER TABLE public.liabilities 
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.family_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS co_borrower_ids uuid[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_liabilities_member 
  ON public.liabilities (member_id);
-- ==============================================================================
-- WealthNest Phase 7: Complete Admin Portal, User Management & Security Migration
-- ==============================================================================

-- 1. Create Platform Admin Roles Table
-- Independent of household/family roles; strictly governs administrative access
CREATE TABLE IF NOT EXISTS public.platform_admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin', 'support_admin', 'auditor')),
  is_active boolean NOT NULL DEFAULT true,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast role lookup
CREATE INDEX IF NOT EXISTS idx_platform_admin_roles_active 
  ON public.platform_admin_roles (user_id, role) 
  WHERE is_active = true;

-- Helper functions to check admin roles
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.platform_admin_roles 
    WHERE user_id = check_user_id 
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_platform_admin_role(check_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role 
  FROM public.platform_admin_roles 
  WHERE user_id = check_user_id 
    AND is_active = true 
  ORDER BY 
    CASE role 
      WHEN 'super_admin' THEN 1 
      WHEN 'support_admin' THEN 2 
      WHEN 'auditor' THEN 3 
      ELSE 4 
    END ASC 
  LIMIT 1;
$$;

-- 2. User Access Status Table
-- Tracks lifecycle states: invited, active, suspended, deactivated
CREATE TABLE IF NOT EXISTS public.user_access_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended', 'deactivated')),
  reason_code text,
  reason_details text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_user_access_status_status 
  ON public.user_access_status (status);

-- 3. Append-Only Admin Audit Logs Table
-- Immutable audit record of all administrative and security-relevant actions
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('success', 'failure', 'denied')),
  reason_code text,
  ip_address text,
  safe_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor ON public.admin_audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON public.admin_audit_logs (target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON public.admin_audit_logs (created_at DESC);

-- Trigger to guarantee append-only immutability for audit logs
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_logs records are strictly append-only and immutable. UPDATE and DELETE are prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mod ON public.admin_audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mod
  BEFORE UPDATE OR DELETE ON public.admin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_modification();

-- Helper function to log administrative actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_outcome text,
  p_reason_code text DEFAULT NULL,
  p_safe_metadata jsonb DEFAULT '{}'::jsonb,
  p_ip_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.admin_audit_logs (
    actor_user_id,
    target_user_id,
    action,
    outcome,
    reason_code,
    safe_metadata,
    ip_address
  ) VALUES (
    p_actor_user_id,
    p_target_user_id,
    p_action,
    p_outcome,
    p_reason_code,
    p_safe_metadata,
    p_ip_address
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- 4. Multi-User Households & Membership Tables
CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_role text NOT NULL DEFAULT 'member' CHECK (household_role IN ('primary_owner', 'member', 'viewer')),
  joined_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (household_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_household_members_user ON public.household_members (user_id);

-- 5. Row-Level Security Configuration
ALTER TABLE public.platform_admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- platform_admin_roles policies:
-- Users can see their own role; Platform admins can see all; only super_admin can modify
DROP POLICY IF EXISTS "Users can view own platform admin role" ON public.platform_admin_roles;
CREATE POLICY "Users can view own platform admin role"
  ON public.platform_admin_roles FOR SELECT
  USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

-- user_access_status policies:
-- Users can view their own status; Platform admins can see all; only platform admins can modify
DROP POLICY IF EXISTS "Users can view own access status" ON public.user_access_status;
CREATE POLICY "Users can view own access status"
  ON public.user_access_status FOR SELECT
  USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

-- admin_audit_logs policies:
-- Only platform admins can view audit logs; append-only via security definer or admin insert
DROP POLICY IF EXISTS "Platform admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Platform admins can view audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Platform admins can insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid()) OR auth.uid() IS NULL);

-- households policies:
-- Household members can view/manage their households; platform admins can view metadata
DROP POLICY IF EXISTS "Household members view household" ON public.households;
CREATE POLICY "Household members view household"
  ON public.households FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.household_members WHERE household_id = public.households.id AND user_id = auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Household members view members" ON public.household_members;
CREATE POLICY "Household members view members"
  ON public.household_members FOR SELECT
  USING (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

-- Update profiles policy so platform admins can view user display names
DROP POLICY IF EXISTS "Platform admins can view profiles" ON public.profiles;
CREATE POLICY "Platform admins can view profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_platform_admin(auth.uid()));

-- 6. Administrative RPC Functions

-- RPC: List users with pagination, filtering, status, and role
CREATE OR REPLACE FUNCTION public.admin_get_users(
  p_page int DEFAULT 1,
  p_limit int DEFAULT 20,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset int;
  v_total int;
  v_users jsonb;
BEGIN
  -- Authorize caller
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: Caller does not have platform administrative privileges';
  END IF;

  v_offset := (GREATEST(p_page, 1) - 1) * GREATEST(p_limit, 1);

  -- Count total matching
  SELECT COUNT(DISTINCT u.id) INTO v_total
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_access_status s ON s.user_id = u.id
  LEFT JOIN public.platform_admin_roles r ON r.user_id = u.id AND r.is_active = true
  WHERE (p_search IS NULL OR p_search = '' OR u.email ILIKE '%' || p_search || '%' OR p.display_name ILIKE '%' || p_search || '%')
    AND (p_status IS NULL OR p_status = '' OR COALESCE(s.status, 'active') = p_status)
    AND (p_role IS NULL OR p_role = '' OR r.role = p_role);

  -- Fetch items
  SELECT jsonb_agg(row_to_json(t)) INTO v_users
  FROM (
    SELECT 
      u.id,
      u.email,
      COALESCE(p.display_name, split_part(u.email, '@', 1)) AS display_name,
      COALESCE(s.status, 'active') AS status,
      s.reason_code,
      s.reason_details,
      r.role AS platform_role,
      u.created_at,
      u.last_sign_in_at,
      (SELECT COUNT(*) FROM public.household_members hm WHERE hm.user_id = u.id) AS household_count
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.user_access_status s ON s.user_id = u.id
    LEFT JOIN public.platform_admin_roles r ON r.user_id = u.id AND r.is_active = true
    WHERE (p_search IS NULL OR p_search = '' OR u.email ILIKE '%' || p_search || '%' OR p.display_name ILIKE '%' || p_search || '%')
      AND (p_status IS NULL OR p_status = '' OR COALESCE(s.status, 'active') = p_status)
      AND (p_role IS NULL OR p_role = '' OR r.role = p_role)
    ORDER BY u.created_at DESC
    LIMIT p_limit OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'users', COALESCE(v_users, '[]'::jsonb),
    'total', v_total,
    'page', p_page,
    'limit', p_limit
  );
END;
$$;

-- RPC: Get User Detail (Explicitly isolated from financial balances / holdings / transactions)
CREATE OR REPLACE FUNCTION public.admin_get_user_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user jsonb;
  v_households jsonb;
  v_audit_history jsonb;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: Caller does not have platform administrative privileges';
  END IF;

  SELECT jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'display_name', COALESCE(p.display_name, split_part(u.email, '@', 1)),
    'default_currency', p.default_currency,
    'status', COALESCE(s.status, 'active'),
    'reason_code', s.reason_code,
    'reason_details', s.reason_details,
    'status_updated_at', s.updated_at,
    'platform_role', r.role,
    'role_granted_at', r.granted_at,
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at
  ) INTO v_user
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_access_status s ON s.user_id = u.id
  LEFT JOIN public.platform_admin_roles r ON r.user_id = u.id AND r.is_active = true
  WHERE u.id = p_user_id;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Associated households metadata (metadata only, no financial portfolios)
  SELECT jsonb_agg(row_to_json(h_row)) INTO v_households
  FROM (
    SELECT 
      h.id,
      h.name,
      hm.household_role,
      hm.joined_at,
      (SELECT COUNT(*) FROM public.household_members m WHERE m.household_id = h.id) AS total_members
    FROM public.household_members hm
    JOIN public.households h ON h.id = hm.household_id
    WHERE hm.user_id = p_user_id
  ) h_row;

  -- Target audit trail
  SELECT jsonb_agg(row_to_json(a_row)) INTO v_audit_history
  FROM (
    SELECT 
      a.id,
      a.action,
      a.outcome,
      a.reason_code,
      a.created_at,
      a.safe_metadata,
      COALESCE(p.display_name, split_part(u.email, '@', 1)) AS actor_name
    FROM public.admin_audit_logs a
    LEFT JOIN auth.users u ON u.id = a.actor_user_id
    LEFT JOIN public.profiles p ON p.id = a.actor_user_id
    WHERE a.target_user_id = p_user_id
    ORDER BY a.created_at DESC
    LIMIT 20
  ) a_row;

  RETURN jsonb_build_object(
    'user', v_user,
    'households', COALESCE(v_households, '[]'::jsonb),
    'recent_audits', COALESCE(v_audit_history, '[]'::jsonb)
  );
END;
$$;

-- RPC: Set User Status (Lifecycle management with mandatory audit and self-protection)
CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  p_target_user_id uuid,
  p_status text,
  p_reason_code text,
  p_reason_details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_current_status text;
BEGIN
  v_caller_role := public.get_platform_admin_role(v_caller_id);
  
  IF v_caller_role NOT IN ('super_admin', 'support_admin') THEN
    RAISE EXCEPTION 'Access Denied: Insufficient permissions to change user status';
  END IF;

  -- Invariant: Administrator cannot suspend or deactivate themselves
  IF p_target_user_id = v_caller_id AND p_status IN ('suspended', 'deactivated') THEN
    PERFORM public.log_admin_action(
      v_caller_id, 
      p_target_user_id, 
      'USER_STATUS_CHANGE', 
      'denied', 
      'SELF_STATUS_CHANGE_PROHIBITED', 
      jsonb_build_object('attempted_status', p_status)
    );
    RAISE EXCEPTION 'Administrative Invariant: You cannot suspend or deactivate your own account';
  END IF;

  SELECT status INTO v_current_status
  FROM public.user_access_status
  WHERE user_id = p_target_user_id;

  INSERT INTO public.user_access_status (
    user_id, status, reason_code, reason_details, changed_by, updated_at
  ) VALUES (
    p_target_user_id, p_status, p_reason_code, p_reason_details, v_caller_id, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = EXCLUDED.status,
    reason_code = EXCLUDED.reason_code,
    reason_details = EXCLUDED.reason_details,
    changed_by = EXCLUDED.changed_by,
    updated_at = now();

  -- Record audit log
  PERFORM public.log_admin_action(
    v_caller_id,
    p_target_user_id,
    'USER_STATUS_CHANGE',
    'success',
    p_reason_code,
    jsonb_build_object(
      'previous_status', COALESCE(v_current_status, 'active'),
      'new_status', p_status,
      'reason_details', p_reason_details
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'new_status', p_status
  );
END;
$$;

-- RPC: Manage Platform Roles (Grant or Revoke)
CREATE OR REPLACE FUNCTION public.admin_manage_role(
  p_target_user_id uuid,
  p_role text,
  p_action text -- 'grant' or 'revoke'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_active_super_admins int;
BEGIN
  v_caller_role := public.get_platform_admin_role(v_caller_id);
  
  IF v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Access Denied: Only super_admin can grant or revoke platform roles';
  END IF;

  IF p_action = 'grant' THEN
    INSERT INTO public.platform_admin_roles (
      user_id, role, is_active, granted_by, granted_at
    ) VALUES (
      p_target_user_id, p_role, true, v_caller_id, now()
    );

    PERFORM public.log_admin_action(
      v_caller_id,
      p_target_user_id,
      'ROLE_GRANTED',
      'success',
      'PLATFORM_RBAC_ASSIGNMENT',
      jsonb_build_object('role', p_role)
    );

  ELSIF p_action = 'revoke' THEN
    -- Invariant: Cannot revoke the last active super_admin
    IF p_role = 'super_admin' THEN
      SELECT COUNT(*) INTO v_active_super_admins
      FROM public.platform_admin_roles
      WHERE role = 'super_admin' AND is_active = true;

      IF v_active_super_admins <= 1 THEN
        PERFORM public.log_admin_action(
          v_caller_id,
          p_target_user_id,
          'ROLE_REVOKED',
          'denied',
          'CANNOT_REVOKE_LAST_SUPER_ADMIN',
          jsonb_build_object('target_role', p_role)
        );
        RAISE EXCEPTION 'Administrative Invariant: Cannot revoke the last active super_admin';
      END IF;
    END IF;

    UPDATE public.platform_admin_roles
    SET is_active = false,
        revoked_by = v_caller_id,
        revoked_at = now(),
        updated_at = now()
    WHERE user_id = p_target_user_id AND role = p_role AND is_active = true;

    PERFORM public.log_admin_action(
      v_caller_id,
      p_target_user_id,
      'ROLE_REVOKED',
      'success',
      'PLATFORM_RBAC_REMOVAL',
      jsonb_build_object('role', p_role)
    );
  ELSE
    RAISE EXCEPTION 'Invalid action: specify grant or revoke';
  END IF;

  RETURN jsonb_build_object('success', true, 'action', p_action, 'role', p_role);
END;
$$;

-- RPC: System Overview Dashboard Stats
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_users int;
  v_active_users int;
  v_suspended_users int;
  v_invited_users int;
  v_total_households int;
  v_total_audit_events int;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: Caller does not have platform administrative privileges';
  END IF;

  SELECT COUNT(*) INTO v_total_users FROM auth.users;

  SELECT 
    COUNT(*) FILTER (WHERE COALESCE(status, 'active') = 'active'),
    COUNT(*) FILTER (WHERE status = 'suspended'),
    COUNT(*) FILTER (WHERE status = 'invited')
  INTO v_active_users, v_suspended_users, v_invited_users
  FROM public.user_access_status;

  -- Add users without access status row to active count
  v_active_users := v_active_users + (v_total_users - (SELECT COUNT(*) FROM public.user_access_status));

  SELECT COUNT(*) INTO v_total_households FROM public.households;
  SELECT COUNT(*) INTO v_total_audit_events FROM public.admin_audit_logs;

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'active_users', v_active_users,
    'suspended_users', v_suspended_users,
    'invited_users', v_invited_users,
    'total_households', v_total_households,
    'total_audit_events', v_total_audit_events
  );
END;
$$;

-- RPC: Paginated Audit Log Explorer
CREATE OR REPLACE FUNCTION public.admin_get_audit_logs(
  p_page int DEFAULT 1,
  p_limit int DEFAULT 30,
  p_action text DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset int;
  v_total int;
  v_logs jsonb;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: Caller does not have platform administrative privileges';
  END IF;

  v_offset := (GREATEST(p_page, 1) - 1) * GREATEST(p_limit, 1);

  SELECT COUNT(*) INTO v_total
  FROM public.admin_audit_logs a
  WHERE (p_action IS NULL OR p_action = '' OR a.action = p_action)
    AND (p_target_user_id IS NULL OR a.target_user_id = p_target_user_id);

  SELECT jsonb_agg(row_to_json(t)) INTO v_logs
  FROM (
    SELECT 
      a.id,
      a.actor_user_id,
      COALESCE(pa.display_name, split_part(ua.email, '@', 1), 'System') AS actor_name,
      a.target_user_id,
      COALESCE(pt.display_name, split_part(ut.email, '@', 1), 'N/A') AS target_name,
      a.action,
      a.outcome,
      a.reason_code,
      a.ip_address,
      a.safe_metadata,
      a.created_at
    FROM public.admin_audit_logs a
    LEFT JOIN auth.users ua ON ua.id = a.actor_user_id
    LEFT JOIN public.profiles pa ON pa.id = a.actor_user_id
    LEFT JOIN auth.users ut ON ut.id = a.target_user_id
    LEFT JOIN public.profiles pt ON pt.id = a.target_user_id
    WHERE (p_action IS NULL OR p_action = '' OR a.action = p_action)
      AND (p_target_user_id IS NULL OR a.target_user_id = p_target_user_id)
    ORDER BY a.created_at DESC
    LIMIT p_limit OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'logs', COALESCE(v_logs, '[]'::jsonb),
    'total', v_total,
    'page', p_page,
    'limit', p_limit
  );
END;
$$;

-- RPC: Paginated Households Explorer
CREATE OR REPLACE FUNCTION public.admin_get_households(
  p_page int DEFAULT 1,
  p_limit int DEFAULT 20,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset int;
  v_total int;
  v_households jsonb;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: Caller does not have platform administrative privileges';
  END IF;

  v_offset := (GREATEST(p_page, 1) - 1) * GREATEST(p_limit, 1);

  SELECT COUNT(*) INTO v_total
  FROM public.households h
  WHERE (p_search IS NULL OR p_search = '' OR h.name ILIKE '%' || p_search || '%');

  SELECT jsonb_agg(row_to_json(t)) INTO v_households
  FROM (
    SELECT 
      h.id,
      h.name,
      h.created_at,
      COALESCE(p.display_name, split_part(u.email, '@', 1)) AS created_by_name,
      (SELECT COUNT(*) FROM public.household_members m WHERE m.household_id = h.id) AS member_count
    FROM public.households h
    LEFT JOIN auth.users u ON u.id = h.created_by
    LEFT JOIN public.profiles p ON p.id = h.created_by
    WHERE (p_search IS NULL OR p_search = '' OR h.name ILIKE '%' || p_search || '%')
    ORDER BY h.created_at DESC
    LIMIT p_limit OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'households', COALESCE(v_households, '[]'::jsonb),
    'total', v_total,
    'page', p_page,
    'limit', p_limit
  );
END;
$$;

-- 7. Seed Data: Bootstrap initial admin and household for investor@wealthnest.local
DO $$
DECLARE
  v_investor_id uuid := '4c4fa116-57d5-4fc8-af89-be56b5069b50';
  v_exists boolean;
  v_household_id uuid;
BEGIN
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = v_investor_id) INTO v_exists;

  IF v_exists THEN
    -- Ensure user_access_status is active
    INSERT INTO public.user_access_status (user_id, status, reason_code, reason_details)
    VALUES (v_investor_id, 'active', 'SYSTEM_BOOTSTRAP', 'Initial system administrator account')
    ON CONFLICT (user_id) DO NOTHING;

    -- Assign super_admin role
    INSERT INTO public.platform_admin_roles (user_id, role, is_active, granted_at)
    VALUES (v_investor_id, 'super_admin', true, now())
    ON CONFLICT DO NOTHING;

    -- Create default Vaghela Household tenant if not already present
    INSERT INTO public.households (id, name, created_by)
    VALUES ('a0000000-0000-0000-0000-000000000001'::uuid, 'Vaghela Household', v_investor_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.household_members (household_id, user_id, household_role)
    VALUES ('a0000000-0000-0000-0000-000000000001'::uuid, v_investor_id, 'primary_owner')
    ON CONFLICT DO NOTHING;

    -- Record initial bootstrap audit event
    INSERT INTO public.admin_audit_logs (
      actor_user_id,
      target_user_id,
      action,
      outcome,
      reason_code,
      safe_metadata
    ) VALUES (
      v_investor_id,
      v_investor_id,
      'SYSTEM_BOOTSTRAP',
      'success',
      'INITIAL_DEPLOYMENT',
      jsonb_build_object('note', 'Platform admin and Vaghela Household bootstrapped')
    );
  END IF;
END;
$$;
-- ==============================================================================
-- WealthNest Phase 8: Secure Support Impersonation / View-as-User Mode Migration
-- ==============================================================================

-- 1. Create Support Sessions Table
-- Tracks ephemeral, server-bound read-only support sessions initiated by administrators
CREATE TABLE IF NOT EXISTS public.admin_support_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_support_sessions_admin 
  ON public.admin_support_sessions (admin_user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_support_sessions_target 
  ON public.admin_support_sessions (target_user_id);

CREATE INDEX IF NOT EXISTS idx_support_sessions_expiry 
  ON public.admin_support_sessions (expires_at) 
  WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.admin_support_sessions ENABLE ROW LEVEL SECURITY;

-- Policies:
-- Only platform admins can view support sessions
DROP POLICY IF EXISTS "Platform admins view support sessions" ON public.admin_support_sessions;
CREATE POLICY "Platform admins view support sessions"
  ON public.admin_support_sessions FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

-- 2. Helper: Validate Active Support Session
-- Checks if the session exists, belongs to caller, is_active, and has not expired.
-- Returns target_user_id. Raises exception otherwise.
CREATE OR REPLACE FUNCTION public.validate_support_session(p_session_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_target_user_id uuid;
  v_is_active boolean;
  v_expires_at timestamptz;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Unauthenticated support request';
  END IF;

  SELECT target_user_id, is_active, expires_at
  INTO v_target_user_id, v_is_active, v_expires_at
  FROM public.admin_support_sessions
  WHERE id = p_session_id AND admin_user_id = v_admin_id;

  IF v_target_user_id IS NULL THEN
    PERFORM public.log_admin_action(
      v_admin_id,
      NULL,
      'SUPPORT_SESSION_DENIED',
      'denied',
      'SESSION_NOT_FOUND_OR_FORBIDDEN',
      jsonb_build_object('session_id', p_session_id)
    );
    RAISE EXCEPTION 'Access Denied: Support session not found or does not belong to caller';
  END IF;

  IF NOT v_is_active THEN
    PERFORM public.log_admin_action(
      v_admin_id,
      v_target_user_id,
      'SUPPORT_SESSION_DENIED',
      'denied',
      'SESSION_REVOKED',
      jsonb_build_object('session_id', p_session_id)
    );
    RAISE EXCEPTION 'Access Denied: Support session has been terminated or revoked';
  END IF;

  IF v_expires_at <= now() THEN
    -- Mark session expired in database
    UPDATE public.admin_support_sessions
    SET is_active = false, updated_at = now()
    WHERE id = p_session_id;

    PERFORM public.log_admin_action(
      v_admin_id,
      v_target_user_id,
      'SUPPORT_SESSION_EXPIRED',
      'denied',
      'SESSION_TIMED_OUT',
      jsonb_build_object('session_id', p_session_id, 'expired_at', v_expires_at)
    );
    RAISE EXCEPTION 'Access Denied: Support session has expired (15-minute maximum TTL reached)';
  END IF;

  RETURN v_target_user_id;
END;
$$;

-- 3. Stored Procedure: Start Support Session
CREATE OR REPLACE FUNCTION public.admin_start_support_session(
  p_target_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_admin_role text;
  v_target_name text;
  v_target_email text;
  v_session_id uuid;
  v_expires_at timestamptz;
BEGIN
  -- Verify caller is a platform administrator with support or super_admin role
  v_admin_role := public.get_platform_admin_role(v_admin_id);
  IF v_admin_role NOT IN ('super_admin', 'support_admin') THEN
    RAISE EXCEPTION 'Access Denied: Only super_admin or support_admin can initiate support sessions';
  END IF;

  -- Validate reason (minimum 8 characters required for audit completeness)
  IF p_reason IS NULL OR length(trim(p_reason)) < 8 THEN
    RAISE EXCEPTION 'Administrative Invariant: A documented support reason (min 8 chars or ticket reference) is required';
  END IF;

  -- Prohibit self-impersonation
  IF p_target_user_id = v_admin_id THEN
    RAISE EXCEPTION 'Administrative Invariant: Administrators cannot start support impersonation on their own account';
  END IF;

  -- Check target user exists
  SELECT 
    COALESCE(p.display_name, split_part(u.email, '@', 1)),
    u.email
  INTO v_target_name, v_target_email
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = p_target_user_id;

  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  -- Support admin cannot impersonate a super_admin
  IF v_admin_role = 'support_admin' AND public.get_platform_admin_role(p_target_user_id) = 'super_admin' THEN
    RAISE EXCEPTION 'Access Denied: Support admins cannot start support sessions for Super Administrators';
  END IF;

  -- Auto-revoke any existing active support sessions for this administrator
  UPDATE public.admin_support_sessions
  SET is_active = false,
      revoked_at = now(),
      revoked_by = v_admin_id,
      updated_at = now()
  WHERE admin_user_id = v_admin_id AND is_active = true;

  -- Set session expiry to 15 minutes from now
  v_expires_at := now() + INTERVAL '15 minutes';

  -- Create new support session
  INSERT INTO public.admin_support_sessions (
    admin_user_id,
    target_user_id,
    reason,
    is_active,
    expires_at
  ) VALUES (
    v_admin_id,
    p_target_user_id,
    trim(p_reason),
    true,
    v_expires_at
  ) RETURNING id INTO v_session_id;

  -- Append audit log
  PERFORM public.log_admin_action(
    v_admin_id,
    p_target_user_id,
    'SUPPORT_SESSION_START',
    'success',
    'SUPPORT_INVESTIGATION',
    jsonb_build_object(
      'session_id', v_session_id,
      'reason', trim(p_reason),
      'expires_at', v_expires_at,
      'target_email', v_target_email
    )
  );

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'target_user_id', p_target_user_id,
    'target_name', v_target_name,
    'target_email', v_target_email,
    'expires_at', v_expires_at
  );
END;
$$;

-- 4. Stored Procedure: End / Revoke Support Session
CREATE OR REPLACE FUNCTION public.admin_end_support_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_target_user_id uuid;
BEGIN
  SELECT target_user_id INTO v_target_user_id
  FROM public.admin_support_sessions
  WHERE id = p_session_id AND admin_user_id = v_admin_id;

  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Support session not found or does not belong to caller';
  END IF;

  UPDATE public.admin_support_sessions
  SET is_active = false,
      revoked_at = now(),
      revoked_by = v_admin_id,
      updated_at = now()
  WHERE id = p_session_id;

  PERFORM public.log_admin_action(
    v_admin_id,
    v_target_user_id,
    'SUPPORT_SESSION_ENDED',
    'success',
    'ADMIN_TERMINATED',
    jsonb_build_object('session_id', p_session_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'revoked_at', now()
  );
END;
$$;

-- 5. Read-Only Query Procedures (Strict Read-Only Access Bound to Validated Session)

-- 5.1 Read-Only Portfolio Holdings
CREATE OR REPLACE FUNCTION public.support_get_user_portfolio(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user_id uuid;
  v_holdings jsonb;
BEGIN
  v_target_user_id := public.validate_support_session(p_session_id);

  SELECT jsonb_agg(row_to_json(t)) INTO v_holdings
  FROM (
    SELECT 
      h.id,
      h.asset_id,
      a.name AS asset_name,
      a.symbol,
      ac.name AS asset_class_name,
      ac.id AS asset_class_id,
      h.quantity,
      h.cost_basis_cents,
      h.current_value_cents,
      h.currency,
      h.member_id,
      fm.name AS member_name,
      h.account_id,
      pa.account_name,
      pa.broker_name,
      h.updated_at
    FROM public.holdings h
    JOIN public.assets a ON a.id = h.asset_id
    JOIN public.asset_classes ac ON ac.id = a.asset_class_id
    LEFT JOIN public.family_members fm ON fm.id = h.member_id
    LEFT JOIN public.portfolio_accounts pa ON pa.id = h.account_id
    WHERE h.user_id = v_target_user_id
    ORDER BY h.current_value_cents DESC
  ) t;

  RETURN jsonb_build_object(
    'target_user_id', v_target_user_id,
    'holdings', COALESCE(v_holdings, '[]'::jsonb)
  );
END;
$$;

-- 5.2 Read-Only Liabilities & Loans
CREATE OR REPLACE FUNCTION public.support_get_user_liabilities(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user_id uuid;
  v_liabilities jsonb;
BEGIN
  v_target_user_id := public.validate_support_session(p_session_id);

  SELECT jsonb_agg(row_to_json(t)) INTO v_liabilities
  FROM (
    SELECT 
      l.id,
      l.name,
      l.liability_type,
      l.original_principal_cents,
      l.interest_rate,
      l.start_date,
      l.tenure_months,
      l.monthly_payment_cents,
      l.outstanding_balance_cents,
      l.member_id,
      fm.name AS primary_borrower_name,
      l.co_borrower_ids,
      l.status,
      l.created_at
    FROM public.liabilities l
    LEFT JOIN public.family_members fm ON fm.id = l.member_id
    WHERE l.user_id = v_target_user_id
    ORDER BY l.created_at DESC
  ) t;

  RETURN jsonb_build_object(
    'target_user_id', v_target_user_id,
    'liabilities', COALESCE(v_liabilities, '[]'::jsonb)
  );
END;
$$;

-- 5.3 Read-Only Financial Goals
CREATE OR REPLACE FUNCTION public.support_get_user_goals(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user_id uuid;
  v_goals jsonb;
BEGIN
  v_target_user_id := public.validate_support_session(p_session_id);

  SELECT jsonb_agg(row_to_json(t)) INTO v_goals
  FROM (
    SELECT 
      g.id,
      g.name,
      g.target_amount_cents,
      g.target_date,
      g.current_amount_cents,
      g.category,
      g.priority,
      g.member_id,
      fm.name AS beneficiary_name,
      g.notes,
      g.created_at
    FROM public.goals g
    LEFT JOIN public.family_members fm ON fm.id = g.member_id
    WHERE g.user_id = v_target_user_id
    ORDER BY g.created_at DESC
  ) t;

  RETURN jsonb_build_object(
    'target_user_id', v_target_user_id,
    'goals', COALESCE(v_goals, '[]'::jsonb)
  );
END;
$$;

-- 5.4 Read-Only Transactions Ledger
CREATE OR REPLACE FUNCTION public.support_get_user_transactions(
  p_session_id uuid,
  p_limit int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user_id uuid;
  v_transactions jsonb;
BEGIN
  v_target_user_id := public.validate_support_session(p_session_id);

  SELECT jsonb_agg(row_to_json(t)) INTO v_transactions
  FROM (
    SELECT 
      tr.id,
      tr.transaction_type,
      tr.transaction_date,
      tr.quantity,
      tr.unit_price_cents,
      tr.total_amount_cents,
      tr.currency,
      a.name AS asset_name,
      a.symbol,
      fm.name AS member_name,
      pa.account_name,
      tr.notes,
      tr.created_at
    FROM public.transactions tr
    JOIN public.assets a ON a.id = tr.asset_id
    LEFT JOIN public.family_members fm ON fm.id = tr.member_id
    LEFT JOIN public.portfolio_accounts pa ON pa.id = tr.account_id
    WHERE tr.user_id = v_target_user_id
    ORDER BY tr.transaction_date DESC
    LIMIT p_limit
  ) t;

  RETURN jsonb_build_object(
    'target_user_id', v_target_user_id,
    'transactions', COALESCE(v_transactions, '[]'::jsonb)
  );
END;
$$;

-- 5.5 Read-Only Summary Aggregates (Integer Paise Math)
CREATE OR REPLACE FUNCTION public.support_get_user_summary(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user_id uuid;
  v_profile jsonb;
  v_total_assets_cents bigint := 0;
  v_total_debt_cents bigint := 0;
  v_net_worth_cents bigint := 0;
  v_holdings_count int := 0;
  v_liabilities_count int := 0;
  v_goals_count int := 0;
BEGIN
  v_target_user_id := public.validate_support_session(p_session_id);

  -- Profile metadata
  SELECT jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'display_name', COALESCE(p.display_name, split_part(u.email, '@', 1)),
    'default_currency', COALESCE(p.default_currency, 'INR'),
    'created_at', u.created_at
  ) INTO v_profile
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = v_target_user_id;

  -- Assets aggregate
  SELECT 
    COALESCE(SUM(current_value_cents), 0),
    COUNT(*)
  INTO v_total_assets_cents, v_holdings_count
  FROM public.holdings
  WHERE user_id = v_target_user_id;

  -- Debt aggregate
  SELECT 
    COALESCE(SUM(outstanding_balance_cents), 0),
    COUNT(*)
  INTO v_total_debt_cents, v_liabilities_count
  FROM public.liabilities
  WHERE user_id = v_target_user_id AND status = 'active';

  -- Net worth
  v_net_worth_cents := v_total_assets_cents - v_total_debt_cents;

  -- Goals count
  SELECT COUNT(*) INTO v_goals_count
  FROM public.goals
  WHERE user_id = v_target_user_id;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'total_assets_cents', v_total_assets_cents,
    'total_debt_cents', v_total_debt_cents,
    'net_worth_cents', v_net_worth_cents,
    'holdings_count', v_holdings_count,
    'liabilities_count', v_liabilities_count,
    'goals_count', v_goals_count
  );
END;
$$;
