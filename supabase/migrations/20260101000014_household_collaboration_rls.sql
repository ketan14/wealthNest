-- ==============================================================================
-- WealthNest Phase 14: Multi-User Household Collaboration & RLS Sharing Migration
-- ==============================================================================
-- 1. Helper function: Returns true if user_a and user_b share an active household
-- 2. Helper function: Returns true if user has edit/write access in a household
-- 3. Update RLS policies on financial tables:
--    - holdings
--    - assets
--    - transactions
--    - liabilities
--    - liability_balances
--    - asset_valuations
--    - goals
--    - goal_holding_allocations
--    - family_members
--    - portfolio_accounts
-- ==============================================================================

-- 1. Function to check if check_user_id and target_user_id belong to the same household
CREATE OR REPLACE FUNCTION public.is_same_household(check_user_id uuid, target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT (
    check_user_id = target_user_id
    OR EXISTS (
      SELECT 1
      FROM public.household_members m1
      JOIN public.household_members m2 ON m1.household_id = m2.household_id
      WHERE m1.user_id = check_user_id
        AND m2.user_id = target_user_id
    )
  );
$$;

-- 2. Function to check if a user has edit permissions for records owned by target_user_id
CREATE OR REPLACE FUNCTION public.can_edit_household_record(check_user_id uuid, target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT (
    check_user_id = target_user_id
    OR EXISTS (
      SELECT 1
      FROM public.household_members m1
      JOIN public.household_members m2 ON m1.household_id = m2.household_id
      WHERE m1.user_id = check_user_id
        AND m2.user_id = target_user_id
        AND m1.household_role IN ('primary_owner', 'member')
    )
  );
$$;

-- ==============================================================================
-- RLS POLICIES UPDATE
-- ==============================================================================

-- 3. Assets Table
DROP POLICY IF EXISTS "Users can view their own assets" ON public.assets;
CREATE POLICY "Users and household members can view assets"
  ON public.assets FOR SELECT
  USING (public.is_same_household(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can update their own assets" ON public.assets;
CREATE POLICY "Users and household editors can update assets"
  ON public.assets FOR UPDATE
  USING (public.can_edit_household_record(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete their own assets" ON public.assets;
CREATE POLICY "Users and household editors can delete assets"
  ON public.assets FOR DELETE
  USING (public.can_edit_household_record(auth.uid(), user_id));

-- 4. Holdings Table
DROP POLICY IF EXISTS "Users can view their own holdings" ON public.holdings;
CREATE POLICY "Users and household members can view holdings"
  ON public.holdings FOR SELECT
  USING (public.is_same_household(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can manage their own holdings" ON public.holdings;
CREATE POLICY "Users and household editors can manage holdings"
  ON public.holdings FOR ALL
  USING (public.can_edit_household_record(auth.uid(), user_id))
  WITH CHECK (public.can_edit_household_record(auth.uid(), user_id));

-- 5. Transactions Table
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users and household members can view transactions"
  ON public.transactions FOR SELECT
  USING (public.is_same_household(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
CREATE POLICY "Users and household editors can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (public.can_edit_household_record(auth.uid(), user_id));

-- 6. Liabilities Table
DROP POLICY IF EXISTS "Users can manage their own liabilities" ON public.liabilities;
CREATE POLICY "Users and household editors can manage liabilities"
  ON public.liabilities FOR ALL
  USING (public.is_same_household(auth.uid(), user_id))
  WITH CHECK (public.can_edit_household_record(auth.uid(), user_id));

-- 7. Liability Balances Table
DROP POLICY IF EXISTS "Users can manage their own liability balances" ON public.liability_balances;
CREATE POLICY "Users and household editors can manage liability balances"
  ON public.liability_balances FOR ALL
  USING (public.is_same_household(auth.uid(), user_id))
  WITH CHECK (public.can_edit_household_record(auth.uid(), user_id));

-- 8. Asset Valuations Table
DROP POLICY IF EXISTS "Users can manage their own asset valuations" ON public.asset_valuations;
CREATE POLICY "Users and household editors can manage asset valuations"
  ON public.asset_valuations FOR ALL
  USING (public.is_same_household(auth.uid(), user_id))
  WITH CHECK (public.can_edit_household_record(auth.uid(), user_id));

-- 9. Goals Table
DROP POLICY IF EXISTS "Users can manage their own goals" ON public.goals;
CREATE POLICY "Users and household editors can manage goals"
  ON public.goals FOR ALL
  USING (public.is_same_household(auth.uid(), user_id))
  WITH CHECK (public.can_edit_household_record(auth.uid(), user_id));

-- 10. Goal Holding Allocations Table
DROP POLICY IF EXISTS "Users can manage their own goal holding allocations" ON public.goal_holding_allocations;
CREATE POLICY "Users and household editors can manage goal allocations"
  ON public.goal_holding_allocations FOR ALL
  USING (public.is_same_household(auth.uid(), user_id))
  WITH CHECK (public.can_edit_household_record(auth.uid(), user_id));

-- 11. Family Members Table
DROP POLICY IF EXISTS "Users can manage their own family members" ON public.family_members;
CREATE POLICY "Users and household editors can manage family members"
  ON public.family_members FOR ALL
  USING (public.is_same_household(auth.uid(), user_id))
  WITH CHECK (public.can_edit_household_record(auth.uid(), user_id));

-- 12. Portfolio Accounts Table
DROP POLICY IF EXISTS "Users can manage their own portfolio accounts" ON public.portfolio_accounts;
CREATE POLICY "Users and household editors can manage portfolio accounts"
  ON public.portfolio_accounts FOR ALL
  USING (public.is_same_household(auth.uid(), user_id))
  WITH CHECK (public.can_edit_household_record(auth.uid(), user_id));

