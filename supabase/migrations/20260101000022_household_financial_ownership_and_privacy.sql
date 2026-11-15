-- ==============================================================================
-- WealthNest Phase 18A Part 2 (Phase 3):
-- Financial Table Tenant Scoping (household_id), Explicit Visibility,
-- Joint Ownership (holding_owners / liability_parties), & Integrity Triggers
-- ==============================================================================
-- Implements Approved Product Decisions #10, #11, #12, #14:
--   * Every financial/vault table is strictly scoped by NOT NULL household_id
--   * Explicit visibility ('household_shared' | 'owner_only' | 'restricted')
--   * Joint ownership via holding_owners (DEFERRABLE SUM = 100.0000 check)
--   * Co-borrowing & guarantor parties via liability_parties (DEFERRABLE SUM = 100.0000)
--   * Drops liabilities.co_borrower_ids UUID[] hack and auth.users CASCADE FKs
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Remove auth.users CASCADE Foreign Keys & Make Legacy user_id Nullable
--    (user_id columns will be dropped in Phase 4 immediately after replacing
--     legacy RLS policies and RPCs that still reference them)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  fk record;
  tbl text;
  target_tables text[] := ARRAY[
    'family_members',
    'portfolio_accounts',
    'assets',
    'holdings',
    'transactions',
    'import_batches',
    'asset_valuations',
    'liabilities',
    'liability_balances',
    'asset_liability_links',
    'loan_payments',
    'goals',
    'goal_holding_allocations',
    'family_documents'
  ];
BEGIN
  FOREACH tbl IN ARRAY target_tables LOOP
    FOR fk IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(c.conkey)
      WHERE ns.nspname = 'public'
        AND rel.relname = tbl
        AND c.contype = 'f'
        AND att.attname = 'user_id'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', tbl, fk.conname);
    END LOOP;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'user_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id DROP NOT NULL', tbl);
    END IF;
  END LOOP;
END;
$$;

-- Drop obsolete single-user unique constraints / user-scoped indexes
ALTER TABLE public.holdings DROP CONSTRAINT IF EXISTS unique_user_asset;
ALTER TABLE public.asset_valuations DROP CONSTRAINT IF EXISTS unique_user_asset_valuation_date;
DROP INDEX IF EXISTS public.idx_assets_user_isin;
DROP INDEX IF EXISTS public.idx_holdings_user_asset_account;
DROP INDEX IF EXISTS public.idx_holdings_folio;
DROP INDEX IF EXISTS public.idx_holdings_demat;
DROP INDEX IF EXISTS public.idx_asset_valuations_user_date;
DROP INDEX IF EXISTS public.idx_liabilities_user_status;
DROP INDEX IF EXISTS public.idx_liability_balances_user_date;
DROP INDEX IF EXISTS public.idx_goals_user_category;
DROP INDEX IF EXISTS public.idx_goals_user_target_date;
DROP INDEX IF EXISTS public.idx_family_documents_user_cat;
DROP INDEX IF EXISTS public.idx_family_documents_member;

-- ------------------------------------------------------------------------------
-- 2. Evolve All 13 Financial & Vault Tables to household_id + visibility
-- ------------------------------------------------------------------------------

-- 2.1 portfolio_accounts
ALTER TABLE public.portfolio_accounts
  ADD COLUMN IF NOT EXISTS household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'household_shared',
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.portfolio_accounts DROP CONSTRAINT IF EXISTS portfolio_accounts_visibility_check;
ALTER TABLE public.portfolio_accounts
  ADD CONSTRAINT portfolio_accounts_visibility_check
  CHECK (visibility IN ('household_shared', 'owner_only', 'restricted'));

CREATE INDEX IF NOT EXISTS idx_portfolio_accounts_household
  ON public.portfolio_accounts (household_id, member_id);

-- 2.2 assets
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'household_shared',
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_visibility_check;
ALTER TABLE public.assets
  ADD CONSTRAINT assets_visibility_check
  CHECK (visibility IN ('household_shared', 'owner_only', 'restricted'));

CREATE INDEX IF NOT EXISTS idx_assets_household_isin
  ON public.assets (household_id, isin) WHERE isin IS NOT NULL;

