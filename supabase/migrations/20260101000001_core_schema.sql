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

-- Seed standard institutional asset classes
INSERT INTO public.asset_classes (id, name, description, color_hex, display_order)
VALUES
  ('cash', 'Cash & Equivalents', 'Checking, savings accounts, money market funds', '#10b981', 1),
  ('equity', 'Equities & Stocks', 'Publicly traded equities, index funds, and ETFs', '#3b82f6', 2),
  ('fixed_income', 'Fixed Income & Bonds', 'Government bonds, corporate notes, certificates of deposit', '#8b5cf6', 3),
  ('real_estate', 'Real Estate', 'Primary residence, rental property, REITs', '#f59e0b', 4),
  ('crypto', 'Digital Assets & Crypto', 'Major cryptocurrencies and decentralized tokens', '#ec4899', 5),
  ('commodity', 'Commodities', 'Gold, precious metals, and tangible commodities', '#eab308', 6),
  ('alternative', 'Alternative Assets', 'Private equity, venture funds, collectibles', '#6366f1', 7)
ON CONFLICT (id) DO NOTHING;

-- 3. Assets Table (User asset definitions)
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  ticker text,
  asset_class_id text NOT NULL REFERENCES public.asset_classes(id),
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Holdings Table (Quantities and integer cents valuations)
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
  currency text NOT NULL DEFAULT 'USD',
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
