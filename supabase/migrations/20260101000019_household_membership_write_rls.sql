-- ============================================================================
-- Migration 000019: Household & Household Membership Write RLS + Helper Functions
-- Resolves HH-03: Enforces least-privilege INSERT, UPDATE, and DELETE policies
-- on public.households and public.household_members and replaces the recursive
-- inline SELECT policy on public.household_members with SECURITY DEFINER helpers.
-- ============================================================================

-- 1. Non-recursive SECURITY DEFINER helper functions
CREATE OR REPLACE FUNCTION public.is_household_member(
  check_household_id uuid,
  check_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members hm
    WHERE hm.household_id = check_household_id
      AND hm.user_id = check_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_household_primary_owner(
  check_household_id uuid,
  check_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members hm
    WHERE hm.household_id = check_household_id
      AND hm.user_id = check_user_id
      AND hm.household_role = 'primary_owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_bootstrap_household_owner(
  check_household_id uuid,
  check_user_id uuid
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
    WHERE h.id = check_household_id
      AND h.created_by = check_user_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.household_members hm
    WHERE hm.household_id = check_household_id
  );
$$;

CREATE OR REPLACE FUNCTION public.household_creator_unchanged(
  check_household_id uuid,
  new_created_by uuid
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
    WHERE h.id = check_household_id
      AND h.created_by IS NOT DISTINCT FROM new_created_by
  );
$$;

REVOKE ALL ON FUNCTION public.is_household_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_household_primary_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_bootstrap_household_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.household_creator_unchanged(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_primary_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_bootstrap_household_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.household_creator_unchanged(uuid, uuid) TO authenticated;

-- 2. Replace & harden policies on public.households
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household members view household" ON public.households;
CREATE POLICY "Household members view household"
  ON public.households FOR SELECT
  TO authenticated
  USING (
    public.is_household_member(id, auth.uid())
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Authenticated users can create households" ON public.households;
CREATE POLICY "Authenticated users can create households"
  ON public.households FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Primary owners can update households" ON public.households;
CREATE POLICY "Primary owners can update households"
  ON public.households FOR UPDATE
  TO authenticated
  USING (
    public.is_household_primary_owner(id, auth.uid())
  )
  WITH CHECK (
    public.is_household_primary_owner(id, auth.uid())
    AND public.household_creator_unchanged(id, created_by)
  );

DROP POLICY IF EXISTS "Primary owners can delete households" ON public.households;
CREATE POLICY "Primary owners can delete households"
  ON public.households FOR DELETE
  TO authenticated
  USING (
    public.is_household_primary_owner(id, auth.uid())
  );

-- 3. Replace & harden policies on public.household_members
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household members view members" ON public.household_members;
CREATE POLICY "Household members view members"
  ON public.household_members FOR SELECT
  TO authenticated
  USING (
    public.is_household_member(household_id, auth.uid())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Primary owners or creator bootstrap can add household members" ON public.household_members;
CREATE POLICY "Primary owners or creator bootstrap can add household members"
  ON public.household_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_household_primary_owner(household_id, auth.uid())
    OR (
      user_id = auth.uid()
      AND household_role = 'primary_owner'
      AND public.can_bootstrap_household_owner(household_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Primary owners can update household members" ON public.household_members;
CREATE POLICY "Primary owners can update household members"
  ON public.household_members FOR UPDATE
  TO authenticated
  USING (
    public.is_household_primary_owner(household_id, auth.uid())
  )
  WITH CHECK (
    public.is_household_primary_owner(household_id, auth.uid())
  );

DROP POLICY IF EXISTS "Primary owners can remove members or members can leave" ON public.household_members;
CREATE POLICY "Primary owners can remove members or members can leave"
  ON public.household_members FOR DELETE
  TO authenticated
  USING (
    public.is_household_primary_owner(household_id, auth.uid())
    OR user_id = auth.uid()
  );

