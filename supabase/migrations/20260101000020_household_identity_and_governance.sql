-- ==============================================================================
-- WealthNest Phase 18A Part 2 (Phase 1):
-- Household Identity, Multi-Admin Governance, Family Entities & Onboarding Trigger
-- ==============================================================================
-- Implements Approved Product Decisions #1–#7 and #14:
--   1. Auto-create a personal household + primary_owner + self family_member on signup
--   2. Exactly one active primary_owner per household (partial unique index + guard)
--   3. Support multiple active household admins alongside primary_owner
--   4. Only primary_owner can appoint/remove admins and transfer primary ownership
--   5. Family members exist cleanly without login accounts (linked_user_id NULL)
--   6. Support explicit delegation (family_member_access) & household audit logs
--   7. Multi-household access per auth.users identity without duplicate people
--
-- Beta Data Disposition (Option A Approved 2026-11-15):
--   Cleanly resets pre-household disposable single-user financial rows & legacy
--   family_members rows while keeping auth.users, profiles, households, and
--   immutable platform audit logs intact.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Option A Disposable Financial Reset (Foreign-Key Safe Order)
-- ------------------------------------------------------------------------------
DELETE FROM public.goal_holding_allocations;
DELETE FROM public.goals;
DELETE FROM public.loan_payments;
DELETE FROM public.liability_balances;
DELETE FROM public.asset_liability_links;
DELETE FROM public.liabilities;
DELETE FROM public.asset_valuations;
DELETE FROM public.transactions;
DELETE FROM public.holdings;
DELETE FROM public.import_batches;
DELETE FROM public.family_documents;
DELETE FROM public.assets;
DELETE FROM public.portfolio_accounts;
DELETE FROM public.family_members;

-- ------------------------------------------------------------------------------
-- 2. Harden & Extend public.household_members Governance Schema
-- ------------------------------------------------------------------------------
ALTER TABLE public.household_members
  DROP CONSTRAINT IF EXISTS household_members_household_role_check;

ALTER TABLE public.household_members
  ADD CONSTRAINT household_members_household_role_check
  CHECK (household_role IN ('primary_owner', 'admin', 'member', 'viewer'));

ALTER TABLE public.household_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.household_members
  DROP CONSTRAINT IF EXISTS household_members_status_check;

ALTER TABLE public.household_members
  ADD CONSTRAINT household_members_status_check
  CHECK (status IN ('active', 'suspended', 'revoked'));

ALTER TABLE public.household_members
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now());

-- Guarantee at most ONE active primary_owner per household
CREATE UNIQUE INDEX IF NOT EXISTS uniq_household_single_active_primary_owner
  ON public.household_members (household_id)
  WHERE household_role = 'primary_owner' AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_household_members_user_status
  ON public.household_members (user_id, status);

