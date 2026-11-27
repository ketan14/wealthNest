-- ==============================================================================
-- WealthNest Phase 1: Plan Tiers, Quotas & Admin Plan Management
-- Migration: 20260101000027_plan_tiers_and_quotas.sql
--
-- Implements:
--   1. plan_tier ('free' | 'pro' | 'family') on public.profiles & public.households
--   2. Server-side quota enforcement triggers on holdings (investment & real_estate),
--      liabilities (active), goals, family_members, portfolio_accounts, family_documents
--   3. Updated get_my_households(), admin_get_users(), admin_get_user_detail(),
--      admin_get_households(), create_household_with_self() exposing plan_tier
--   4. Admin RPCs: admin_set_user_plan() and admin_set_household_plan()
--      with immutable admin_audit_logs tracking (PLAN_TIER_CHANGED)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Add plan_tier columns to profiles and households
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'free';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_tier_check
  CHECK (plan_tier IN ('free', 'pro', 'family'));

ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'free';

ALTER TABLE public.households
  DROP CONSTRAINT IF EXISTS households_plan_tier_check;

ALTER TABLE public.households
  ADD CONSTRAINT households_plan_tier_check
  CHECK (plan_tier IN ('free', 'pro', 'family'));

-- Preserve unlimited Family Office access for the bootstrapped platform owner & Vaghela Household
UPDATE public.profiles
SET plan_tier = 'family',
    updated_at = timezone('utc'::text, now())
WHERE id = '4c4fa116-57d5-4fc8-af89-be56b5069b50';

UPDATE public.households
SET plan_tier = 'family',
    updated_at = timezone('utc'::text, now())
WHERE id = 'a0000000-0000-0000-0000-000000000001'::uuid
   OR created_by = '4c4fa116-57d5-4fc8-af89-be56b5069b50'::uuid;

-- ------------------------------------------------------------------------------
-- 2. Helper: Get active household plan tier (defaults safely to 'free')
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_household_plan_tier(p_household_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT h.plan_tier
      FROM public.households h
      WHERE h.id = p_household_id
      LIMIT 1
    ),
    'free'
  );
$$;

