-- ==============================================================================
-- WealthNest Phase 2: Live Plan Usage, Custom Admin Overrides, Trial Expiry &
-- Self-Service Plan Upgrade Requests
-- Migration: 20260101000028_plan_phase2_overrides_and_upgrade_requests.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Schema Extensions: custom_limits, plan_expires_at & plan_upgrade_requests
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz DEFAULT NULL;

ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS custom_limits jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.plan_upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  current_plan text NOT NULL CHECK (current_plan IN ('free', 'pro', 'family')),
  requested_plan text NOT NULL CHECK (requested_plan IN ('pro', 'family')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  user_notes text,
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_upgrade_request_per_household
  ON public.plan_upgrade_requests (household_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_plan_upgrade_requests_status_created
  ON public.plan_upgrade_requests (status, created_at DESC);

ALTER TABLE public.plan_upgrade_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own plan upgrade requests" ON public.plan_upgrade_requests;
CREATE POLICY "Users can view their own plan upgrade requests"
  ON public.plan_upgrade_requests FOR SELECT
  USING (auth.uid() = user_id OR public.is_household_member(household_id, auth.uid()));

DROP POLICY IF EXISTS "Users can create plan upgrade requests for their households" ON public.plan_upgrade_requests;
CREATE POLICY "Users can create plan upgrade requests for their households"
  ON public.plan_upgrade_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_household_member(household_id, auth.uid()));

GRANT SELECT, INSERT ON TABLE public.plan_upgrade_requests TO authenticated;
GRANT ALL ON TABLE public.plan_upgrade_requests TO service_role;

-- ------------------------------------------------------------------------------
-- 2. Effective Plan Tier & Custom Quota Helper Functions
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
      SELECT CASE
        WHEN COALESCE(h.plan_tier, 'free') <> 'free'
         AND h.plan_expires_at IS NOT NULL
         AND h.plan_expires_at < timezone('utc'::text, now())
        THEN 'free'
        ELSE COALESCE(h.plan_tier, 'free')
      END
      FROM public.households h
      WHERE h.id = p_household_id
      LIMIT 1
    ),
    'free'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_household_effective_limit(
  p_household_id uuid,
  p_resource text
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_custom_limits jsonb;
  v_override_type text;
BEGIN
  v_plan := public.get_household_plan_tier(p_household_id);

  SELECT h.custom_limits INTO v_custom_limits
  FROM public.households h
  WHERE h.id = p_household_id
  LIMIT 1;

  IF v_custom_limits IS NOT NULL AND v_custom_limits ? p_resource THEN
    v_override_type := jsonb_typeof(v_custom_limits -> p_resource);
    IF v_override_type = 'null' THEN
      RETURN NULL;
    ELSIF v_override_type = 'number' THEN
      RETURN GREATEST(0, floor((v_custom_limits ->> p_resource)::numeric)::int);
    END IF;
  END IF;

  RETURN CASE p_resource
    WHEN 'holdings' THEN
      CASE v_plan WHEN 'free' THEN 5 ELSE NULL END
    WHEN 'realEstate' THEN
      CASE v_plan WHEN 'free' THEN 1 WHEN 'pro' THEN 5 ELSE NULL END
    WHEN 'activeLoans' THEN
      CASE v_plan WHEN 'free' THEN 1 WHEN 'pro' THEN 5 ELSE NULL END
    WHEN 'goals' THEN
      CASE v_plan WHEN 'free' THEN 2 ELSE NULL END
    WHEN 'familyMembers' THEN
      CASE v_plan WHEN 'free' THEN 1 WHEN 'pro' THEN 2 ELSE NULL END
    WHEN 'accounts' THEN
      CASE v_plan WHEN 'free' THEN 1 WHEN 'pro' THEN 5 ELSE NULL END
    WHEN 'documents' THEN
      CASE v_plan WHEN 'free' THEN 3 WHEN 'pro' THEN 50 ELSE NULL END
    ELSE NULL
  END;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Upgrade Trigger Functions to Respect Effective Limits (Overrides & Expiry)
-- ------------------------------------------------------------------------------
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
    v_limit := public.get_household_effective_limit(NEW.household_id, v_resource);

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
    v_limit := public.get_household_effective_limit(NEW.household_id, v_resource);

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
  v_limit := public.get_household_effective_limit(NEW.household_id, 'activeLoans');

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
  v_limit := public.get_household_effective_limit(NEW.household_id, 'goals');

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
  v_limit := public.get_household_effective_limit(NEW.household_id, 'familyMembers');

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
  v_limit := public.get_household_effective_limit(NEW.household_id, 'accounts');

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
  v_limit := public.get_household_effective_limit(NEW.household_id, 'documents');

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

-- ------------------------------------------------------------------------------
-- 4. Update get_my_households() to include custom_limits and plan_expires_at
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
      h.custom_limits,
      h.plan_expires_at,
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
-- 5. Live Household Usage & Self-Service Plan Upgrade Request RPCs
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_household_plan_usage(p_household_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_raw_plan text;
  v_effective_plan text;
  v_custom_limits jsonb;
  v_plan_expires_at timestamptz;
  v_holdings_count int := 0;
  v_real_estate_count int := 0;
  v_active_loans_count int := 0;
  v_goals_count int := 0;
  v_family_members_count int := 0;
  v_accounts_count int := 0;
  v_documents_count int := 0;
  v_pending_request jsonb := NULL;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_household_member(p_household_id, v_caller_id) THEN
    RAISE EXCEPTION 'Access Denied: Caller is not an active member of this household';
  END IF;

  SELECT COALESCE(h.plan_tier, 'free'), h.custom_limits, h.plan_expires_at
  INTO v_raw_plan, v_custom_limits, v_plan_expires_at
  FROM public.households h
  WHERE h.id = p_household_id;

  IF v_raw_plan IS NULL THEN
    RAISE EXCEPTION 'Household not found';
  END IF;

  v_effective_plan := public.get_household_plan_tier(p_household_id);

  SELECT
    COUNT(*) FILTER (WHERE COALESCE(a.asset_class_id, '') <> 'real_estate'),
    COUNT(*) FILTER (WHERE a.asset_class_id = 'real_estate')
  INTO v_holdings_count, v_real_estate_count
  FROM public.holdings h
  JOIN public.assets a ON a.id = h.asset_id
  WHERE h.household_id = p_household_id;

  SELECT COUNT(*) INTO v_active_loans_count
  FROM public.liabilities l
  WHERE l.household_id = p_household_id
    AND COALESCE(l.status, 'active') <> 'closed';

  SELECT COUNT(*) INTO v_goals_count
  FROM public.goals g
  WHERE g.household_id = p_household_id;

  SELECT COUNT(*) INTO v_family_members_count
  FROM public.family_members fm
  WHERE fm.household_id = p_household_id;

  SELECT COUNT(*) INTO v_accounts_count
  FROM public.portfolio_accounts pa
  WHERE pa.household_id = p_household_id;

  SELECT COUNT(*) INTO v_documents_count
  FROM public.family_documents fd
  WHERE fd.household_id = p_household_id;

  SELECT jsonb_build_object(
    'id', r.id,
    'user_id', r.user_id,
    'household_id', r.household_id,
    'household_name', h.name,
    'requester_name', COALESCE(p.display_name, split_part(COALESCE(u.email, 'User'), '@', 1)),
    'requester_email', COALESCE(u.email, ''),
    'current_plan', r.current_plan,
    'requested_plan', r.requested_plan,
    'status', r.status,
    'user_notes', r.user_notes,
    'admin_notes', r.admin_notes,
    'created_at', r.created_at
  )
  INTO v_pending_request
  FROM public.plan_upgrade_requests r
  JOIN public.households h ON h.id = r.household_id
  LEFT JOIN auth.users u ON u.id = r.user_id
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.household_id = p_household_id
    AND r.status = 'pending'
  ORDER BY r.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'household_id', p_household_id,
    'plan_tier', v_raw_plan,
    'effective_plan_tier', v_effective_plan,
    'custom_limits', v_custom_limits,
    'plan_expires_at', v_plan_expires_at,
    'usage', jsonb_build_object(
      'holdings', v_holdings_count,
      'realEstate', v_real_estate_count,
      'activeLoans', v_active_loans_count,
      'goals', v_goals_count,
      'familyMembers', v_family_members_count,
      'accounts', v_accounts_count,
      'documents', v_documents_count
    ),
    'pending_request', v_pending_request
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_plan_upgrade_request(
  p_household_id uuid,
  p_requested_plan text,
  p_user_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_current_plan text;
  v_household_name text;
  v_requester_name text;
  v_requester_email text;
  v_existing_id uuid;
  v_request_id uuid;
  v_created_at timestamptz;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_household_member(p_household_id, v_caller_id) THEN
    RAISE EXCEPTION 'Access Denied: Caller is not an active member of this household';
  END IF;

  IF p_requested_plan IS NULL OR p_requested_plan NOT IN ('pro', 'family') THEN
    RAISE EXCEPTION 'Invalid requested plan: %. Choose pro or family.', p_requested_plan;
  END IF;

  v_current_plan := public.get_household_plan_tier(p_household_id);

  IF v_current_plan = p_requested_plan OR (v_current_plan = 'family' AND p_requested_plan = 'pro') THEN
    RAISE EXCEPTION 'Household is already on the % plan or higher.', v_current_plan;
  END IF;

  SELECT id INTO v_existing_id
  FROM public.plan_upgrade_requests
  WHERE household_id = p_household_id AND status = 'pending'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'An upgrade request is already pending for this household.';
  END IF;

  SELECT h.name INTO v_household_name
  FROM public.households h
  WHERE h.id = p_household_id;

  SELECT
    COALESCE(p.display_name, split_part(COALESCE(u.email, 'Investor'), '@', 1)),
    COALESCE(u.email, '')
  INTO v_requester_name, v_requester_email
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = v_caller_id;

  INSERT INTO public.plan_upgrade_requests (
    user_id,
    household_id,
    current_plan,
    requested_plan,
    status,
    user_notes
  ) VALUES (
    v_caller_id,
    p_household_id,
    v_current_plan,
    p_requested_plan,
    'pending',
    NULLIF(trim(COALESCE(p_user_notes, '')), '')
  )
  RETURNING id, created_at INTO v_request_id, v_created_at;

  RETURN jsonb_build_object(
    'id', v_request_id,
    'user_id', v_caller_id,
    'household_id', p_household_id,
    'household_name', COALESCE(v_household_name, 'Household'),
    'requester_name', COALESCE(v_requester_name, 'Investor'),
    'requester_email', COALESCE(v_requester_email, ''),
    'current_plan', v_current_plan,
    'requested_plan', p_requested_plan,
    'status', 'pending',
    'user_notes', NULLIF(trim(COALESCE(p_user_notes, '')), ''),
    'created_at', v_created_at
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Upgrade Admin Read & Dashboard Stats RPCs
-- ------------------------------------------------------------------------------
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
  v_free_users int := 0;
  v_pro_users int := 0;
  v_family_users int := 0;
  v_pending_requests int := 0;
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

  v_active_users := v_active_users + (v_total_users - (SELECT COUNT(*) FROM public.user_access_status));

  SELECT
    COUNT(*) FILTER (WHERE COALESCE(p.plan_tier, 'free') = 'free'),
    COUNT(*) FILTER (WHERE COALESCE(p.plan_tier, 'free') = 'pro'),
    COUNT(*) FILTER (WHERE COALESCE(p.plan_tier, 'free') = 'family')
  INTO v_free_users, v_pro_users, v_family_users
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id;

  SELECT COUNT(*) INTO v_total_households FROM public.households;
  SELECT COUNT(*) INTO v_total_audit_events FROM public.admin_audit_logs;
  SELECT COUNT(*) INTO v_pending_requests FROM public.plan_upgrade_requests WHERE status = 'pending';

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'active_users', v_active_users,
    'suspended_users', v_suspended_users,
    'invited_users', v_invited_users,
    'total_households', v_total_households,
    'total_audit_events', v_total_audit_events,
    'plan_breakdown', jsonb_build_object(
      'free', v_free_users,
      'pro', v_pro_users,
      'family', v_family_users
    ),
    'pending_upgrade_requests', v_pending_requests
  );
END;
$$;

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
      p.plan_expires_at,
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
    'plan_expires_at', p.plan_expires_at,
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
      h.custom_limits,
      h.plan_expires_at,
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
      h.custom_limits,
      h.plan_expires_at,
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
-- 7. Upgrade Admin Plan Mutation RPCs + Upgrade Request Review RPCs
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_set_user_plan(uuid, text, text);
CREATE OR REPLACE FUNCTION public.admin_set_user_plan(
  p_target_user_id uuid,
  p_plan_tier text,
  p_reason_details text DEFAULT NULL,
  p_custom_limits jsonb DEFAULT NULL,
  p_plan_expires_at timestamptz DEFAULT NULL
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
  v_sanitized_limits jsonb;
BEGIN
  v_caller_role := public.get_platform_admin_role(v_caller_id);

  IF v_caller_id IS NULL OR v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'support_admin') THEN
    RAISE EXCEPTION 'Access Denied: Insufficient permissions to change user plan';
  END IF;

  IF p_plan_tier IS NULL OR p_plan_tier NOT IN ('free', 'pro', 'family') THEN
    RAISE EXCEPTION 'Invalid plan tier: %. Allowed values: free, pro, family', p_plan_tier;
  END IF;

  v_sanitized_limits := CASE
    WHEN p_custom_limits IS NULL OR p_custom_limits = '{}'::jsonb THEN NULL
    ELSE p_custom_limits
  END;

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

  INSERT INTO public.profiles (id, display_name, default_currency, plan_tier, plan_expires_at, updated_at)
  VALUES (
    p_target_user_id,
    COALESCE(v_display_name, 'Investor'),
    'INR',
    p_plan_tier,
    p_plan_expires_at,
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    plan_tier = EXCLUDED.plan_tier,
    plan_expires_at = EXCLUDED.plan_expires_at,
    updated_at = timezone('utc'::text, now());

  UPDATE public.households h
  SET plan_tier = p_plan_tier,
      custom_limits = v_sanitized_limits,
      plan_expires_at = p_plan_expires_at,
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
    CASE WHEN v_sanitized_limits IS NOT NULL THEN 'PLAN_CUSTOM_LIMITS_UPDATED' ELSE 'ADMIN_PLAN_UPDATE' END,
    jsonb_build_object(
      'scope', 'user',
      'previous_plan', COALESCE(v_previous_plan, 'free'),
      'new_plan', p_plan_tier,
      'households_updated', v_households_updated,
      'custom_limits', v_sanitized_limits,
      'plan_expires_at', p_plan_expires_at,
      'reason_details', p_reason_details
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'previous_plan', COALESCE(v_previous_plan, 'free'),
    'new_plan', p_plan_tier,
    'households_updated', v_households_updated,
    'custom_limits', v_sanitized_limits,
    'plan_expires_at', p_plan_expires_at
  );
END;
$$;

DROP FUNCTION IF EXISTS public.admin_set_household_plan(uuid, text, text);
CREATE OR REPLACE FUNCTION public.admin_set_household_plan(
  p_household_id uuid,
  p_plan_tier text,
  p_reason_details text DEFAULT NULL,
  p_custom_limits jsonb DEFAULT NULL,
  p_plan_expires_at timestamptz DEFAULT NULL
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
  v_sanitized_limits jsonb;
BEGIN
  v_caller_role := public.get_platform_admin_role(v_caller_id);

  IF v_caller_id IS NULL OR v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'support_admin') THEN
    RAISE EXCEPTION 'Access Denied: Insufficient permissions to change household plan';
  END IF;

  IF p_plan_tier IS NULL OR p_plan_tier NOT IN ('free', 'pro', 'family') THEN
    RAISE EXCEPTION 'Invalid plan tier: %. Allowed values: free, pro, family', p_plan_tier;
  END IF;

  v_sanitized_limits := CASE
    WHEN p_custom_limits IS NULL OR p_custom_limits = '{}'::jsonb THEN NULL
    ELSE p_custom_limits
  END;

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
      custom_limits = v_sanitized_limits,
      plan_expires_at = p_plan_expires_at,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_household_id;

  PERFORM public.log_admin_action(
    v_caller_id,
    v_owner_id,
    'PLAN_TIER_CHANGED',
    'success',
    CASE WHEN v_sanitized_limits IS NOT NULL THEN 'PLAN_CUSTOM_LIMITS_UPDATED' ELSE 'ADMIN_HOUSEHOLD_PLAN_UPDATE' END,
    jsonb_build_object(
      'scope', 'household',
      'household_id', p_household_id,
      'household_name', v_household_name,
      'previous_plan', COALESCE(v_previous_plan, 'free'),
      'new_plan', p_plan_tier,
      'custom_limits', v_sanitized_limits,
      'plan_expires_at', p_plan_expires_at,
      'reason_details', p_reason_details
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'household_id', p_household_id,
    'previous_plan', COALESCE(v_previous_plan, 'free'),
    'new_plan', p_plan_tier,
    'custom_limits', v_sanitized_limits,
    'plan_expires_at', p_plan_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_upgrade_requests(
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requests jsonb;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: Caller does not have platform administrative privileges';
  END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO v_requests
  FROM (
    SELECT
      r.id,
      r.user_id,
      r.household_id,
      COALESCE(h.name, 'Household') AS household_name,
      COALESCE(p_req.display_name, split_part(COALESCE(u_req.email, 'User'), '@', 1)) AS requester_name,
      COALESCE(u_req.email, '') AS requester_email,
      r.current_plan,
      r.requested_plan,
      r.status,
      r.user_notes,
      r.admin_notes,
      r.created_at,
      r.reviewed_at,
      COALESCE(p_rev.display_name, split_part(u_rev.email, '@', 1)) AS reviewed_by_name
    FROM public.plan_upgrade_requests r
    LEFT JOIN public.households h ON h.id = r.household_id
    LEFT JOIN auth.users u_req ON u_req.id = r.user_id
    LEFT JOIN public.profiles p_req ON p_req.id = r.user_id
    LEFT JOIN auth.users u_rev ON u_rev.id = r.reviewed_by
    LEFT JOIN public.profiles p_rev ON p_rev.id = r.reviewed_by
    WHERE (p_status IS NULL OR p_status = '' OR r.status = p_status)
    ORDER BY
      CASE r.status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END,
      r.created_at DESC
    LIMIT 100
  ) t;

  RETURN COALESCE(v_requests, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_upgrade_request(
  p_request_id uuid,
  p_decision text,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_req record;
  v_reviewer_name text;
  v_household_name text;
  v_requester_name text;
  v_requester_email text;
BEGIN
  v_caller_role := public.get_platform_admin_role(v_caller_id);

  IF v_caller_id IS NULL OR v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'support_admin') THEN
    RAISE EXCEPTION 'Access Denied: Insufficient permissions to review upgrade requests';
  END IF;

  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: %. Specify approved or rejected.', p_decision;
  END IF;

  SELECT * INTO v_req
  FROM public.plan_upgrade_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Upgrade request not found';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Upgrade request has already been reviewed (%).', v_req.status;
  END IF;

  UPDATE public.plan_upgrade_requests
  SET status = p_decision,
      admin_notes = NULLIF(trim(COALESCE(p_admin_notes, '')), ''),
      reviewed_by = v_caller_id,
      reviewed_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  WHERE id = p_request_id;

  IF p_decision = 'approved' THEN
    UPDATE public.profiles
    SET plan_tier = v_req.requested_plan,
        plan_expires_at = NULL,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_req.user_id;

    UPDATE public.households
    SET plan_tier = v_req.requested_plan,
        plan_expires_at = NULL,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_req.household_id;
  END IF;

  PERFORM public.log_admin_action(
    v_caller_id,
    v_req.user_id,
    CASE WHEN p_decision = 'approved' THEN 'PLAN_UPGRADE_APPROVED' ELSE 'PLAN_UPGRADE_REJECTED' END,
    'success',
    'ADMIN_UPGRADE_REVIEW',
    jsonb_build_object(
      'request_id', p_request_id,
      'household_id', v_req.household_id,
      'previous_plan', v_req.current_plan,
      'requested_plan', v_req.requested_plan,
      'decision', p_decision,
      'admin_notes', NULLIF(trim(COALESCE(p_admin_notes, '')), '')
    )
  );

  SELECT h.name INTO v_household_name FROM public.households h WHERE h.id = v_req.household_id;
  SELECT COALESCE(p.display_name, split_part(COALESCE(u.email, 'User'), '@', 1)), COALESCE(u.email, '')
  INTO v_requester_name, v_requester_email
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = v_req.user_id;
  SELECT COALESCE(p.display_name, split_part(COALESCE(u.email, 'Admin'), '@', 1))
  INTO v_reviewer_name
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = v_caller_id;

  RETURN jsonb_build_object(
    'id', v_req.id,
    'user_id', v_req.user_id,
    'household_id', v_req.household_id,
    'household_name', COALESCE(v_household_name, 'Household'),
    'requester_name', COALESCE(v_requester_name, 'Investor'),
    'requester_email', COALESCE(v_requester_email, ''),
    'current_plan', v_req.current_plan,
    'requested_plan', v_req.requested_plan,
    'status', p_decision,
    'user_notes', v_req.user_notes,
    'admin_notes', NULLIF(trim(COALESCE(p_admin_notes, '')), ''),
    'created_at', v_req.created_at,
    'reviewed_at', timezone('utc'::text, now()),
    'reviewed_by_name', v_reviewer_name
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. Explicit Function Grants
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_household_effective_limit(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_household_plan_usage(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_plan_upgrade_request(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_user_plan(uuid, text, text, jsonb, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_household_plan(uuid, text, text, jsonb, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_upgrade_requests(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_review_upgrade_request(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_household_effective_limit(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_household_plan_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_plan_upgrade_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_plan(uuid, text, text, jsonb, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_household_plan(uuid, text, text, jsonb, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_upgrade_requests(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_upgrade_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_households() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_users(int, int, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_households(int, int, text) TO authenticated;
