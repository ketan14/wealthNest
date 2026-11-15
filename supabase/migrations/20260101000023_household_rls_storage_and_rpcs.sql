-- ==============================================================================
-- WealthNest Phase 18A Part 2 (Phase 4):
-- Non-Recursive Ownership/Privacy RLS, Private Vault Storage Policies,
-- Joint Split RPCs, and Household-Aware Support/Admin RPCs
-- ==============================================================================
-- Implements Approved Product Decisions #8–#14:
--   * Administrators & owners CANNOT automatically view 'owner_only' or
--     'restricted' records belonging to linked family members
--   * Linked members manage their own permitted financial records
--   * Joint ownership visibility & write checks span holding_owners & liability_parties
--   * 'family-vault' Storage bucket migrated from <user_id>/<doc>/<file> to
--     <household_id>/<document_id>/<file> with document-level privacy check
--   * Legacy user_id columns dropped completely from financial & vault tables
--   * Support session RPCs fixed and scoped to active target household visibility
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Drop Legacy Financial / Vault / Storage RLS Policies & Deprecated Helpers
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
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
        'family_documents',
        'holding_owners',
        'liability_parties',
        'restricted_record_grants'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "Household members can read family-vault objects" ON storage.objects;
DROP POLICY IF EXISTS "Household editors can upload family-vault objects" ON storage.objects;
DROP POLICY IF EXISTS "Household editors can update family-vault objects" ON storage.objects;
DROP POLICY IF EXISTS "Household editors can delete family-vault objects" ON storage.objects;