-- 2.3 holdings
ALTER TABLE public.holdings
  ADD COLUMN IF NOT EXISTS household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'household_shared',
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.holdings DROP CONSTRAINT IF EXISTS holdings_visibility_check;
ALTER TABLE public.holdings
  ADD CONSTRAINT holdings_visibility_check
  CHECK (visibility IN ('household_shared', 'owner_only', 'restricted'));

CREATE UNIQUE INDEX IF NOT EXISTS uniq_holdings_household_asset_scope
  ON public.holdings (
    household_id,
    asset_id,
    COALESCE(account_id::text, ''),
    COALESCE(member_id::text, ''),
    COALESCE(folio_number, ''),
    COALESCE(demat_account_id, '')
  );

CREATE INDEX IF NOT EXISTS idx_holdings_household_member
  ON public.holdings (household_id, member_id, account_id);

-- 2.4 transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'household_shared',
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_visibility_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_visibility_check
  CHECK (visibility IN ('household_shared', 'owner_only', 'restricted'));

CREATE INDEX IF NOT EXISTS idx_transactions_household_date
  ON public.transactions (household_id, transaction_date DESC);

-- 2.5 import_batches
ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.family_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'household_shared',
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.import_batches DROP CONSTRAINT IF EXISTS import_batches_visibility_check;
ALTER TABLE public.import_batches
  ADD CONSTRAINT import_batches_visibility_check
  CHECK (visibility IN ('household_shared', 'owner_only', 'restricted'));

CREATE INDEX IF NOT EXISTS idx_import_batches_household_created
  ON public.import_batches (household_id, created_at DESC);

-- 2.6 asset_valuations
ALTER TABLE public.asset_valuations
  ADD COLUMN IF NOT EXISTS household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.asset_valuations
  DROP CONSTRAINT IF EXISTS unique_asset_valuation_date;

ALTER TABLE public.asset_valuations
  ADD CONSTRAINT unique_asset_valuation_date UNIQUE (asset_id, as_of_date);

CREATE INDEX IF NOT EXISTS idx_asset_valuations_household_date
  ON public.asset_valuations (household_id, as_of_date DESC);

-- 2.7 liabilities
ALTER TABLE public.liabilities
  ADD COLUMN IF NOT EXISTS household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'household_shared',
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.liabilities
  DROP COLUMN IF EXISTS co_borrower_ids;

ALTER TABLE public.liabilities DROP CONSTRAINT IF EXISTS liabilities_visibility_check;
ALTER TABLE public.liabilities
  ADD CONSTRAINT liabilities_visibility_check
  CHECK (visibility IN ('household_shared', 'owner_only', 'restricted'));

CREATE INDEX IF NOT EXISTS idx_liabilities_household_status
  ON public.liabilities (household_id, status);

-- 2.8 liability_balances
ALTER TABLE public.liability_balances
  ADD COLUMN IF NOT EXISTS household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_liability_balances_household_date
  ON public.liability_balances (household_id, as_of_date DESC);

-- 2.9 asset_liability_links
ALTER TABLE public.asset_liability_links
  ADD COLUMN IF NOT EXISTS household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_asset_liability_links_household
  ON public.asset_liability_links (household_id);

-- 2.10 loan_payments
ALTER TABLE public.loan_payments
  ADD COLUMN IF NOT EXISTS household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_loan_payments_household_date
  ON public.loan_payments (household_id, payment_date DESC);

-- 2.11 goals
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'household_shared',
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_visibility_check;
ALTER TABLE public.goals
  ADD CONSTRAINT goals_visibility_check
  CHECK (visibility IN ('household_shared', 'owner_only', 'restricted'));

CREATE INDEX IF NOT EXISTS idx_goals_household_category
  ON public.goals (household_id, category);

CREATE INDEX IF NOT EXISTS idx_goals_household_target_date
  ON public.goals (household_id, target_date ASC);

-- 2.12 goal_holding_allocations
ALTER TABLE public.goal_holding_allocations
  ADD COLUMN IF NOT EXISTS household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_goal_holding_allocations_household
  ON public.goal_holding_allocations (household_id);