-- Drop legacy 000019 policies on households and household_members before updating helpers
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('households', 'household_members')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.is_household_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_household_primary_owner(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_bootstrap_household_owner(uuid, uuid);
DROP FUNCTION IF EXISTS public.household_creator_unchanged(uuid, uuid);

-- Canonical active-status-aware governance helpers (non-recursive SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_household_member(
  p_household_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_household_id IS NULL OR p_user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.household_members hm
      WHERE hm.household_id = p_household_id
        AND hm.user_id = p_user_id
        AND hm.status = 'active'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_household_role(
  p_household_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT hm.household_role
  FROM public.household_members hm
  WHERE hm.household_id = p_household_id
    AND hm.user_id = p_user_id
    AND hm.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_household_primary_owner(
  p_household_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(public.get_household_role(p_household_id, p_user_id) = 'primary_owner', false);
$$;

CREATE OR REPLACE FUNCTION public.is_household_admin_or_owner(
  p_household_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(public.get_household_role(p_household_id, p_user_id) IN ('primary_owner', 'admin'), false);
$$;

CREATE OR REPLACE FUNCTION public.can_edit_household_content(
  p_household_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(public.get_household_role(p_household_id, p_user_id) IN ('primary_owner', 'admin', 'member'), false);
$$;

CREATE OR REPLACE FUNCTION public.can_bootstrap_household_owner(
  p_household_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT (
    p_household_id IS NOT NULL
    AND p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.households h
      WHERE h.id = p_household_id
        AND h.created_by = p_user_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.household_members hm
      WHERE hm.household_id = p_household_id
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.household_creator_unchanged(
  p_household_id uuid,
  p_created_by uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.households h
    WHERE h.id = p_household_id
      AND h.created_by IS NOT DISTINCT FROM p_created_by
  );
$$;

-- Guard primary owner invariant against direct PostgREST demotion/suspension/deletion
CREATE OR REPLACE FUNCTION public.guard_household_primary_owner_invariant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bypass for controlled SECURITY DEFINER ownership transfer or direct admin/cascade maintenance
  IF current_setting('wealthnest.allow_owner_transition', true) = 'true' OR auth.uid() IS NULL THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.updated_at := timezone('utc'::text, now());
      RETURN NEW;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.household_id IS DISTINCT FROM OLD.household_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Household membership identity fields cannot be reassigned directly';
    END IF;

    IF OLD.household_role = 'primary_owner' AND OLD.status = 'active'
       AND (NEW.household_role IS DISTINCT FROM 'primary_owner' OR NEW.status IS DISTINCT FROM 'active') THEN
      RAISE EXCEPTION 'Active primary_owner cannot be demoted or suspended directly; use transfer_household_primary_owner()';
    END IF;

    IF NEW.household_role = 'primary_owner' AND OLD.household_role IS DISTINCT FROM 'primary_owner' THEN
      RAISE EXCEPTION 'Direct promotion to primary_owner is prohibited; use transfer_household_primary_owner()';
    END IF;

    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.household_role = 'primary_owner' AND OLD.status = 'active' THEN
      -- Permit household teardown or auth account deletion CASCADE, while blocking direct removal
      IF EXISTS (SELECT 1 FROM public.households h WHERE h.id = OLD.household_id)
         AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.user_id) THEN
        RAISE EXCEPTION 'Active primary_owner cannot leave or be removed without transferring household ownership first';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_household_primary_owner ON public.household_members;
CREATE TRIGGER trg_guard_household_primary_owner
  BEFORE UPDATE OR DELETE ON public.household_members
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_household_primary_owner_invariant();

-- ------------------------------------------------------------------------------
-- 3. Evolve public.family_members (Household-Scoped Entities, Optional Auth Link)
-- ------------------------------------------------------------------------------
-- Decouple auth user deletion from deleting family financial identities.
-- Legacy user_id is made nullable now and dropped completely in Phase 4 after
-- legacy RLS policies depending on it are replaced.
ALTER TABLE public.family_members
  DROP CONSTRAINT IF EXISTS family_members_user_id_fkey;

ALTER TABLE public.family_members
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.family_members
  DROP CONSTRAINT IF EXISTS family_members_entity_type_check;

ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_entity_type_check
  CHECK (entity_type IN ('individual', 'huf', 'minor'));

CREATE UNIQUE INDEX IF NOT EXISTS uniq_family_member_household_linked_user
  ON public.family_members (household_id, linked_user_id)
  WHERE linked_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_family_members_household
  ON public.family_members (household_id);

CREATE INDEX IF NOT EXISTS idx_family_members_linked_user
  ON public.family_members (linked_user_id)
  WHERE linked_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_family_member_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.relationship = 'huf' AND NEW.entity_type = 'individual' THEN
    NEW.entity_type := 'huf';
  ELSIF NEW.relationship = 'child' AND NEW.entity_type = 'individual' AND NEW.linked_user_id IS NULL THEN
    -- Allow either explicit minor or adult child; preserve explicit minor if chosen
    NULL;
  END IF;

  IF NEW.entity_type IN ('huf', 'minor') AND NEW.linked_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'HUF and minor entities cannot carry a direct linked_user_id';
  END IF;

  IF NEW.linked_user_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.linked_user_id IS DISTINCT FROM OLD.linked_user_id) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.household_members hm
      WHERE hm.household_id = NEW.household_id
        AND hm.user_id = NEW.linked_user_id
        AND hm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'linked_user_id must belong to an active household_members record in the same household';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  ELSE
    IF NEW.household_id IS DISTINCT FROM OLD.household_id THEN
      RAISE EXCEPTION 'family_members.household_id cannot be moved across households';
    END IF;
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
    NEW.updated_at := timezone('utc'::text, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_family_member_integrity ON public.family_members;
CREATE TRIGGER trg_validate_family_member_integrity
  BEFORE INSERT OR UPDATE ON public.family_members
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_family_member_integrity();

-- ------------------------------------------------------------------------------
-- 4. Create public.family_member_access (Scoped Per-Member Delegation)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_member_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  family_member_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('view', 'manage')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at timestamptz,
  UNIQUE (family_member_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_member_access_household_user
  ON public.family_member_access (household_id, user_id);

CREATE OR REPLACE FUNCTION public.validate_family_member_access_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fm_household uuid;
BEGIN
  SELECT fm.household_id INTO v_fm_household
  FROM public.family_members fm
  WHERE fm.id = NEW.family_member_id;

  IF v_fm_household IS NULL OR v_fm_household IS DISTINCT FROM NEW.household_id THEN
    RAISE EXCEPTION 'Cross-household invariant violation: family_member_id does not belong to household_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.household_members hm
    WHERE hm.household_id = NEW.household_id
      AND hm.user_id = NEW.user_id
      AND hm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Delegated grantee must be an active member of the same household';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.granted_by := COALESCE(auth.uid(), NEW.granted_by);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_family_member_access ON public.family_member_access;
CREATE TRIGGER trg_validate_family_member_access
  BEFORE INSERT OR UPDATE ON public.family_member_access
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_family_member_access_integrity();

-- ------------------------------------------------------------------------------
-- 5. Create Append-Only public.household_audit_logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.household_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid,
  actor_user_id uuid,
  target_user_id uuid,
  target_family_member_id uuid,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_household_audit_logs_household_created
  ON public.household_audit_logs (household_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_household_audit_log_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'household_audit_logs records are strictly append-only and immutable. UPDATE and DELETE are prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_household_audit_log_mod ON public.household_audit_logs;
CREATE TRIGGER trg_prevent_household_audit_log_mod
  BEFORE UPDATE OR DELETE ON public.household_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_household_audit_log_modification();

CREATE OR REPLACE FUNCTION public.log_household_action(
  p_household_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_target_user_id uuid DEFAULT NULL,
  p_target_family_member_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.household_audit_logs (
    household_id,
    actor_user_id,
    target_user_id,
    target_family_member_id,
    action,
    metadata
  ) VALUES (
    p_household_id,
    p_actor_user_id,
    p_target_user_id,
    p_target_family_member_id,
    p_action,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. RLS Policies for Governance, Access Grants, and Audit Logs
-- ------------------------------------------------------------------------------
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_member_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.households FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.household_members FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.family_member_access FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.household_audit_logs FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.households TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.household_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.family_member_access TO authenticated;
GRANT SELECT ON TABLE public.household_audit_logs TO authenticated;

GRANT ALL ON TABLE public.households TO service_role;
GRANT ALL ON TABLE public.household_members TO service_role;
GRANT ALL ON TABLE public.family_member_access TO service_role;
GRANT ALL ON TABLE public.household_audit_logs TO service_role;

-- households policies
CREATE POLICY "Household members can view their households"
  ON public.households FOR SELECT
  USING (public.is_household_member(id, auth.uid()));

CREATE POLICY "Authenticated users can create households"
  ON public.households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Primary owner or admin can update household metadata"
  ON public.households FOR UPDATE
  USING (public.is_household_admin_or_owner(id, auth.uid()))
  WITH CHECK (
    public.is_household_admin_or_owner(id, auth.uid())
    AND public.household_creator_unchanged(id, created_by)
  );

CREATE POLICY "Only primary owner can delete household"
  ON public.households FOR DELETE
  USING (public.is_household_primary_owner(id, auth.uid()));

-- household_members policies
CREATE POLICY "Household members can view household membership"
  ON public.household_members FOR SELECT
  USING (public.is_household_member(household_id, auth.uid()));

CREATE POLICY "Owners, admins, or creator bootstrap can add household members"
  ON public.household_members FOR INSERT
  WITH CHECK (
    (
      public.is_household_primary_owner(household_id, auth.uid())
      AND household_role IN ('admin', 'member', 'viewer')
    )
    OR (
      public.is_household_admin_or_owner(household_id, auth.uid())
      AND household_role IN ('member', 'viewer')
    )
    OR (
      user_id = auth.uid()
      AND household_role = 'primary_owner'
      AND status = 'active'
      AND public.can_bootstrap_household_owner(household_id, auth.uid())
    )
  );

CREATE POLICY "Governance roles can update non-owner household memberships"
  ON public.household_members FOR UPDATE
  USING (
    (
      public.is_household_primary_owner(household_id, auth.uid())
      AND household_role <> 'primary_owner'
    )
    OR (
      public.get_household_role(household_id, auth.uid()) = 'admin'
      AND household_role IN ('member', 'viewer')
    )
  )
  WITH CHECK (
    (
      public.is_household_primary_owner(household_id, auth.uid())
      AND household_role IN ('admin', 'member', 'viewer')
    )
    OR (
      public.get_household_role(household_id, auth.uid()) = 'admin'
      AND household_role IN ('member', 'viewer')
    )
  );

CREATE POLICY "Owners, admins, or departing members can delete memberships"
  ON public.household_members FOR DELETE
  USING (
    household_role <> 'primary_owner'
    AND (
      public.is_household_primary_owner(household_id, auth.uid())
      OR (
        public.get_household_role(household_id, auth.uid()) = 'admin'
        AND household_role IN ('member', 'viewer')
      )
      OR user_id = auth.uid()
    )
  );

-- family_member_access policies:
-- Linked members own their own delegation decisions; admins/owners only manage
-- delegation for unlinked profiles (minors, HUF, offline elders).
CREATE OR REPLACE FUNCTION public.can_manage_family_member_access(
  p_family_member_id uuid,
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
    FROM public.family_members fm
    WHERE fm.id = p_family_member_id
      AND (
        fm.linked_user_id = p_user_id
        OR (
          fm.linked_user_id IS NULL
          AND public.is_household_admin_or_owner(fm.household_id, p_user_id)
        )
      )
  );
$$;

CREATE POLICY "Grantees, owning linked users, and unlinked admins can view member access grants"
  ON public.family_member_access FOR SELECT
  USING (
    public.is_household_member(household_id, auth.uid())
    AND (
      user_id = auth.uid()
      OR public.can_manage_family_member_access(family_member_id, auth.uid())
    )
  );

CREATE POLICY "Linked member or admin for unlinked member can grant access"
  ON public.family_member_access FOR INSERT
  WITH CHECK (
    public.is_household_member(household_id, auth.uid())
    AND public.can_manage_family_member_access(family_member_id, auth.uid())
  );

CREATE POLICY "Linked member or admin for unlinked member can update access"
  ON public.family_member_access FOR UPDATE
  USING (public.can_manage_family_member_access(family_member_id, auth.uid()))
  WITH CHECK (public.can_manage_family_member_access(family_member_id, auth.uid()));

CREATE POLICY "Linked member, admin for unlinked member, or grantee can revoke access"
  ON public.family_member_access FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.can_manage_family_member_access(family_member_id, auth.uid())
  );

-- household_audit_logs policies (append-only SELECT for owner/admin only)
CREATE POLICY "Household owners and admins can view household audit logs"
  ON public.household_audit_logs FOR SELECT
  USING (public.is_household_admin_or_owner(household_id, auth.uid()));

-- ------------------------------------------------------------------------------
-- 7. Onboarding Trigger & Default Household Bootstrap Functions
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_user_default_household(
  p_user_id uuid DEFAULT auth.uid(),
  p_display_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_household_id uuid;
  v_new_household_id uuid;
  v_name text;
  v_email text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- If called via client RPC, never allow provisioning for another user
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access Denied: Cannot bootstrap household for another user';
  END IF;

  SELECT hm.household_id INTO v_existing_household_id
  FROM public.household_members hm
  WHERE hm.user_id = p_user_id
    AND hm.status = 'active'
  ORDER BY CASE hm.household_role WHEN 'primary_owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
           hm.joined_at ASC
  LIMIT 1;

  IF v_existing_household_id IS NOT NULL THEN
    RETURN v_existing_household_id;
  END IF;

  SELECT
    u.email,
    COALESCE(
      NULLIF(trim(p_display_name), ''),
      NULLIF(trim(p.display_name), ''),
      NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(u.raw_user_meta_data->>'display_name'), ''),
      NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
      split_part(COALESCE(u.email, 'Member'), '@', 1)
    )
  INTO v_email, v_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = p_user_id;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'User not found in auth.users';
  END IF;

  INSERT INTO public.households (name, created_by)
  VALUES (v_name || '''s Household', p_user_id)
  RETURNING id INTO v_new_household_id;

  INSERT INTO public.household_members (household_id, user_id, household_role, status)
  VALUES (v_new_household_id, p_user_id, 'primary_owner', 'active');

  INSERT INTO public.family_members (
    household_id,
    linked_user_id,
    entity_type,
    name,
    relationship,
    color_hex,
    is_primary,
    email,
    created_by
  ) VALUES (
    v_new_household_id,
    p_user_id,
    'individual',
    v_name,
    'self',
    '#3b82f6',
    true,
    v_email,
    p_user_id
  )
  ON CONFLICT DO NOTHING;

  PERFORM public.log_household_action(
    v_new_household_id,
    p_user_id,
    'HOUSEHOLD_AUTO_CREATED',
    p_user_id,
    NULL,
    jsonb_build_object('source', 'bootstrap')
  );

  RETURN v_new_household_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
  v_household_id uuid;
  v_skip_default boolean;
BEGIN
  v_display_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(COALESCE(NEW.email, 'User'), '@', 1)
  );

  INSERT INTO public.profiles (id, display_name, default_currency)
  VALUES (NEW.id, v_display_name, 'INR')
  ON CONFLICT (id) DO NOTHING;

  v_skip_default := LOWER(COALESCE(NEW.raw_user_meta_data->>'skip_default_household', 'false')) = 'true';

  IF NOT v_skip_default THEN
    INSERT INTO public.households (name, created_by)
    VALUES (v_display_name || '''s Household', NEW.id)
    RETURNING id INTO v_household_id;

    INSERT INTO public.household_members (household_id, user_id, household_role, status)
    VALUES (v_household_id, NEW.id, 'primary_owner', 'active');

    INSERT INTO public.family_members (
      household_id,
      linked_user_id,
      entity_type,
      name,
      relationship,
      color_hex,
      is_primary,
      email,
      created_by
    ) VALUES (
      v_household_id,
      NEW.id,
      'individual',
      v_display_name,
      'self',
      '#3b82f6',
      true,
      NEW.email,
      NEW.id
    );

    PERFORM public.log_household_action(
      v_household_id,
      NEW.id,
      'HOUSEHOLD_AUTO_CREATED',
      NEW.id,
      NULL,
      jsonb_build_object('source', 'signup_trigger')
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill existing auth.users who have no household yet, and ensure every
-- household primary_owner/member has a clean linked family_member record.
DO $$
DECLARE
  u record;
  hm record;
BEGIN
  FOR u IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
    INSERT INTO public.profiles (id, display_name, default_currency)
    VALUES (
      u.id,
      COALESCE(
        NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
        NULLIF(trim(u.raw_user_meta_data->>'display_name'), ''),
        NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
        split_part(COALESCE(u.email, 'User'), '@', 1)
      ),
      'INR'
    )
    ON CONFLICT (id) DO NOTHING;

    IF NOT EXISTS (
      SELECT 1 FROM public.household_members m WHERE m.user_id = u.id AND m.status = 'active'
    ) THEN
      PERFORM public.ensure_user_default_household(u.id, NULL);
    END IF;
  END LOOP;

  FOR hm IN
    SELECT m.household_id, m.user_id, m.household_role, au.email,
           COALESCE(p.display_name, split_part(COALESCE(au.email, 'Member'), '@', 1)) AS display_name
    FROM public.household_members m
    JOIN auth.users au ON au.id = m.user_id
    LEFT JOIN public.profiles p ON p.id = m.user_id
    WHERE m.status = 'active'
  LOOP
    INSERT INTO public.family_members (
      household_id,
      linked_user_id,
      entity_type,
      name,
      relationship,
      color_hex,
      is_primary,
      email,
      created_by
    )
    SELECT
      hm.household_id,
      hm.user_id,
      'individual',
      hm.display_name,
      CASE WHEN hm.household_role = 'primary_owner' THEN 'self' ELSE 'other' END,
      '#3b82f6',
      (hm.household_role = 'primary_owner'),
      hm.email,
      hm.user_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.family_members fm
      WHERE fm.household_id = hm.household_id
        AND fm.linked_user_id = hm.user_id
    );
  END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. Governance RPCs (Admin Appointment, Role Changes, Ownership Transfer)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.appoint_household_admin(
  p_household_id uuid,
  p_target_user_id uuid,
  p_grant boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_target_role text;
  v_new_role text;
BEGIN
  IF v_caller_id IS NULL OR NOT public.is_household_primary_owner(p_household_id, v_caller_id) THEN
    RAISE EXCEPTION 'Access Denied: Only the household primary_owner can appoint or remove administrators';
  END IF;

  IF p_target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Administrative Invariant: Primary owner cannot be modified via appoint_household_admin';
  END IF;

  SELECT household_role INTO v_target_role
  FROM public.household_members
  WHERE household_id = p_household_id
    AND user_id = p_target_user_id
    AND status = 'active'
  FOR UPDATE;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not an active member of this household';
  END IF;

  IF v_target_role = 'primary_owner' THEN
    RAISE EXCEPTION 'Cannot demote primary_owner via appoint_household_admin';
  END IF;

  v_new_role := CASE WHEN p_grant THEN 'admin' ELSE 'member' END;

  UPDATE public.household_members
  SET household_role = v_new_role,
      updated_at = timezone('utc'::text, now())
  WHERE household_id = p_household_id
    AND user_id = p_target_user_id;

  PERFORM public.log_household_action(
    p_household_id,
    v_caller_id,
    CASE WHEN p_grant THEN 'ADMIN_APPOINTED' ELSE 'ADMIN_REMOVED' END,
    p_target_user_id,
    NULL,
    jsonb_build_object('previous_role', v_target_role, 'new_role', v_new_role)
  );

  RETURN jsonb_build_object(
    'success', true,
    'household_id', p_household_id,
    'target_user_id', p_target_user_id,
    'household_role', v_new_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_household_member_role(
  p_household_id uuid,
  p_target_user_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
BEGIN
  IF p_role NOT IN ('admin', 'member', 'viewer') THEN
    RAISE EXCEPTION 'Invalid household role: % (ownership must use transfer_household_primary_owner)', p_role;
  END IF;

  v_caller_role := public.get_household_role(p_household_id, v_caller_id);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('primary_owner', 'admin') THEN
    RAISE EXCEPTION 'Access Denied: Caller does not manage roles in this household';
  END IF;

  SELECT household_role INTO v_target_role
  FROM public.household_members
  WHERE household_id = p_household_id
    AND user_id = p_target_user_id
    AND status = 'active'
  FOR UPDATE;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not an active member of this household';
  END IF;

  IF v_target_role = 'primary_owner' THEN
    RAISE EXCEPTION 'Cannot change primary_owner role directly; use transfer_household_primary_owner()';
  END IF;

  IF (p_role = 'admin' OR v_target_role = 'admin') AND v_caller_role IS DISTINCT FROM 'primary_owner' THEN
    RAISE EXCEPTION 'Access Denied: Only the primary_owner can appoint or demote administrators';
  END IF;

  UPDATE public.household_members
  SET household_role = p_role,
      updated_at = timezone('utc'::text, now())
  WHERE household_id = p_household_id
    AND user_id = p_target_user_id;

  PERFORM public.log_household_action(
    p_household_id,
    v_caller_id,
    'MEMBER_ROLE_CHANGED',
    p_target_user_id,
    NULL,
    jsonb_build_object('previous_role', v_target_role, 'new_role', p_role)
  );

  RETURN jsonb_build_object(
    'success', true,
    'household_id', p_household_id,
    'target_user_id', p_target_user_id,
    'household_role', p_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_household_primary_owner(
  p_household_id uuid,
  p_new_owner_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_target_status text;
  v_confirmed_at timestamptz;
BEGIN
  IF v_caller_id IS NULL OR NOT public.is_household_primary_owner(p_household_id, v_caller_id) THEN
    RAISE EXCEPTION 'Access Denied: Only the active primary_owner can transfer household ownership';
  END IF;

  IF p_new_owner_user_id IS NULL OR p_new_owner_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Transfer target must be another active member of the household';
  END IF;

  SELECT hm.status INTO v_target_status
  FROM public.household_members hm
  WHERE hm.household_id = p_household_id
    AND hm.user_id = p_new_owner_user_id
  FOR UPDATE;

  IF v_target_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Ownership transfer requires an active household member';
  END IF;

  SELECT u.email_confirmed_at INTO v_confirmed_at
  FROM auth.users u
  WHERE u.id = p_new_owner_user_id;

  IF v_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Ownership can only be transferred to a verified account';
  END IF;

  -- Perform atomic demote-then-promote under controlled transition flag
  PERFORM set_config('wealthnest.allow_owner_transition', 'true', true);

  UPDATE public.household_members
  SET household_role = 'admin',
      updated_at = timezone('utc'::text, now())
  WHERE household_id = p_household_id
    AND user_id = v_caller_id
    AND household_role = 'primary_owner'
    AND status = 'active';

  UPDATE public.household_members
  SET household_role = 'primary_owner',
      updated_at = timezone('utc'::text, now())
  WHERE household_id = p_household_id
    AND user_id = p_new_owner_user_id
    AND status = 'active';

  PERFORM set_config('wealthnest.allow_owner_transition', 'false', true);

  PERFORM public.log_household_action(
    p_household_id,
    v_caller_id,
    'PRIMARY_OWNER_TRANSFERRED',
    p_new_owner_user_id,
    NULL,
    jsonb_build_object('previous_owner_user_id', v_caller_id, 'new_owner_user_id', p_new_owner_user_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'household_id', p_household_id,
    'previous_owner_user_id', v_caller_id,
    'new_owner_user_id', p_new_owner_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_or_restore_household_member(
  p_household_id uuid,
  p_target_user_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
  v_prev_status text;
BEGIN
  IF p_status NOT IN ('active', 'suspended', 'revoked') THEN
    RAISE EXCEPTION 'Invalid membership status: %', p_status;
  END IF;

  v_caller_role := public.get_household_role(p_household_id, v_caller_id);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('primary_owner', 'admin') THEN
    RAISE EXCEPTION 'Access Denied: Insufficient household permissions';
  END IF;

  SELECT household_role, status INTO v_target_role, v_prev_status
  FROM public.household_members
  WHERE household_id = p_household_id
    AND user_id = p_target_user_id
  FOR UPDATE;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target membership not found';
  END IF;

  IF v_target_role = 'primary_owner' THEN
    RAISE EXCEPTION 'Active primary_owner cannot be suspended or revoked; transfer ownership first';
  END IF;

  IF v_target_role = 'admin' AND v_caller_role IS DISTINCT FROM 'primary_owner' THEN
    RAISE EXCEPTION 'Access Denied: Only the primary_owner can suspend or revoke an administrator';
  END IF;

  UPDATE public.household_members
  SET status = p_status,
      updated_at = timezone('utc'::text, now())
  WHERE household_id = p_household_id
    AND user_id = p_target_user_id;

  PERFORM public.log_household_action(
    p_household_id,
    v_caller_id,
    'MEMBER_STATUS_CHANGED',
    p_target_user_id,
    NULL,
    jsonb_build_object('previous_status', v_prev_status, 'new_status', p_status, 'role', v_target_role)
  );

  RETURN jsonb_build_object(
    'success', true,
    'household_id', p_household_id,
    'target_user_id', p_target_user_id,
    'status', p_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_household_with_self(
  p_name text,
  p_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_household_id uuid;
  v_family_member_id uuid;
  v_member_name text;
  v_email text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'Household name must be at least 2 characters';
  END IF;

  SELECT
    u.email,
    COALESCE(
      NULLIF(trim(p_display_name), ''),
      NULLIF(trim(p.display_name), ''),
      split_part(COALESCE(u.email, 'Member'), '@', 1)
    )
  INTO v_email, v_member_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = v_caller_id;

  INSERT INTO public.households (name, created_by)
  VALUES (trim(p_name), v_caller_id)
  RETURNING id INTO v_household_id;

  INSERT INTO public.household_members (household_id, user_id, household_role, status)
  VALUES (v_household_id, v_caller_id, 'primary_owner', 'active');

  INSERT INTO public.family_members (
    household_id,
    linked_user_id,
    entity_type,
    name,
    relationship,
    color_hex,
    is_primary,
    email,
    created_by
  ) VALUES (
    v_household_id,
    v_caller_id,
    'individual',
    v_member_name,
    'self',
    '#3b82f6',
    true,
    v_email,
    v_caller_id
  )
  RETURNING id INTO v_family_member_id;

  PERFORM public.log_household_action(
    v_household_id,
    v_caller_id,
    'HOUSEHOLD_CREATED',
    v_caller_id,
    v_family_member_id,
    jsonb_build_object('household_name', trim(p_name))
  );

  RETURN jsonb_build_object(
    'id', v_household_id,
    'name', trim(p_name),
    'household_role', 'primary_owner',
    'linked_family_member_id', v_family_member_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_households()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT
      h.id,
      h.name,
      hm.household_role,
      hm.status,
      hm.joined_at,
      fm.id AS linked_family_member_id,
      (SELECT COUNT(*) FROM public.household_members m WHERE m.household_id = h.id AND m.status = 'active') AS active_member_count,
      (SELECT COUNT(*) FROM public.family_members f WHERE f.household_id = h.id) AS family_entity_count
    FROM public.household_members hm
    JOIN public.households h ON h.id = hm.household_id
    LEFT JOIN public.family_members fm ON fm.household_id = h.id AND fm.linked_user_id = v_caller_id
    WHERE hm.user_id = v_caller_id
      AND hm.status = 'active'
    ORDER BY
      CASE hm.household_role WHEN 'primary_owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'member' THEN 3 ELSE 4 END,
      hm.joined_at ASC
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_household_access_members(p_household_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_rows jsonb;
BEGIN
  v_caller_role := public.get_household_role(p_household_id, v_caller_id);
  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Access Denied: You do not belong to this household';
  END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT
      hm.id,
      hm.household_id,
      hm.user_id,
      hm.household_role,
      hm.status,
      hm.joined_at,
      COALESCE(p.display_name, split_part(COALESCE(u.email, 'User'), '@', 1)) AS display_name,
      CASE
        WHEN v_caller_role IN ('primary_owner', 'admin') OR hm.user_id = v_caller_id THEN u.email
        ELSE NULL
      END AS email,
      fm.id AS linked_family_member_id,
      fm.name AS linked_family_member_name
    FROM public.household_members hm
    JOIN auth.users u ON u.id = hm.user_id
    LEFT JOIN public.profiles p ON p.id = hm.user_id
    LEFT JOIN public.family_members fm ON fm.household_id = hm.household_id AND fm.linked_user_id = hm.user_id
    WHERE hm.household_id = p_household_id
    ORDER BY
      CASE hm.household_role WHEN 'primary_owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'member' THEN 3 ELSE 4 END,
      hm.joined_at ASC
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

-- Restrict execute permissions explicitly (defense against 000011 default grants)
REVOKE ALL ON FUNCTION public.is_household_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_household_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_household_primary_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_household_admin_or_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_household_content(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_bootstrap_household_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.household_creator_unchanged(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_family_member_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_household_action(uuid, uuid, text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_user_default_household(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.appoint_household_admin(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_household_member_role(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_household_primary_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_or_restore_household_member(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_household_with_self(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_households() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_household_access_members(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_household_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_primary_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_admin_or_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_household_content(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_bootstrap_household_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.household_creator_unchanged(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_family_member_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_default_household(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.appoint_household_admin(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_household_member_role(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_household_primary_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_or_restore_household_member(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_household_with_self(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_households() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_household_access_members(uuid) TO authenticated;