DROP FUNCTION IF EXISTS public.is_same_household(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_edit_household_record(uuid, uuid);

-- Drop legacy user_id columns cleanly now that policies depending on them are removed
DO $$
DECLARE
  tbl text;
  legacy_tables text[] := ARRAY[
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
  FOREACH tbl IN ARRAY legacy_tables LOOP
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS user_id', tbl);
  END LOOP;
END;
$$;

-- Ensure all public financial tables enforce RLS and block anon completely
DO $$
DECLARE
  tbl text;
  all_fin_tables text[] := ARRAY[
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
    'family_documents',
    'holding_owners',
    'liability_parties',
    'restricted_record_grants'
  ];
BEGIN
  FOREACH tbl IN ARRAY all_fin_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, PUBLIC', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tbl);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tbl);
  END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Canonical Ownership & Privacy Evaluation Functions (Non-Recursive)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.try_parse_uuid(p_text text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_text IS NULL OR length(trim(p_text)) = 0 THEN
    RETURN NULL;
  END IF;
  RETURN trim(p_text)::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Checks whether p_user_id is the linked person or holds active delegation
CREATE OR REPLACE FUNCTION public.can_act_for_family_member(
  p_household_id uuid,
  p_family_member_id uuid,
  p_user_id uuid DEFAULT auth.uid(),
  p_permission text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_household_id IS NULL OR p_family_member_id IS NULL OR p_user_id IS NULL THEN false
    WHEN NOT public.is_household_member(p_household_id, p_user_id) THEN false
    WHEN p_permission = 'manage' AND public.get_household_role(p_household_id, p_user_id) = 'viewer' THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.family_members fm
      WHERE fm.id = p_family_member_id
        AND fm.household_id = p_household_id
        AND (
          fm.linked_user_id = p_user_id
          OR EXISTS (
            SELECT 1
            FROM public.family_member_access fma
            WHERE fma.household_id = p_household_id
              AND fma.family_member_id = fm.id
              AND fma.user_id = p_user_id
              AND (fma.expires_at IS NULL OR fma.expires_at > timezone('utc'::text, now()))
              AND (p_permission = 'view' OR fma.permission = 'manage')
          )
        )
    )
  END;
$$;

-- Helper: checks whether a single family_member entity is unlinked
CREATE OR REPLACE FUNCTION public.is_family_member_unlinked(
  p_household_id uuid,
  p_family_member_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_family_member_id IS NULL THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.family_members fm
      WHERE fm.id = p_family_member_id
        AND fm.household_id = p_household_id
        AND fm.linked_user_id IS NULL
    )
  END;
$$;

-- Core visibility + ownership evaluator for standard member-scoped records
CREATE OR REPLACE FUNCTION public.can_access_household_record(
  p_household_id uuid,
  p_record_type text,
  p_record_id uuid,
  p_visibility text,
  p_member_id uuid,
  p_created_by uuid,
  p_user_id uuid DEFAULT auth.uid(),
  p_mode text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_perm text := CASE WHEN p_mode = 'edit' THEN 'manage' ELSE 'view' END;
  v_has_explicit_grant boolean;
BEGIN
  IF p_household_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  v_role := public.get_household_role(p_household_id, p_user_id);
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF p_mode = 'edit' AND v_role = 'viewer' THEN
    RETURN false;
  END IF;

  IF p_visibility = 'household_shared' THEN
    IF p_mode = 'view' THEN
      RETURN true;
    END IF;
    RETURN v_role IN ('primary_owner', 'admin', 'member');
  END IF;

  -- Check direct member ownership or explicit member delegation
  IF p_member_id IS NOT NULL AND public.can_act_for_family_member(p_household_id, p_member_id, p_user_id, v_perm) THEN
    RETURN true;
  END IF;

  -- Unlinked or unassigned private records remain accessible to their creator only until linked
  IF (p_member_id IS NULL OR public.is_family_member_unlinked(p_household_id, p_member_id))
     AND p_created_by = p_user_id THEN
    RETURN true;
  END IF;

  IF p_visibility = 'restricted' AND p_record_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.restricted_record_grants rrg
      WHERE rrg.household_id = p_household_id
        AND rrg.record_type = p_record_type
        AND rrg.record_id = p_record_id
        AND rrg.user_id = p_user_id
        AND (p_mode = 'view' OR rrg.permission = 'manage')
    ) INTO v_has_explicit_grant;

    RETURN COALESCE(v_has_explicit_grant, false);
  END IF;

  RETURN false;
END;
$$;

-- Holding access evaluator (supports holding_owners joint ownership + parent account privacy)
CREATE OR REPLACE FUNCTION public.can_access_holding_row(
  p_holding_id uuid,
  p_household_id uuid,
  p_visibility text,
  p_member_id uuid,
  p_account_id uuid,
  p_created_by uuid,
  p_user_id uuid DEFAULT auth.uid(),
  p_mode text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_perm text := CASE WHEN p_mode = 'edit' THEN 'manage' ELSE 'view' END;
  v_acc public.portfolio_accounts%ROWTYPE;
  v_has_joint_owner boolean;
  v_has_any_linked_joint_owner boolean;
  v_has_explicit_grant boolean;
BEGIN
  IF p_household_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  v_role := public.get_household_role(p_household_id, p_user_id);
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF p_mode = 'edit' AND v_role = 'viewer' THEN
    RETURN false;
  END IF;

  -- Respect privacy of parent portfolio_account when assigned
  IF p_account_id IS NOT NULL THEN
    SELECT * INTO v_acc FROM public.portfolio_accounts WHERE id = p_account_id;
    IF v_acc.id IS NOT NULL AND v_acc.visibility IN ('owner_only', 'restricted') THEN
      IF NOT public.can_access_household_record(
        v_acc.household_id,
        'portfolio_account',
        v_acc.id,
        v_acc.visibility,
        v_acc.member_id,
        v_acc.created_by,
        p_user_id,
        p_mode
      ) THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  IF p_visibility = 'household_shared' THEN
    IF p_mode = 'view' THEN
      RETURN true;
    END IF;
    RETURN v_role IN ('primary_owner', 'admin', 'member');
  END IF;

  -- Direct single-member ownership
  IF p_member_id IS NOT NULL AND public.can_act_for_family_member(p_household_id, p_member_id, p_user_id, v_perm) THEN
    RETURN true;
  END IF;

  -- Joint owners in holding_owners
  IF p_holding_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.holding_owners ho
      WHERE ho.holding_id = p_holding_id
        AND public.can_act_for_family_member(p_household_id, ho.family_member_id, p_user_id, v_perm)
    ) INTO v_has_joint_owner;

    IF v_has_joint_owner THEN
      RETURN true;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.holding_owners ho
      JOIN public.family_members fm ON fm.id = ho.family_member_id
      WHERE ho.holding_id = p_holding_id
        AND fm.linked_user_id IS NOT NULL
    ) INTO v_has_any_linked_joint_owner;
  ELSE
    v_has_any_linked_joint_owner := false;
  END IF;

  IF NOT COALESCE(v_has_any_linked_joint_owner, false)
     AND (p_member_id IS NULL OR public.is_family_member_unlinked(p_household_id, p_member_id))
     AND p_created_by = p_user_id THEN
    RETURN true;
  END IF;

  IF p_visibility = 'restricted' AND p_holding_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.restricted_record_grants rrg
      WHERE rrg.household_id = p_household_id
        AND rrg.record_type = 'holding'
        AND rrg.record_id = p_holding_id
        AND rrg.user_id = p_user_id
        AND (p_mode = 'view' OR rrg.permission = 'manage')
    ) INTO v_has_explicit_grant;

    RETURN COALESCE(v_has_explicit_grant, false);
  END IF;

  RETURN false;
END;
$$;

-- Transaction access evaluator (respects source/destination account privacy)
CREATE OR REPLACE FUNCTION public.can_access_transaction_row(
  p_tx_id uuid,
  p_household_id uuid,
  p_visibility text,
  p_member_id uuid,
  p_account_id uuid,
  p_destination_account_id uuid,
  p_created_by uuid,
  p_user_id uuid DEFAULT auth.uid(),
  p_mode text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_acc public.portfolio_accounts%ROWTYPE;
BEGIN
  IF p_account_id IS NOT NULL THEN
    SELECT * INTO v_acc FROM public.portfolio_accounts WHERE id = p_account_id;
    IF v_acc.id IS NOT NULL AND v_acc.visibility IN ('owner_only', 'restricted') THEN
      IF NOT public.can_access_household_record(
        v_acc.household_id, 'portfolio_account', v_acc.id, v_acc.visibility,
        v_acc.member_id, v_acc.created_by, p_user_id, p_mode
      ) THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  IF p_destination_account_id IS NOT NULL THEN
    SELECT * INTO v_acc FROM public.portfolio_accounts WHERE id = p_destination_account_id;
    IF v_acc.id IS NOT NULL AND v_acc.visibility IN ('owner_only', 'restricted') THEN
      IF NOT public.can_access_household_record(
        v_acc.household_id, 'portfolio_account', v_acc.id, v_acc.visibility,
        v_acc.member_id, v_acc.created_by, p_user_id, p_mode
      ) THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  RETURN public.can_access_household_record(
    p_household_id,
    'transaction',
    p_tx_id,
    p_visibility,
    p_member_id,
    p_created_by,
    p_user_id,
    p_mode
  );
END;
$$;

-- Liability access evaluator (supports liability_parties joint borrowers + guarantors)
CREATE OR REPLACE FUNCTION public.can_access_liability_row(
  p_liability_id uuid,
  p_household_id uuid,
  p_visibility text,
  p_member_id uuid,
  p_created_by uuid,
  p_user_id uuid DEFAULT auth.uid(),
  p_mode text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_perm text := CASE WHEN p_mode = 'edit' THEN 'manage' ELSE 'view' END;
  v_has_party_access boolean;
  v_has_any_linked_party boolean;
  v_has_explicit_grant boolean;
BEGIN
  IF p_household_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  v_role := public.get_household_role(p_household_id, p_user_id);
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF p_mode = 'edit' AND v_role = 'viewer' THEN
    RETURN false;
  END IF;

  IF p_visibility = 'household_shared' THEN
    IF p_mode = 'view' THEN
      RETURN true;
    END IF;
    RETURN v_role IN ('primary_owner', 'admin', 'member');
  END IF;

  IF p_member_id IS NOT NULL AND public.can_act_for_family_member(p_household_id, p_member_id, p_user_id, v_perm) THEN
    RETURN true;
  END IF;

  IF p_liability_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.liability_parties lp
      WHERE lp.liability_id = p_liability_id
        AND (p_mode = 'view' OR lp.party_role IN ('primary_borrower', 'co_borrower'))
        AND public.can_act_for_family_member(p_household_id, lp.family_member_id, p_user_id, v_perm)
    ) INTO v_has_party_access;

    IF v_has_party_access THEN
      RETURN true;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.liability_parties lp
      JOIN public.family_members fm ON fm.id = lp.family_member_id
      WHERE lp.liability_id = p_liability_id
        AND fm.linked_user_id IS NOT NULL
    ) INTO v_has_any_linked_party;
  ELSE
    v_has_any_linked_party := false;
  END IF;

  IF NOT COALESCE(v_has_any_linked_party, false)
     AND (p_member_id IS NULL OR public.is_family_member_unlinked(p_household_id, p_member_id))
     AND p_created_by = p_user_id THEN
    RETURN true;
  END IF;

  IF p_visibility = 'restricted' AND p_liability_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.restricted_record_grants rrg
      WHERE rrg.household_id = p_household_id
        AND rrg.record_type = 'liability'
        AND rrg.record_id = p_liability_id
        AND rrg.user_id = p_user_id
        AND (p_mode = 'view' OR rrg.permission = 'manage')
    ) INTO v_has_explicit_grant;

    RETURN COALESCE(v_has_explicit_grant, false);
  END IF;

  RETURN false;