-- 2.13 family_documents
ALTER TABLE public.family_documents
  ADD COLUMN IF NOT EXISTS household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'household_shared',
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.family_documents DROP CONSTRAINT IF EXISTS family_documents_visibility_check;
ALTER TABLE public.family_documents
  ADD CONSTRAINT family_documents_visibility_check
  CHECK (visibility IN ('household_shared', 'owner_only', 'restricted'));

CREATE INDEX IF NOT EXISTS idx_family_documents_household_cat
  ON public.family_documents (household_id, category);

CREATE INDEX IF NOT EXISTS idx_family_documents_household_member
  ON public.family_documents (household_id, member_id);

-- ------------------------------------------------------------------------------
-- 3. Joint Ownership, Co-Borrower Parties, and Restricted Record Grants
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.holding_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  holding_id uuid NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  family_member_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  ownership_share numeric(7, 4) NOT NULL CHECK (ownership_share > 0 AND ownership_share <= 100),
  is_primary_owner boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (holding_id, family_member_id)
);

CREATE INDEX IF NOT EXISTS idx_holding_owners_holding ON public.holding_owners (holding_id);
CREATE INDEX IF NOT EXISTS idx_holding_owners_member ON public.holding_owners (family_member_id);
CREATE INDEX IF NOT EXISTS idx_holding_owners_household ON public.holding_owners (household_id);

CREATE TABLE IF NOT EXISTS public.liability_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  liability_id uuid NOT NULL REFERENCES public.liabilities(id) ON DELETE CASCADE,
  family_member_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  party_role text NOT NULL CHECK (party_role IN ('primary_borrower', 'co_borrower', 'guarantor')),
  liability_share numeric(7, 4) NOT NULL CHECK (liability_share >= 0 AND liability_share <= 100),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (liability_id, family_member_id)
);

CREATE INDEX IF NOT EXISTS idx_liability_parties_liability ON public.liability_parties (liability_id);
CREATE INDEX IF NOT EXISTS idx_liability_parties_member ON public.liability_parties (family_member_id);
CREATE INDEX IF NOT EXISTS idx_liability_parties_household ON public.liability_parties (household_id);

