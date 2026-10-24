-- ==============================================================================
-- WealthNest Phase 8: Secure Support Impersonation / View-as-User Mode Migration
-- ==============================================================================

-- 1. Create Support Sessions Table
-- Tracks ephemeral, server-bound read-only support sessions initiated by administrators
CREATE TABLE IF NOT EXISTS public.admin_support_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_support_sessions_admin 
  ON public.admin_support_sessions (admin_user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_support_sessions_target 
  ON public.admin_support_sessions (target_user_id);

CREATE INDEX IF NOT EXISTS idx_support_sessions_expiry 
  ON public.admin_support_sessions (expires_at) 
  WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.admin_support_sessions ENABLE ROW LEVEL SECURITY;

-- Policies:
-- Only platform admins can view support sessions
DROP POLICY IF EXISTS "Platform admins view support sessions" ON public.admin_support_sessions;
CREATE POLICY "Platform admins view support sessions"
  ON public.admin_support_sessions FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

-- 2. Helper: Validate Active Support Session
-- Checks if the session exists, belongs to caller, is_active, and has not expired.
-- Returns target_user_id. Raises exception otherwise.
CREATE OR REPLACE FUNCTION public.validate_support_session(p_session_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_target_user_id uuid;
  v_is_active boolean;
  v_expires_at timestamptz;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Unauthenticated support request';
  END IF;

  SELECT target_user_id, is_active, expires_at
  INTO v_target_user_id, v_is_active, v_expires_at
  FROM public.admin_support_sessions
  WHERE id = p_session_id AND admin_user_id = v_admin_id;

  IF v_target_user_id IS NULL THEN
    PERFORM public.log_admin_action(
      v_admin_id,
      NULL,
      'SUPPORT_SESSION_DENIED',
      'denied',
      'SESSION_NOT_FOUND_OR_FORBIDDEN',
      jsonb_build_object('session_id', p_session_id)
    );
    RAISE EXCEPTION 'Access Denied: Support session not found or does not belong to caller';
  END IF;

  IF NOT v_is_active THEN
    PERFORM public.log_admin_action(
      v_admin_id,
      v_target_user_id,
      'SUPPORT_SESSION_DENIED',
      'denied',
      'SESSION_REVOKED',
      jsonb_build_object('session_id', p_session_id)
    );
    RAISE EXCEPTION 'Access Denied: Support session has been terminated or revoked';
  END IF;

  IF v_expires_at <= now() THEN
    -- Mark session expired in database
    UPDATE public.admin_support_sessions
    SET is_active = false, updated_at = now()
    WHERE id = p_session_id;

    PERFORM public.log_admin_action(
      v_admin_id,
      v_target_user_id,
      'SUPPORT_SESSION_EXPIRED',
      'denied',
      'SESSION_TIMED_OUT',
      jsonb_build_object('session_id', p_session_id, 'expired_at', v_expires_at)
    );
    RAISE EXCEPTION 'Access Denied: Support session has expired (15-minute maximum TTL reached)';
  END IF;

  RETURN v_target_user_id;
END;
$$;

-- 3. Stored Procedure: Start Support Session
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
  IF v_admin_role NOT IN ('super_admin', 'support_admin') THEN
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

-- 4. Stored Procedure: End / Revoke Support Session
CREATE OR REPLACE FUNCTION public.admin_end_support_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_target_user_id uuid;
BEGIN
  SELECT target_user_id INTO v_target_user_id
  FROM public.admin_support_sessions
  WHERE id = p_session_id AND admin_user_id = v_admin_id;

  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Support session not found or does not belong to caller';
  END IF;

  UPDATE public.admin_support_sessions
  SET is_active = false,
      revoked_at = now(),
      revoked_by = v_admin_id,
      updated_at = now()
  WHERE id = p_session_id;

  PERFORM public.log_admin_action(
    v_admin_id,
    v_target_user_id,
    'SUPPORT_SESSION_ENDED',
    'success',
    'ADMIN_TERMINATED',
    jsonb_build_object('session_id', p_session_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'revoked_at', now()
  );
END;
$$;

-- 5. Read-Only Query Procedures (Strict Read-Only Access Bound to Validated Session)

-- 5.1 Read-Only Portfolio Holdings
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
      h.asset_id,
      a.name AS asset_name,
      a.symbol,
      ac.name AS asset_class_name,
      ac.id AS asset_class_id,
      h.quantity,
      h.cost_basis_cents,
      h.current_value_cents,
      h.currency,
      h.member_id,
      fm.name AS member_name,
      h.account_id,
      pa.account_name,
      pa.broker_name,
      h.updated_at
    FROM public.holdings h
    JOIN public.assets a ON a.id = h.asset_id
    JOIN public.asset_classes ac ON ac.id = a.asset_class_id
    LEFT JOIN public.family_members fm ON fm.id = h.member_id
    LEFT JOIN public.portfolio_accounts pa ON pa.id = h.account_id
    WHERE h.user_id = v_target_user_id
    ORDER BY h.current_value_cents DESC
  ) t;

  RETURN jsonb_build_object(
    'target_user_id', v_target_user_id,
    'holdings', COALESCE(v_holdings, '[]'::jsonb)
  );
END;
$$;

-- 5.2 Read-Only Liabilities & Loans
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
      l.name,
      l.liability_type,
      l.original_principal_cents,
      l.interest_rate,
      l.start_date,
      l.tenure_months,
      l.monthly_payment_cents,
      l.outstanding_balance_cents,
      l.member_id,
      fm.name AS primary_borrower_name,
      l.co_borrower_ids,
      l.status,
      l.created_at
    FROM public.liabilities l
    LEFT JOIN public.family_members fm ON fm.id = l.member_id
    WHERE l.user_id = v_target_user_id
    ORDER BY l.created_at DESC
  ) t;

  RETURN jsonb_build_object(
    'target_user_id', v_target_user_id,
    'liabilities', COALESCE(v_liabilities, '[]'::jsonb)
  );
END;
$$;

-- 5.3 Read-Only Financial Goals
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
      g.name,
      g.target_amount_cents,
      g.target_date,
      g.current_amount_cents,
      g.category,
      g.priority,
      g.member_id,
      fm.name AS beneficiary_name,
      g.notes,
      g.created_at
    FROM public.goals g
    LEFT JOIN public.family_members fm ON fm.id = g.member_id
    WHERE g.user_id = v_target_user_id
    ORDER BY g.created_at DESC
  ) t;

  RETURN jsonb_build_object(
    'target_user_id', v_target_user_id,
    'goals', COALESCE(v_goals, '[]'::jsonb)
  );