END;
$$;

-- INSERT guard preventing callers from creating private records impersonating
-- another linked user without explicit delegation
CREATE OR REPLACE FUNCTION public.can_insert_household_record(
  p_household_id uuid,
  p_visibility text,
  p_member_id uuid,
  p_user_id uuid DEFAULT auth.uid(),
  p_account_id uuid DEFAULT NULL,
  p_destination_account_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_acc public.portfolio_accounts%ROWTYPE;
BEGIN
  IF NOT public.can_edit_household_content(p_household_id, p_user_id) THEN
    RETURN false;
  END IF;

  -- Never attach rows to a private portfolio_account the caller cannot edit
  IF p_account_id IS NOT NULL THEN
    SELECT * INTO v_acc FROM public.portfolio_accounts WHERE id = p_account_id;
    IF v_acc.id IS NULL OR v_acc.household_id IS DISTINCT FROM p_household_id THEN
      RETURN false;
    END IF;
    IF v_acc.visibility IN ('owner_only', 'restricted') THEN
      IF NOT public.can_access_household_record(
        v_acc.household_id, 'portfolio_account', v_acc.id, v_acc.visibility,
        v_acc.member_id, v_acc.created_by, p_user_id, 'edit'
      ) THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  IF p_destination_account_id IS NOT NULL THEN
    SELECT * INTO v_acc FROM public.portfolio_accounts WHERE id = p_destination_account_id;
    IF v_acc.id IS NULL OR v_acc.household_id IS DISTINCT FROM p_household_id THEN
      RETURN false;
    END IF;
    IF v_acc.visibility IN ('owner_only', 'restricted') THEN
      IF NOT public.can_access_household_record(
        v_acc.household_id, 'portfolio_account', v_acc.id, v_acc.visibility,
        v_acc.member_id, v_acc.created_by, p_user_id, 'edit'
      ) THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  IF p_visibility = 'household_shared' THEN
    RETURN true;
  END IF;

  IF p_member_id IS NULL OR public.is_family_member_unlinked(p_household_id, p_member_id) THEN
    RETURN true;
  END IF;

  RETURN public.can_act_for_family_member(p_household_id, p_member_id, p_user_id, 'manage');
END;
$$;

-- Wrapper lookup functions for child tables & Storage policies
CREATE OR REPLACE FUNCTION public.can_access_asset(
  p_asset_id uuid,
  p_user_id uuid DEFAULT auth.uid(),
  p_mode text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT public.can_access_household_record(
      a.household_id, 'asset', a.id, a.visibility, NULL, a.created_by, p_user_id, p_mode
    )
    FROM public.assets a
    WHERE a.id = p_asset_id
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.can_access_holding(
  p_holding_id uuid,
  p_user_id uuid DEFAULT auth.uid(),
  p_mode text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT public.can_access_holding_row(
      h.id, h.household_id, h.visibility, h.member_id, h.account_id, h.created_by, p_user_id, p_mode
    )
    FROM public.holdings h
    WHERE h.id = p_holding_id
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.can_access_liability(
  p_liability_id uuid,
  p_user_id uuid DEFAULT auth.uid(),
  p_mode text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT public.can_access_liability_row(
      l.id, l.household_id, l.visibility, l.member_id, l.created_by, p_user_id, p_mode
    )
    FROM public.liabilities l
    WHERE l.id = p_liability_id
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.can_access_goal(
  p_goal_id uuid,
  p_user_id uuid DEFAULT auth.uid(),
  p_mode text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT public.can_access_household_record(
      g.household_id, 'goal', g.id, g.visibility, g.member_id, g.created_by, p_user_id, p_mode
    )
    FROM public.goals g
    WHERE g.id = p_goal_id
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.can_access_family_document(
  p_document_id uuid,
  p_user_id uuid DEFAULT auth.uid(),
  p_mode text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT public.can_access_household_record(
      d.household_id, 'family_document', d.id, d.visibility, d.member_id, d.created_by, p_user_id, p_mode
    )
    FROM public.family_documents d
    WHERE d.id = p_document_id
  ), false);
$$;

-- Checks whether caller is allowed to manage grants on a restricted record
CREATE OR REPLACE FUNCTION public.can_manage_restricted_record(
  p_household_id uuid,
  p_record_type text,
  p_record_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR NOT public.is_household_member(p_household_id, p_user_id) THEN
    RETURN false;
  END IF;

  IF p_record_type = 'holding' THEN
    RETURN public.can_access_holding(p_record_id, p_user_id, 'edit');
  ELSIF p_record_type = 'liability' THEN
    RETURN public.can_access_liability(p_record_id, p_user_id, 'edit');
  ELSIF p_record_type = 'asset' THEN
    RETURN public.can_access_asset(p_record_id, p_user_id, 'edit');
  ELSIF p_record_type = 'goal' THEN
    RETURN public.can_access_goal(p_record_id, p_user_id, 'edit');
  ELSIF p_record_type = 'family_document' THEN
    RETURN public.can_access_family_document(p_record_id, p_user_id, 'edit');
  ELSIF p_record_type = 'portfolio_account' THEN
    RETURN COALESCE((
      SELECT public.can_access_household_record(
        pa.household_id, 'portfolio_account', pa.id, pa.visibility, pa.member_id, pa.created_by, p_user_id, 'edit'
      )
      FROM public.portfolio_accounts pa WHERE pa.id = p_record_id AND pa.household_id = p_household_id
    ), false);
  ELSIF p_record_type = 'transaction' THEN
    RETURN COALESCE((
      SELECT public.can_access_transaction_row(
        tr.id, tr.household_id, tr.visibility, tr.member_id, tr.account_id, tr.destination_account_id, tr.created_by, p_user_id, 'edit'
      )
      FROM public.transactions tr WHERE tr.id = p_record_id AND tr.household_id = p_household_id
    ), false);
  ELSIF p_record_type = 'import_batch' THEN
    RETURN COALESCE((
      SELECT public.can_access_household_record(
        ib.household_id, 'import_batch', ib.id, ib.visibility, ib.member_id, ib.created_by, p_user_id, 'edit'
      )
      FROM public.import_batches ib WHERE ib.id = p_record_id AND ib.household_id = p_household_id
    ), false);
  END IF;

  RETURN false;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. RLS Policies on All 14 Financial/Vault Tables + Ownership & Grant Tables
-- ------------------------------------------------------------------------------

-- 3.1 family_members
CREATE POLICY "Household members view family entities"
  ON public.family_members FOR SELECT
  USING (public.is_household_member(household_id, auth.uid()));

CREATE POLICY "Household editors add unlinked or self family entities"
  ON public.family_members FOR INSERT
  WITH CHECK (
    public.can_edit_household_content(household_id, auth.uid())
    AND (linked_user_id IS NULL OR linked_user_id = auth.uid())
    AND (
      public.is_household_admin_or_owner(household_id, auth.uid())
      OR linked_user_id = auth.uid()
      OR entity_type IN ('huf', 'minor', 'individual')
    )
  );

CREATE POLICY "Linked member or admin for unlinked entity can update family entity"
  ON public.family_members FOR UPDATE
  USING (
    public.is_household_member(household_id, auth.uid())
    AND (
      linked_user_id = auth.uid()
      OR (
        linked_user_id IS NULL
        AND public.can_edit_household_content(household_id, auth.uid())
      )
    )
  )
  WITH CHECK (
    public.is_household_member(household_id, auth.uid())
    AND (
      linked_user_id = auth.uid()
      OR (
        linked_user_id IS NULL
        AND public.can_edit_household_content(household_id, auth.uid())
      )
    )
  );

CREATE POLICY "Owners or admins can delete unlinked family entities"
  ON public.family_members FOR DELETE
  USING (
    linked_user_id IS NULL
    AND public.is_household_admin_or_owner(household_id, auth.uid())
  );

-- 3.2 portfolio_accounts
CREATE POLICY "Permitted members view portfolio accounts"
  ON public.portfolio_accounts FOR SELECT
  USING (public.can_access_household_record(household_id, 'portfolio_account', id, visibility, member_id, created_by, auth.uid(), 'view'));

CREATE POLICY "Permitted editors insert portfolio accounts"
  ON public.portfolio_accounts FOR INSERT
  WITH CHECK (public.can_insert_household_record(household_id, visibility, member_id, auth.uid()));

CREATE POLICY "Permitted editors update portfolio accounts"
  ON public.portfolio_accounts FOR UPDATE
  USING (public.can_access_household_record(household_id, 'portfolio_account', id, visibility, member_id, created_by, auth.uid(), 'edit'))
  WITH CHECK (public.can_insert_household_record(household_id, visibility, member_id, auth.uid()));

CREATE POLICY "Permitted editors delete portfolio accounts"
  ON public.portfolio_accounts FOR DELETE
  USING (public.can_access_household_record(household_id, 'portfolio_account', id, visibility, member_id, created_by, auth.uid(), 'edit'));

-- 3.3 assets
CREATE POLICY "Permitted members view assets"
  ON public.assets FOR SELECT
  USING (public.can_access_household_record(household_id, 'asset', id, visibility, NULL, created_by, auth.uid(), 'view'));

CREATE POLICY "Permitted editors insert assets"
  ON public.assets FOR INSERT
  WITH CHECK (public.can_insert_household_record(household_id, visibility, NULL, auth.uid()));

CREATE POLICY "Permitted editors update assets"
  ON public.assets FOR UPDATE
  USING (public.can_access_household_record(household_id, 'asset', id, visibility, NULL, created_by, auth.uid(), 'edit'))
  WITH CHECK (public.can_insert_household_record(household_id, visibility, NULL, auth.uid()));

CREATE POLICY "Permitted editors delete assets"
  ON public.assets FOR DELETE
  USING (public.can_access_household_record(household_id, 'asset', id, visibility, NULL, created_by, auth.uid(), 'edit'));

-- 3.4 holdings
CREATE POLICY "Permitted members view holdings"
  ON public.holdings FOR SELECT
  USING (public.can_access_holding_row(id, household_id, visibility, member_id, account_id, created_by, auth.uid(), 'view'));

CREATE POLICY "Permitted editors insert holdings"
  ON public.holdings FOR INSERT
  WITH CHECK (public.can_insert_household_record(household_id, visibility, member_id, auth.uid(), account_id));

CREATE POLICY "Permitted editors update holdings"
  ON public.holdings FOR UPDATE
  USING (public.can_access_holding_row(id, household_id, visibility, member_id, account_id, created_by, auth.uid(), 'edit'))
  WITH CHECK (public.can_access_holding_row(id, household_id, visibility, member_id, account_id, created_by, auth.uid(), 'edit'));

CREATE POLICY "Permitted editors delete holdings"
  ON public.holdings FOR DELETE
  USING (public.can_access_holding_row(id, household_id, visibility, member_id, account_id, created_by, auth.uid(), 'edit'));

-- 3.5 transactions
CREATE POLICY "Permitted members view transactions"
  ON public.transactions FOR SELECT
  USING (public.can_access_transaction_row(id, household_id, visibility, member_id, account_id, destination_account_id, created_by, auth.uid(), 'view'));

CREATE POLICY "Permitted editors insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (public.can_insert_household_record(household_id, visibility, member_id, auth.uid(), account_id, destination_account_id));

CREATE POLICY "Permitted editors update transactions"
  ON public.transactions FOR UPDATE
  USING (public.can_access_transaction_row(id, household_id, visibility, member_id, account_id, destination_account_id, created_by, auth.uid(), 'edit'))
  WITH CHECK (public.can_insert_household_record(household_id, visibility, member_id, auth.uid(), account_id, destination_account_id));

CREATE POLICY "Permitted editors delete transactions"
  ON public.transactions FOR DELETE
  USING (public.can_access_transaction_row(id, household_id, visibility, member_id, account_id, destination_account_id, created_by, auth.uid(), 'edit'));

-- 3.6 import_batches
CREATE POLICY "Permitted members view import batches"
  ON public.import_batches FOR SELECT
  USING (public.can_access_household_record(household_id, 'import_batch', id, visibility, member_id, created_by, auth.uid(), 'view'));

CREATE POLICY "Permitted editors insert import batches"
  ON public.import_batches FOR INSERT
  WITH CHECK (public.can_insert_household_record(household_id, visibility, member_id, auth.uid()));

CREATE POLICY "Permitted editors update import batches"
  ON public.import_batches FOR UPDATE
  USING (public.can_access_household_record(household_id, 'import_batch', id, visibility, member_id, created_by, auth.uid(), 'edit'))
  WITH CHECK (public.can_insert_household_record(household_id, visibility, member_id, auth.uid()));

CREATE POLICY "Permitted editors delete import batches"
  ON public.import_batches FOR DELETE
  USING (public.can_access_household_record(household_id, 'import_batch', id, visibility, member_id, created_by, auth.uid(), 'edit'));

-- 3.7 asset_valuations (inherits parent asset visibility & edit rules)
CREATE POLICY "Permitted members view asset valuations"
  ON public.asset_valuations FOR SELECT
  USING (public.is_household_member(household_id, auth.uid()) AND public.can_access_asset(asset_id, auth.uid(), 'view'));

CREATE POLICY "Permitted editors write asset valuations"
  ON public.asset_valuations FOR ALL
  USING (public.can_edit_household_content(household_id, auth.uid()) AND public.can_access_asset(asset_id, auth.uid(), 'edit'))
  WITH CHECK (public.can_edit_household_content(household_id, auth.uid()) AND public.can_access_asset(asset_id, auth.uid(), 'edit'));

-- 3.8 liabilities
CREATE POLICY "Permitted members view liabilities"
  ON public.liabilities FOR SELECT
  USING (public.can_access_liability_row(id, household_id, visibility, member_id, created_by, auth.uid(), 'view'));

CREATE POLICY "Permitted editors insert liabilities"
  ON public.liabilities FOR INSERT
  WITH CHECK (public.can_insert_household_record(household_id, visibility, member_id, auth.uid()));

CREATE POLICY "Permitted editors update liabilities"
  ON public.liabilities FOR UPDATE
  USING (public.can_access_liability_row(id, household_id, visibility, member_id, created_by, auth.uid(), 'edit'))
  WITH CHECK (public.can_access_liability_row(id, household_id, visibility, member_id, created_by, auth.uid(), 'edit'));

CREATE POLICY "Permitted editors delete liabilities"
  ON public.liabilities FOR DELETE
  USING (public.can_access_liability_row(id, household_id, visibility, member_id, created_by, auth.uid(), 'edit'));

-- 3.9 liability_balances
CREATE POLICY "Permitted members view liability balances"
  ON public.liability_balances FOR SELECT
  USING (public.is_household_member(household_id, auth.uid()) AND public.can_access_liability(liability_id, auth.uid(), 'view'));

CREATE POLICY "Permitted editors write liability balances"
  ON public.liability_balances FOR ALL
  USING (public.can_edit_household_content(household_id, auth.uid()) AND public.can_access_liability(liability_id, auth.uid(), 'edit'))
  WITH CHECK (public.can_edit_household_content(household_id, auth.uid()) AND public.can_access_liability(liability_id, auth.uid(), 'edit'));

-- 3.10 asset_liability_links
CREATE POLICY "Permitted members view asset liability links"
  ON public.asset_liability_links FOR SELECT
  USING (
    public.is_household_member(household_id, auth.uid())
    AND public.can_access_asset(asset_id, auth.uid(), 'view')
    AND public.can_access_liability(liability_id, auth.uid(), 'view')
  );

CREATE POLICY "Permitted editors write asset liability links"
  ON public.asset_liability_links FOR ALL
  USING (
    public.can_edit_household_content(household_id, auth.uid())
    AND public.can_access_asset(asset_id, auth.uid(), 'edit')
    AND public.can_access_liability(liability_id, auth.uid(), 'edit')
  )
  WITH CHECK (
    public.can_edit_household_content(household_id, auth.uid())
    AND public.can_access_asset(asset_id, auth.uid(), 'edit')
    AND public.can_access_liability(liability_id, auth.uid(), 'edit')
  );

-- 3.11 loan_payments
CREATE POLICY "Permitted members view loan payments"
  ON public.loan_payments FOR SELECT
  USING (public.is_household_member(household_id, auth.uid()) AND public.can_access_liability(liability_id, auth.uid(), 'view'));

CREATE POLICY "Permitted editors write loan payments"
  ON public.loan_payments FOR ALL
  USING (public.can_edit_household_content(household_id, auth.uid()) AND public.can_access_liability(liability_id, auth.uid(), 'edit'))
  WITH CHECK (public.can_edit_household_content(household_id, auth.uid()) AND public.can_access_liability(liability_id, auth.uid(), 'edit'));

-- 3.12 goals
CREATE POLICY "Permitted members view goals"
  ON public.goals FOR SELECT
  USING (public.can_access_household_record(household_id, 'goal', id, visibility, member_id, created_by, auth.uid(), 'view'));

CREATE POLICY "Permitted editors insert goals"
  ON public.goals FOR INSERT
  WITH CHECK (public.can_insert_household_record(household_id, visibility, member_id, auth.uid()));

CREATE POLICY "Permitted editors update goals"
  ON public.goals FOR UPDATE
  USING (public.can_access_household_record(household_id, 'goal', id, visibility, member_id, created_by, auth.uid(), 'edit'))
  WITH CHECK (public.can_insert_household_record(household_id, visibility, member_id, auth.uid()));

CREATE POLICY "Permitted editors delete goals"
  ON public.goals FOR DELETE
  USING (public.can_access_household_record(household_id, 'goal', id, visibility, member_id, created_by, auth.uid(), 'edit'));

-- 3.13 goal_holding_allocations
CREATE POLICY "Permitted members view goal allocations"
  ON public.goal_holding_allocations FOR SELECT
  USING (
    public.is_household_member(household_id, auth.uid())
    AND public.can_access_goal(goal_id, auth.uid(), 'view')
    AND public.can_access_holding(holding_id, auth.uid(), 'view')
  );

CREATE POLICY "Permitted editors write goal allocations"
  ON public.goal_holding_allocations FOR ALL
  USING (
    public.can_edit_household_content(household_id, auth.uid())
    AND public.can_access_goal(goal_id, auth.uid(), 'edit')
    AND public.can_access_holding(holding_id, auth.uid(), 'view')
  )
  WITH CHECK (
    public.can_edit_household_content(household_id, auth.uid())
    AND public.can_access_goal(goal_id, auth.uid(), 'edit')
    AND public.can_access_holding(holding_id, auth.uid(), 'view')
  );

-- 3.14 family_documents
CREATE POLICY "Permitted members view family documents"
  ON public.family_documents FOR SELECT
  USING (public.can_access_household_record(household_id, 'family_document', id, visibility, member_id, created_by, auth.uid(), 'view'));

CREATE POLICY "Permitted editors insert family documents"
  ON public.family_documents FOR INSERT
  WITH CHECK (public.can_insert_household_record(household_id, visibility, member_id, auth.uid()));

CREATE POLICY "Permitted editors update family documents"
  ON public.family_documents FOR UPDATE
  USING (public.can_access_household_record(household_id, 'family_document', id, visibility, member_id, created_by, auth.uid(), 'edit'))
  WITH CHECK (public.can_insert_household_record(household_id, visibility, member_id, auth.uid()));

CREATE POLICY "Permitted editors delete family documents"
  ON public.family_documents FOR DELETE
  USING (public.can_access_household_record(household_id, 'family_document', id, visibility, member_id, created_by, auth.uid(), 'edit'));

-- 3.15 holding_owners
CREATE POLICY "Permitted members view holding owners"
  ON public.holding_owners FOR SELECT
  USING (public.is_household_member(household_id, auth.uid()) AND public.can_access_holding(holding_id, auth.uid(), 'view'));

CREATE POLICY "Permitted editors manage holding owners"
  ON public.holding_owners FOR ALL
  USING (public.can_edit_household_content(household_id, auth.uid()) AND public.can_access_holding(holding_id, auth.uid(), 'edit'))
  WITH CHECK (public.can_edit_household_content(household_id, auth.uid()) AND public.can_access_holding(holding_id, auth.uid(), 'edit'));

-- 3.16 liability_parties
CREATE POLICY "Permitted members view liability parties"
  ON public.liability_parties FOR SELECT
  USING (public.is_household_member(household_id, auth.uid()) AND public.can_access_liability(liability_id, auth.uid(), 'view'));

CREATE POLICY "Permitted editors manage liability parties"
  ON public.liability_parties FOR ALL
  USING (public.can_edit_household_content(household_id, auth.uid()) AND public.can_access_liability(liability_id, auth.uid(), 'edit'))
  WITH CHECK (public.can_edit_household_content(household_id, auth.uid()) AND public.can_access_liability(liability_id, auth.uid(), 'edit'));

-- 3.17 restricted_record_grants (strictly record owner / explicit manager, never arbitrary admins)
CREATE POLICY "Restricted grantees and record owners view grants"
  ON public.restricted_record_grants FOR SELECT
  USING (
    public.is_household_member(household_id, auth.uid())
    AND (
      user_id = auth.uid()
      OR public.can_manage_restricted_record(household_id, record_type, record_id, auth.uid())
    )
  );

CREATE POLICY "Record owners manage restricted grants"
  ON public.restricted_record_grants FOR ALL
  USING (public.can_manage_restricted_record(household_id, record_type, record_id, auth.uid()))
  WITH CHECK (public.can_manage_restricted_record(household_id, record_type, record_id, auth.uid()));

-- ------------------------------------------------------------------------------
-- 4. Private Storage Policies for 'family-vault' (<household_id>/<doc_id>/<file>)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_read_vault_storage_object(
  p_name text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_documents d
    WHERE d.household_id = public.try_parse_uuid((storage.foldername(p_name))[1])
      AND d.id = public.try_parse_uuid((storage.foldername(p_name))[2])
      AND d.storage_path = p_name
      AND public.can_access_family_document(d.id, p_user_id, 'view')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_vault_storage_object(
  p_name text,
  p_owner uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.try_parse_uuid((storage.foldername(p_name))[1]) IS NULL
      OR public.try_parse_uuid((storage.foldername(p_name))[2]) IS NULL THEN false
    WHEN EXISTS (
      SELECT 1
      FROM public.family_documents d
      WHERE d.household_id = public.try_parse_uuid((storage.foldername(p_name))[1])
        AND d.id = public.try_parse_uuid((storage.foldername(p_name))[2])
        AND d.storage_path = p_name
    ) THEN EXISTS (
      SELECT 1
      FROM public.family_documents d
      WHERE d.household_id = public.try_parse_uuid((storage.foldername(p_name))[1])
        AND d.id = public.try_parse_uuid((storage.foldername(p_name))[2])
        AND d.storage_path = p_name
        AND public.can_access_family_document(d.id, p_user_id, 'edit')
    )
    -- Allow uploader rollback cleanup only if metadata insert hasn't committed
    ELSE p_owner = p_user_id
      AND public.can_edit_household_content(public.try_parse_uuid((storage.foldername(p_name))[1]), p_user_id)
  END;
$$;

CREATE POLICY "Permitted household members read family-vault objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'family-vault'
    AND public.can_read_vault_storage_object(name, auth.uid())
  );

CREATE POLICY "Household editors upload family-vault objects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'family-vault'
    AND array_length(storage.foldername(name), 1) >= 2
    AND public.try_parse_uuid((storage.foldername(name))[2]) IS NOT NULL
    AND public.can_edit_household_content(public.try_parse_uuid((storage.foldername(name))[1]), auth.uid())
  );

CREATE POLICY "Permitted editors update family-vault objects"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'family-vault'
    AND public.can_write_vault_storage_object(name, owner, auth.uid())
  );

CREATE POLICY "Permitted editors delete family-vault objects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'family-vault'
    AND public.can_write_vault_storage_object(name, owner, auth.uid())
  );

-- ------------------------------------------------------------------------------
-- 5. Transactional Joint Ownership & Split RPCs (Atomic SUM = 100%)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_holding_owners(
  p_holding_id uuid,
  p_owners jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_household_id uuid;
  v_item jsonb;
  v_member_id uuid;
  v_share numeric(7, 4);
  v_is_primary boolean;
  v_primary_member_id uuid;
  v_total_share numeric := 0;
  v_count int := 0;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT household_id INTO v_household_id
  FROM public.holdings
  WHERE id = p_holding_id
  FOR UPDATE;

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Holding not found';
  END IF;

  IF NOT public.can_access_holding(p_holding_id, v_caller_id, 'edit') THEN
    RAISE EXCEPTION 'Access Denied: Insufficient permissions to update holding ownership';
  END IF;

  IF p_owners IS NULL OR jsonb_typeof(p_owners) <> 'array' OR jsonb_array_length(p_owners) = 0 THEN
    RAISE EXCEPTION 'At least one holding owner with 100%% total share is required';
  END IF;

  DELETE FROM public.holding_owners WHERE holding_id = p_holding_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_owners) LOOP
    v_member_id := (v_item->>'family_member_id')::uuid;
    v_share := (v_item->>'ownership_share')::numeric(7, 4);
    v_is_primary := COALESCE((v_item->>'is_primary_owner')::boolean, false);

    PERFORM public.assert_same_household_fk(v_household_id, 'family_members', v_member_id, 'family_member_id');

    INSERT INTO public.holding_owners (
      household_id, holding_id, family_member_id, ownership_share, is_primary_owner, created_by
    ) VALUES (
      v_household_id, p_holding_id, v_member_id, v_share, v_is_primary, v_caller_id
    );

    IF v_is_primary OR v_primary_member_id IS NULL THEN
      v_primary_member_id := v_member_id;
    END IF;

    v_total_share := v_total_share + v_share;
    v_count := v_count + 1;
  END LOOP;

  IF v_total_share <> 100 THEN
    RAISE EXCEPTION 'Joint ownership shares must sum to 100%% (got % percent)', v_total_share;
  END IF;

  UPDATE public.holdings
  SET member_id = v_primary_member_id,
      updated_by = v_caller_id,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_holding_id;

  RETURN jsonb_build_object(
    'success', true,
    'holding_id', p_holding_id,
    'owner_count', v_count,
    'primary_member_id', v_primary_member_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_liability_parties(
  p_liability_id uuid,
  p_parties jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_household_id uuid;
  v_item jsonb;
  v_member_id uuid;
  v_role text;
  v_share numeric(7, 4);
  v_primary_member_id uuid;
  v_total_share numeric := 0;
  v_count int := 0;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT household_id INTO v_household_id
  FROM public.liabilities
  WHERE id = p_liability_id
  FOR UPDATE;

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Liability not found';
  END IF;

  IF NOT public.can_access_liability(p_liability_id, v_caller_id, 'edit') THEN
    RAISE EXCEPTION 'Access Denied: Insufficient permissions to update liability borrowers';
  END IF;

  IF p_parties IS NULL OR jsonb_typeof(p_parties) <> 'array' OR jsonb_array_length(p_parties) = 0 THEN
    RAISE EXCEPTION 'At least one liability party with 100%% total share is required';
  END IF;

  DELETE FROM public.liability_parties WHERE liability_id = p_liability_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_parties) LOOP
    v_member_id := (v_item->>'family_member_id')::uuid;
    v_role := COALESCE(v_item->>'party_role', 'co_borrower');
    v_share := (v_item->>'liability_share')::numeric(7, 4);

    PERFORM public.assert_same_household_fk(v_household_id, 'family_members', v_member_id, 'family_member_id');

    INSERT INTO public.liability_parties (
      household_id, liability_id, family_member_id, party_role, liability_share, created_by
    ) VALUES (
      v_household_id, p_liability_id, v_member_id, v_role, v_share, v_caller_id
    );

    IF v_role = 'primary_borrower' OR v_primary_member_id IS NULL THEN
      v_primary_member_id := v_member_id;
    END IF;

    v_total_share := v_total_share + v_share;
    v_count := v_count + 1;
  END LOOP;

  IF v_total_share <> 100 THEN
    RAISE EXCEPTION 'Joint liability shares must sum to 100%% (got % percent)', v_total_share;
  END IF;

  UPDATE public.liabilities
  SET member_id = v_primary_member_id,
      updated_by = v_caller_id,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_liability_id;

  RETURN jsonb_build_object(
    'success', true,
    'liability_id', p_liability_id,
    'party_count', v_count,
    'primary_member_id', v_primary_member_id
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Upgrade Admin & Privacy-Respecting Support Impersonation RPCs (000009 / 000010)
-- ------------------------------------------------------------------------------
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
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: Caller does not have platform administrative privileges';
  END IF;

  v_offset := (GREATEST(p_page, 1) - 1) * GREATEST(p_limit, 1);

  SELECT COUNT(DISTINCT u.id) INTO v_total
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_access_status s ON s.user_id = u.id
  LEFT JOIN public.platform_admin_roles r ON r.user_id = u.id AND r.is_active = true
  WHERE (p_search IS NULL OR p_search = '' OR u.email ILIKE '%' || p_search || '%' OR p.display_name ILIKE '%' || p_search || '%')
    AND (p_status IS NULL OR p_status = '' OR COALESCE(s.status, 'active') = p_status)
    AND (p_role IS NULL OR p_role = '' OR r.role = p_role);

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
      (SELECT COUNT(*) FROM public.household_members hm WHERE hm.user_id = u.id AND hm.status = 'active') AS household_count
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

  SELECT jsonb_agg(row_to_json(h_row)) INTO v_households
  FROM (
    SELECT
      h.id,
      h.name,
      hm.household_role,
      hm.status,
      hm.joined_at,
      (SELECT COUNT(*) FROM public.household_members m WHERE m.household_id = h.id AND m.status = 'active') AS total_members
    FROM public.household_members hm
    JOIN public.households h ON h.id = hm.household_id
    WHERE hm.user_id = p_user_id
  ) h_row;

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
      COALESCE(p_own.display_name, split_part(u_own.email, '@', 1), p.display_name, split_part(u.email, '@', 1)) AS created_by_name,
      (SELECT COUNT(*) FROM public.household_members m WHERE m.household_id = h.id AND m.status = 'active') AS member_count
    FROM public.households h
    LEFT JOIN auth.users u ON u.id = h.created_by
    LEFT JOIN public.profiles p ON p.id = h.created_by
    LEFT JOIN public.household_members hm_own ON hm_own.household_id = h.id AND hm_own.household_role = 'primary_owner' AND hm_own.status = 'active'
    LEFT JOIN auth.users u_own ON u_own.id = hm_own.user_id
    LEFT JOIN public.profiles p_own ON p_own.id = hm_own.user_id
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

-- Support Session Read-Only Procedures (Household + Target Privacy Scoped)
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
      h.household_id,
      h.asset_id,
      a.name AS asset_name,
      a.ticker AS symbol,
      ac.name AS asset_class_name,
      ac.id AS asset_class_id,
      h.quantity,
      h.unit_cost_cents AS cost_basis_cents,
      h.current_value_cents,
      a.currency,
      h.member_id,
      fm.name AS member_name,
      h.account_id,
      pa.account_name,
      pa.broker_name,
      h.visibility,
      h.updated_at
    FROM public.holdings h
    JOIN public.assets a ON a.id = h.asset_id
    JOIN public.asset_classes ac ON ac.id = a.asset_class_id
    LEFT JOIN public.family_members fm ON fm.id = h.member_id
    LEFT JOIN public.portfolio_accounts pa ON pa.id = h.account_id
    WHERE public.can_access_holding_row(h.id, h.household_id, h.visibility, h.member_id, h.account_id, h.created_by, v_target_user_id, 'view')
    ORDER BY h.current_value_cents DESC
  ) t;

  RETURN jsonb_build_object(
    'target_user_id', v_target_user_id,
    'holdings', COALESCE(v_holdings, '[]'::jsonb)
  );
END;
$$;

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
      l.household_id,
      l.name,
      l.loan_type AS liability_type,
      l.original_principal_cents,
      l.interest_rate,
      l.start_date,
      l.tenure_months,
      l.emi_amount_cents AS monthly_payment_cents,
      COALESCE(
        (SELECT lb.balance_cents FROM public.liability_balances lb WHERE lb.liability_id = l.id ORDER BY lb.as_of_date DESC LIMIT 1),
        l.original_principal_cents
      ) AS outstanding_balance_cents,
      l.member_id,
      fm.name AS primary_borrower_name,
      l.visibility,
      l.status,
      l.created_at
    FROM public.liabilities l
    LEFT JOIN public.family_members fm ON fm.id = l.member_id
    WHERE public.can_access_liability_row(l.id, l.household_id, l.visibility, l.member_id, l.created_by, v_target_user_id, 'view')
    ORDER BY l.created_at DESC
  ) t;

  RETURN jsonb_build_object(
    'target_user_id', v_target_user_id,
    'liabilities', COALESCE(v_liabilities, '[]'::jsonb)
  );
END;
$$;

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
      g.household_id,
      g.name,
      g.target_amount_cents,
      g.target_date,
      g.initial_saved_cents AS current_amount_cents,
      g.category,
      g.priority,
      g.member_id,
      fm.name AS beneficiary_name,
      g.visibility,
      g.notes,
      g.created_at
    FROM public.goals g
    LEFT JOIN public.family_members fm ON fm.id = g.member_id
    WHERE public.can_access_household_record(g.household_id, 'goal', g.id, g.visibility, g.member_id, g.created_by, v_target_user_id, 'view')
    ORDER BY g.created_at DESC
  ) t;

  RETURN jsonb_build_object(
    'target_user_id', v_target_user_id,
    'goals', COALESCE(v_goals, '[]'::jsonb)
  );
END;
$$;

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
      tr.household_id,
      tr.type AS transaction_type,
      tr.transaction_date,
      tr.quantity,
      tr.amount_cents AS total_amount_cents,
      tr.currency,
      a.name AS asset_name,
      a.ticker AS symbol,
      fm.name AS member_name,
      pa.account_name,
      tr.visibility,
      tr.notes,
      tr.created_at
    FROM public.transactions tr
    LEFT JOIN public.assets a ON a.id = tr.asset_id
    LEFT JOIN public.family_members fm ON fm.id = tr.member_id
    LEFT JOIN public.portfolio_accounts pa ON pa.id = tr.account_id
    WHERE public.can_access_transaction_row(
      tr.id, tr.household_id, tr.visibility, tr.member_id, tr.account_id, tr.destination_account_id, tr.created_by, v_target_user_id, 'view'
    )
    ORDER BY tr.transaction_date DESC
    LIMIT p_limit
  ) t;

  RETURN jsonb_build_object(
    'target_user_id', v_target_user_id,
    'transactions', COALESCE(v_transactions, '[]'::jsonb)
  );
END;
$$;

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

  SELECT
    COALESCE(SUM(h.current_value_cents), 0),
    COUNT(*)
  INTO v_total_assets_cents, v_holdings_count
  FROM public.holdings h
  WHERE public.can_access_holding_row(h.id, h.household_id, h.visibility, h.member_id, h.account_id, h.created_by, v_target_user_id, 'view');

  SELECT
    COALESCE(SUM(
      COALESCE(
        (SELECT lb.balance_cents FROM public.liability_balances lb WHERE lb.liability_id = l.id ORDER BY lb.as_of_date DESC LIMIT 1),
        l.original_principal_cents
      )
    ), 0),
    COUNT(*)
  INTO v_total_debt_cents, v_liabilities_count
  FROM public.liabilities l
  WHERE l.status = 'active'
    AND public.can_access_liability_row(l.id, l.household_id, l.visibility, l.member_id, l.created_by, v_target_user_id, 'view');

  v_net_worth_cents := v_total_assets_cents - v_total_debt_cents;

  SELECT COUNT(*) INTO v_goals_count
  FROM public.goals g
  WHERE public.can_access_household_record(g.household_id, 'goal', g.id, g.visibility, g.member_id, g.created_by, v_target_user_id, 'view');

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

-- Revoke & Grant RPC/Helper Permissions
REVOKE ALL ON FUNCTION public.try_parse_uuid(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_act_for_family_member(uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_family_member_unlinked(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_household_record(uuid, text, uuid, text, uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_holding_row(uuid, uuid, text, uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_transaction_row(uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_liability_row(uuid, uuid, text, uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_insert_household_record(uuid, text, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_asset(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_holding(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_liability(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_goal(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_family_document(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_restricted_record(uuid, text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_vault_storage_object(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_vault_storage_object(text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_holding_owners(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_liability_parties(uuid, jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.try_parse_uuid(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_act_for_family_member(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_member_unlinked(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_household_record(uuid, text, uuid, text, uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_holding_row(uuid, uuid, text, uuid, uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_transaction_row(uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_liability_row(uuid, uuid, text, uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_insert_household_record(uuid, text, uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_asset(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_holding(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_liability(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_goal(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_family_document(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_restricted_record(uuid, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_vault_storage_object(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_vault_storage_object(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_holding_owners(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_liability_parties(uuid, jsonb) TO authenticated;