CREATE TABLE IF NOT EXISTS public.restricted_record_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  record_type text NOT NULL CHECK (
    record_type IN (
      'portfolio_account',
      'asset',
      'holding',
      'transaction',
      'import_batch',
      'liability',
      'goal',
      'family_document'
    )
  ),
  record_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('view', 'manage')),
  granted_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (record_type, record_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_restricted_record_grants_lookup
  ON public.restricted_record_grants (record_type, record_id, user_id);

-- ------------------------------------------------------------------------------
-- 4. Cross-Household Referential Integrity & Ownership Math Triggers
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_same_household_fk(
  p_expected_household_id uuid,
  p_table text,
  p_fk_id uuid,
  p_col_label text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actual_household_id uuid;
BEGIN
  IF p_fk_id IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format('SELECT household_id FROM public.%I WHERE id = $1', p_table)
    INTO v_actual_household_id
    USING p_fk_id;

  IF v_actual_household_id IS NULL OR v_actual_household_id IS DISTINCT FROM p_expected_household_id THEN
    RAISE EXCEPTION 'Cross-household integrity violation: % (%) does not belong to household %',
      p_col_label, p_fk_id, p_expected_household_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_financial_row_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.household_id IS DISTINCT FROM OLD.household_id THEN
    RAISE EXCEPTION 'Financial records cannot move between households';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  END IF;

  IF TG_TABLE_NAME IN ('portfolio_accounts', 'assets', 'holdings', 'liabilities', 'asset_valuations', 'goals', 'family_documents') THEN
    NEW.updated_at := timezone('utc'::text, now());
  END IF;

  -- Table-specific cross-household foreign key validation
  IF TG_TABLE_NAME = 'portfolio_accounts' THEN
    PERFORM public.assert_same_household_fk(NEW.household_id, 'family_members', NEW.member_id, 'member_id');

  ELSIF TG_TABLE_NAME = 'holdings' THEN
    PERFORM public.assert_same_household_fk(NEW.household_id, 'assets', NEW.asset_id, 'asset_id');
    PERFORM public.assert_same_household_fk(NEW.household_id, 'family_members', NEW.member_id, 'member_id');
    PERFORM public.assert_same_household_fk(NEW.household_id, 'portfolio_accounts', NEW.account_id, 'account_id');

  ELSIF TG_TABLE_NAME = 'transactions' THEN
    PERFORM public.assert_same_household_fk(NEW.household_id, 'assets', NEW.asset_id, 'asset_id');
    PERFORM public.assert_same_household_fk(NEW.household_id, 'family_members', NEW.member_id, 'member_id');
    PERFORM public.assert_same_household_fk(NEW.household_id, 'portfolio_accounts', NEW.account_id, 'account_id');
    PERFORM public.assert_same_household_fk(NEW.household_id, 'portfolio_accounts', NEW.destination_account_id, 'destination_account_id');

  ELSIF TG_TABLE_NAME = 'import_batches' THEN
    PERFORM public.assert_same_household_fk(NEW.household_id, 'family_members', NEW.member_id, 'member_id');

  ELSIF TG_TABLE_NAME = 'asset_valuations' THEN
    PERFORM public.assert_same_household_fk(NEW.household_id, 'assets', NEW.asset_id, 'asset_id');

  ELSIF TG_TABLE_NAME = 'liabilities' THEN
    PERFORM public.assert_same_household_fk(NEW.household_id, 'family_members', NEW.member_id, 'member_id');
    PERFORM public.assert_same_household_fk(NEW.household_id, 'assets', NEW.linked_asset_id, 'linked_asset_id');

  ELSIF TG_TABLE_NAME = 'liability_balances' THEN
    PERFORM public.assert_same_household_fk(NEW.household_id, 'liabilities', NEW.liability_id, 'liability_id');

  ELSIF TG_TABLE_NAME = 'asset_liability_links' THEN
    PERFORM public.assert_same_household_fk(NEW.household_id, 'assets', NEW.asset_id, 'asset_id');
    PERFORM public.assert_same_household_fk(NEW.household_id, 'liabilities', NEW.liability_id, 'liability_id');

  ELSIF TG_TABLE_NAME = 'loan_payments' THEN
    PERFORM public.assert_same_household_fk(NEW.household_id, 'liabilities', NEW.liability_id, 'liability_id');
    PERFORM public.assert_same_household_fk(NEW.household_id, 'transactions', NEW.transaction_id, 'transaction_id');

  ELSIF TG_TABLE_NAME = 'goals' THEN
    PERFORM public.assert_same_household_fk(NEW.household_id, 'family_members', NEW.member_id, 'member_id');

  ELSIF TG_TABLE_NAME = 'goal_holding_allocations' THEN
    PERFORM public.assert_same_household_fk(NEW.household_id, 'goals', NEW.goal_id, 'goal_id');
    PERFORM public.assert_same_household_fk(NEW.household_id, 'holdings', NEW.holding_id, 'holding_id');

  ELSIF TG_TABLE_NAME = 'family_documents' THEN
    PERFORM public.assert_same_household_fk(NEW.household_id, 'family_members', NEW.member_id, 'member_id');
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl text;
  validated_tables text[] := ARRAY[
    'portfolio_accounts',
    'assets',
    'holdings',
    'transactions',
    'import_batches',
    'asset_valuations',
    'liabilities',
    'liability_balances',
    'asset_liability_links',
    'loan_payments',
    'goals',
    'goal_holding_allocations',
    'family_documents'
  ];
BEGIN
  FOREACH tbl IN ARRAY validated_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_validate_financial_row ON public.%I', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_validate_financial_row BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.validate_financial_row_integrity()',
      tbl
    );
  END LOOP;
END;
$$;

-- Cross-household triggers for joint ownership and restricted grants
CREATE OR REPLACE FUNCTION public.validate_holding_owner_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_same_household_fk(NEW.household_id, 'holdings', NEW.holding_id, 'holding_id');
  PERFORM public.assert_same_household_fk(NEW.household_id, 'family_members', NEW.family_member_id, 'family_member_id');
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_holding_owner_row ON public.holding_owners;
CREATE TRIGGER trg_validate_holding_owner_row
  BEFORE INSERT OR UPDATE ON public.holding_owners
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_holding_owner_row();

CREATE OR REPLACE FUNCTION public.validate_liability_party_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_same_household_fk(NEW.household_id, 'liabilities', NEW.liability_id, 'liability_id');
  PERFORM public.assert_same_household_fk(NEW.household_id, 'family_members', NEW.family_member_id, 'family_member_id');
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_liability_party_row ON public.liability_parties;
CREATE TRIGGER trg_validate_liability_party_row
  BEFORE INSERT OR UPDATE ON public.liability_parties
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_liability_party_row();

CREATE OR REPLACE FUNCTION public.validate_restricted_record_grant_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.household_members hm
    WHERE hm.household_id = NEW.household_id
      AND hm.user_id = NEW.user_id
      AND hm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Restricted grant recipient must be an active member of the record household';
  END IF;

  v_table_name := CASE NEW.record_type
    WHEN 'portfolio_account' THEN 'portfolio_accounts'
    WHEN 'asset' THEN 'assets'
    WHEN 'holding' THEN 'holdings'
    WHEN 'transaction' THEN 'transactions'
    WHEN 'import_batch' THEN 'import_batches'
    WHEN 'liability' THEN 'liabilities'
    WHEN 'goal' THEN 'goals'
    WHEN 'family_document' THEN 'family_documents'
    ELSE NULL
  END;

  PERFORM public.assert_same_household_fk(NEW.household_id, v_table_name, NEW.record_id, 'record_id');

  IF TG_OP = 'INSERT' THEN
    NEW.granted_by := COALESCE(auth.uid(), NEW.granted_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_restricted_record_grant_row ON public.restricted_record_grants;
CREATE TRIGGER trg_validate_restricted_record_grant_row
  BEFORE INSERT OR UPDATE ON public.restricted_record_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_restricted_record_grant_row();

-- Deferred Ownership Share Sum (= 100.0000%) Constraint Triggers
CREATE OR REPLACE FUNCTION public.enforce_holding_owners_sum_100()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_holding_id uuid;
  v_parent_exists boolean;
  v_count int;
  v_sum numeric;
BEGIN
  v_holding_id := COALESCE(NEW.holding_id, OLD.holding_id);

  SELECT EXISTS (SELECT 1 FROM public.holdings WHERE id = v_holding_id)
  INTO v_parent_exists;

  -- Skip check if parent holding itself was deleted (CASCADE cleanup)
  IF NOT v_parent_exists THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(ownership_share), 0)
  INTO v_count, v_sum
  FROM public.holding_owners
  WHERE holding_id = v_holding_id;

  IF v_count > 0 AND v_sum <> 100 THEN
    RAISE EXCEPTION 'Joint ownership shares for holding % must sum to 100%% (got % percent)', v_holding_id, v_sum;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_holding_owners_sum_100 ON public.holding_owners;
CREATE CONSTRAINT TRIGGER trg_enforce_holding_owners_sum_100
  AFTER INSERT OR UPDATE OR DELETE ON public.holding_owners
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_holding_owners_sum_100();

CREATE OR REPLACE FUNCTION public.enforce_liability_parties_sum_100()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_liability_id uuid;
  v_parent_exists boolean;
  v_count int;
  v_sum numeric;
BEGIN
  v_liability_id := COALESCE(NEW.liability_id, OLD.liability_id);

  SELECT EXISTS (SELECT 1 FROM public.liabilities WHERE id = v_liability_id)
  INTO v_parent_exists;

  IF NOT v_parent_exists THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(liability_share), 0)
  INTO v_count, v_sum
  FROM public.liability_parties
  WHERE liability_id = v_liability_id;

  IF v_count > 0 AND v_sum <> 100 THEN
    RAISE EXCEPTION 'Joint liability shares for liability % must sum to 100%% (got % percent)', v_liability_id, v_sum;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_liability_parties_sum_100 ON public.liability_parties;
CREATE CONSTRAINT TRIGGER trg_enforce_liability_parties_sum_100
  AFTER INSERT OR UPDATE OR DELETE ON public.liability_parties
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_liability_parties_sum_100();

REVOKE ALL ON FUNCTION public.assert_same_household_fk(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_financial_row_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_holding_owner_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_liability_party_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_restricted_record_grant_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_holding_owners_sum_100() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_liability_parties_sum_100() FROM PUBLIC, anon, authenticated;