END;
$$;

-- 5.4 Read-Only Transactions Ledger
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
      tr.transaction_type,
      tr.transaction_date,
      tr.quantity,
      tr.unit_price_cents,
      tr.total_amount_cents,
      tr.currency,
      a.name AS asset_name,
      a.symbol,
      fm.name AS member_name,
      pa.account_name,
      tr.notes,
      tr.created_at
    FROM public.transactions tr
    JOIN public.assets a ON a.id = tr.asset_id
    LEFT JOIN public.family_members fm ON fm.id = tr.member_id
    LEFT JOIN public.portfolio_accounts pa ON pa.id = tr.account_id
    WHERE tr.user_id = v_target_user_id
    ORDER BY tr.transaction_date DESC
    LIMIT p_limit
  ) t;

  RETURN jsonb_build_object(
    'target_user_id', v_target_user_id,
    'transactions', COALESCE(v_transactions, '[]'::jsonb)
  );
END;
$$;

-- 5.5 Read-Only Summary Aggregates (Integer Paise Math)
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

  -- Profile metadata
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

  -- Assets aggregate
  SELECT 
    COALESCE(SUM(current_value_cents), 0),
    COUNT(*)
  INTO v_total_assets_cents, v_holdings_count
  FROM public.holdings
  WHERE user_id = v_target_user_id;

  -- Debt aggregate
  SELECT 
    COALESCE(SUM(outstanding_balance_cents), 0),
    COUNT(*)
  INTO v_total_debt_cents, v_liabilities_count
  FROM public.liabilities
  WHERE user_id = v_target_user_id AND status = 'active';

  -- Net worth
  v_net_worth_cents := v_total_assets_cents - v_total_debt_cents;

  -- Goals count
  SELECT COUNT(*) INTO v_goals_count
  FROM public.goals
  WHERE user_id = v_target_user_id;

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
