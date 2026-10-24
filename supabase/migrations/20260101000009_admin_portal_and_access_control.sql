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
