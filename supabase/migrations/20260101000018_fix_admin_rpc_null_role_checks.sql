-- ==============================================================================
-- Migration 20260101000018: Fix NULL-Logic Role Bypasses in SECURITY DEFINER Admin RPCs
-- ==============================================================================
-- In SQL three-valued logic, `NULL != 'super_admin'` and `NULL NOT IN (...)`
-- evaluate to NULL (treated as FALSE in PL/pgSQL IF statements), allowing a
-- non-admin caller whose get_platform_admin_role() returns NULL to bypass
-- authorization guards in admin_set_user_status, admin_manage_role, and
-- admin_start_support_session.

-- 1. Fix admin_set_user_status
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

  IF v_caller_id IS NULL OR v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'support_admin') THEN
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

-- 2. Fix admin_manage_role
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

  IF v_caller_id IS NULL OR v_caller_role IS DISTINCT FROM 'super_admin' THEN
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

-- 3. Fix admin_start_support_session
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
  IF v_admin_id IS NULL OR v_admin_role IS NULL OR v_admin_role NOT IN ('super_admin', 'support_admin') THEN
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