-- ------------------------------------------------------------------------------
-- 3. Inherit creator's profile plan_tier in create_household_with_self()
-- ------------------------------------------------------------------------------
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
  v_plan_tier text;
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
    ),
    COALESCE(p.plan_tier, 'free')
  INTO v_email, v_member_name, v_plan_tier
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = v_caller_id;

  IF v_plan_tier IS NULL OR v_plan_tier NOT IN ('free', 'pro', 'family') THEN
    v_plan_tier := 'free';
  END IF;

  INSERT INTO public.households (name, created_by, plan_tier)
  VALUES (trim(p_name), v_caller_id, v_plan_tier)
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
    jsonb_build_object('household_name', trim(p_name), 'plan_tier', v_plan_tier)
  );

  RETURN jsonb_build_object(
    'id', v_household_id,
    'name', trim(p_name),
    'household_role', 'primary_owner',
    'plan_tier', v_plan_tier,
    'linked_family_member_id', v_family_member_id
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Update get_my_households() to return plan_tier
-- ------------------------------------------------------------------------------
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
      COALESCE(h.plan_tier, 'free') AS plan_tier,
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

-- ------------------------------------------------------------------------------
-- 5. Update Admin Read RPCs to include plan_tier
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
      COALESCE(p.plan_tier, 'free') AS plan_tier,
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
    'plan_tier', COALESCE(p.plan_tier, 'free'),
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
      COALESCE(h.plan_tier, 'free') AS plan_tier,
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
      COALESCE(h.plan_tier, 'free') AS plan_tier,
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

-- ------------------------------------------------------------------------------
-- 6. Admin Plan Mutation RPCs (null-safe RBAC guards + immutable audit logging)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_user_plan(
  p_target_user_id uuid,
  p_plan_tier text,
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
  v_previous_plan text;
  v_email text;
  v_display_name text;
  v_households_updated int := 0;
BEGIN
  v_caller_role := public.get_platform_admin_role(v_caller_id);

  IF v_caller_id IS NULL OR v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'support_admin') THEN
    RAISE EXCEPTION 'Access Denied: Insufficient permissions to change user plan';
  END IF;

  IF p_plan_tier IS NULL OR p_plan_tier NOT IN ('free', 'pro', 'family') THEN
    RAISE EXCEPTION 'Invalid plan tier: %. Allowed values: free, pro, family', p_plan_tier;
  END IF;

  SELECT
    u.email,
    COALESCE(p.display_name, split_part(COALESCE(u.email, 'User'), '@', 1)),
    COALESCE(p.plan_tier, 'free')
  INTO v_email, v_display_name, v_previous_plan
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = p_target_user_id;

  IF v_email IS NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  INSERT INTO public.profiles (id, display_name, default_currency, plan_tier, updated_at)
  VALUES (
    p_target_user_id,
    COALESCE(v_display_name, 'Investor'),
    'INR',
    p_plan_tier,
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    plan_tier = EXCLUDED.plan_tier,
    updated_at = timezone('utc'::text, now());

  -- Sync all households where the target user is the active primary_owner (or creator fallback)
  UPDATE public.households h
  SET plan_tier = p_plan_tier,
      updated_at = timezone('utc'::text, now())
  WHERE h.id IN (
    SELECT hm.household_id
    FROM public.household_members hm
    WHERE hm.user_id = p_target_user_id
      AND hm.household_role = 'primary_owner'
      AND hm.status = 'active'
  )
  OR (
    h.created_by = p_target_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.household_members hm2
      WHERE hm2.household_id = h.id
        AND hm2.household_role = 'primary_owner'
        AND hm2.status = 'active'
        AND hm2.user_id <> p_target_user_id
    )
  );

  GET DIAGNOSTICS v_households_updated = ROW_COUNT;

  PERFORM public.log_admin_action(
    v_caller_id,
    p_target_user_id,
    'PLAN_TIER_CHANGED',
    'success',
    'ADMIN_PLAN_UPDATE',
    jsonb_build_object(
      'scope', 'user',
      'previous_plan', COALESCE(v_previous_plan, 'free'),
      'new_plan', p_plan_tier,
      'households_updated', v_households_updated,
      'reason_details', p_reason_details
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'previous_plan', COALESCE(v_previous_plan, 'free'),
    'new_plan', p_plan_tier,
    'households_updated', v_households_updated
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_household_plan(
  p_household_id uuid,
  p_plan_tier text,
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
  v_previous_plan text;
  v_household_name text;
  v_owner_id uuid;
BEGIN
  v_caller_role := public.get_platform_admin_role(v_caller_id);

  IF v_caller_id IS NULL OR v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'support_admin') THEN
    RAISE EXCEPTION 'Access Denied: Insufficient permissions to change household plan';
  END IF;

  IF p_plan_tier IS NULL OR p_plan_tier NOT IN ('free', 'pro', 'family') THEN
    RAISE EXCEPTION 'Invalid plan tier: %. Allowed values: free, pro, family', p_plan_tier;
  END IF;

  SELECT h.name, COALESCE(h.plan_tier, 'free'), h.created_by
  INTO v_household_name, v_previous_plan, v_owner_id
  FROM public.households h
  WHERE h.id = p_household_id;

  IF v_household_name IS NULL THEN
    RAISE EXCEPTION 'Household not found';
  END IF;

  SELECT COALESCE(
    (
      SELECT hm.user_id
      FROM public.household_members hm
      WHERE hm.household_id = p_household_id
        AND hm.household_role = 'primary_owner'
        AND hm.status = 'active'
      LIMIT 1
    ),
    v_owner_id
  )
  INTO v_owner_id;

  UPDATE public.households
  SET plan_tier = p_plan_tier,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_household_id;

  PERFORM public.log_admin_action(
    v_caller_id,
    v_owner_id,
    'PLAN_TIER_CHANGED',
    'success',
    'ADMIN_HOUSEHOLD_PLAN_UPDATE',
    jsonb_build_object(
      'scope', 'household',
      'household_id', p_household_id,
      'household_name', v_household_name,
      'previous_plan', COALESCE(v_previous_plan, 'free'),
      'new_plan', p_plan_tier,
      'reason_details', p_reason_details
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'household_id', p_household_id,
    'previous_plan', COALESCE(v_previous_plan, 'free'),
    'new_plan', p_plan_tier
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Server-Side Quota Enforcement Triggers (Tamper-Proof BEFORE INSERT Guards)
-- ------------------------------------------------------------------------------

-- 7a. Holdings quota trigger (investment holdings vs real_estate properties)
CREATE OR REPLACE FUNCTION public.enforce_holding_plan_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_asset_class text;
  v_limit int;
  v_current_count int;
  v_resource text;
BEGIN
  IF NEW.household_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_plan := public.get_household_plan_tier(NEW.household_id);

  SELECT a.asset_class_id INTO v_asset_class
  FROM public.assets a
  WHERE a.id = NEW.asset_id;

  IF v_asset_class = 'real_estate' THEN
    v_resource := 'realEstate';
    v_limit := CASE v_plan
      WHEN 'free' THEN 1
      WHEN 'pro' THEN 5
      ELSE NULL
    END;

    IF v_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_current_count
      FROM public.holdings h
      JOIN public.assets a ON a.id = h.asset_id
      WHERE h.household_id = NEW.household_id
        AND a.asset_class_id = 'real_estate';

      IF v_current_count >= v_limit THEN
        RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED:%:%:Your % plan allows up to % Real Estate property entries. Upgrade your plan to add more.',
          v_resource, v_limit, v_plan, v_limit
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  ELSE
    v_resource := 'holdings';
    v_limit := CASE v_plan
      WHEN 'free' THEN 5
      ELSE NULL
    END;

    IF v_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_current_count
      FROM public.holdings h
      JOIN public.assets a ON a.id = h.asset_id
      WHERE h.household_id = NEW.household_id
        AND COALESCE(a.asset_class_id, '') <> 'real_estate';

      IF v_current_count >= v_limit THEN
        RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED:%:%:Your % plan allows up to % investment holdings. Upgrade your plan to add more.',
          v_resource, v_limit, v_plan, v_limit
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_holding_plan_quota ON public.holdings;
CREATE TRIGGER trg_enforce_holding_plan_quota
  BEFORE INSERT ON public.holdings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_holding_plan_quota();

-- 7b. Active Liabilities quota trigger
CREATE OR REPLACE FUNCTION public.enforce_liability_plan_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limit int;
  v_current_count int;
BEGIN
  IF NEW.household_id IS NULL OR COALESCE(NEW.status, 'active') = 'closed' THEN
    RETURN NEW;
  END IF;

  v_plan := public.get_household_plan_tier(NEW.household_id);
  v_limit := CASE v_plan
    WHEN 'free' THEN 1
    WHEN 'pro' THEN 5
    ELSE NULL
  END;

  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM public.liabilities l
    WHERE l.household_id = NEW.household_id
      AND COALESCE(l.status, 'active') <> 'closed';

    IF v_current_count >= v_limit THEN
      RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED:activeLoans:%:Your % plan allows up to % active loan(s). Upgrade your plan to add more.',
        v_limit, v_plan, v_limit
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_liability_plan_quota ON public.liabilities;
CREATE TRIGGER trg_enforce_liability_plan_quota
  BEFORE INSERT ON public.liabilities
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_liability_plan_quota();

-- 7c. Financial Goals quota trigger
CREATE OR REPLACE FUNCTION public.enforce_goal_plan_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limit int;
  v_current_count int;
BEGIN
  IF NEW.household_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_plan := public.get_household_plan_tier(NEW.household_id);
  v_limit := CASE v_plan
    WHEN 'free' THEN 2
    ELSE NULL
  END;

  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM public.goals g
    WHERE g.household_id = NEW.household_id;

    IF v_current_count >= v_limit THEN
      RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED:goals:%:Your % plan allows up to % financial goal(s). Upgrade your plan to add more.',
        v_limit, v_plan, v_limit
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_goal_plan_quota ON public.goals;
CREATE TRIGGER trg_enforce_goal_plan_quota
  BEFORE INSERT ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_goal_plan_quota();

-- 7d. Family Members quota trigger (allows initial self member creation)
CREATE OR REPLACE FUNCTION public.enforce_family_member_plan_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limit int;
  v_current_count int;
BEGIN
  IF NEW.household_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_plan := public.get_household_plan_tier(NEW.household_id);
  v_limit := CASE v_plan
    WHEN 'free' THEN 1
    WHEN 'pro' THEN 2
    ELSE NULL
  END;

  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM public.family_members fm
    WHERE fm.household_id = NEW.household_id;

    IF v_current_count >= v_limit THEN
      RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED:familyMembers:%:Your % plan allows up to % family member profile(s). Upgrade your plan to add more.',
        v_limit, v_plan, v_limit
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_family_member_plan_quota ON public.family_members;
CREATE TRIGGER trg_enforce_family_member_plan_quota
  BEFORE INSERT ON public.family_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_family_member_plan_quota();

-- 7e. Portfolio / Broker / Demat Accounts quota trigger
CREATE OR REPLACE FUNCTION public.enforce_portfolio_account_plan_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limit int;
  v_current_count int;
BEGIN
  IF NEW.household_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_plan := public.get_household_plan_tier(NEW.household_id);
  v_limit := CASE v_plan
    WHEN 'free' THEN 1
    WHEN 'pro' THEN 5
    ELSE NULL
  END;

  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM public.portfolio_accounts pa
    WHERE pa.household_id = NEW.household_id;

    IF v_current_count >= v_limit THEN
      RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED:accounts:%:Your % plan allows up to % broker/demat account(s). Upgrade your plan to add more.',
        v_limit, v_plan, v_limit
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_portfolio_account_plan_quota ON public.portfolio_accounts;
CREATE TRIGGER trg_enforce_portfolio_account_plan_quota
  BEFORE INSERT ON public.portfolio_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_portfolio_account_plan_quota();

-- 7f. Family Documents Vault quota trigger
CREATE OR REPLACE FUNCTION public.enforce_document_plan_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limit int;
  v_current_count int;
BEGIN
  IF NEW.household_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_plan := public.get_household_plan_tier(NEW.household_id);
  v_limit := CASE v_plan
    WHEN 'free' THEN 3
    WHEN 'pro' THEN 50
    ELSE NULL
  END;

  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM public.family_documents fd
    WHERE fd.household_id = NEW.household_id;

    IF v_current_count >= v_limit THEN
      RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED:documents:%:Your % plan allows up to % vault document(s). Upgrade your plan to upload more.',
        v_limit, v_plan, v_limit
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_document_plan_quota ON public.family_documents;
CREATE TRIGGER trg_enforce_document_plan_quota
  BEFORE INSERT ON public.family_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_document_plan_quota();

-- ------------------------------------------------------------------------------
-- 8. Explicit Function Grants
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_household_plan_tier(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_user_plan(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_household_plan(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_holding_plan_quota() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_liability_plan_quota() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_goal_plan_quota() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_family_member_plan_quota() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_portfolio_account_plan_quota() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_document_plan_quota() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_household_plan_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_plan(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_household_plan(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_household_with_self(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_households() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_users(int, int, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_households(int, int, text) TO authenticated;
