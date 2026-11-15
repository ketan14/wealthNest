-- ==============================================================================
-- WealthNest Phase 18A Part 2 (Phase 2):
-- Secure Household Invitations & Explicit Account-to-FamilyMember Linking
-- ==============================================================================
-- Implements Approved Product Decisions #5, #6, #7, #14:
--   * No silent email auto-linking at signup or login
--   * Cryptographic hashed opaque invite tokens (raw token returned once at issue)
--   * Explicit verification of caller email_confirmed_at IS NOT NULL + exact
--     normalized email match upon acceptance
--   * Preserves existing family_member financial records when unlinking/linking
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.household_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  family_member_id uuid REFERENCES public.family_members(id) ON DELETE SET NULL,
  invited_email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CHECK (length(trim(invited_email)) > 3 AND position('@' IN invited_email) > 1)
);

CREATE INDEX IF NOT EXISTS idx_household_invitations_household_created
  ON public.household_invitations (household_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_household_invitation_email
  ON public.household_invitations (household_id, lower(trim(invited_email)))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.validate_household_invitation_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fm_household uuid;
BEGIN
  IF NEW.family_member_id IS NOT NULL THEN
    SELECT fm.household_id INTO v_fm_household
    FROM public.family_members fm
    WHERE fm.id = NEW.family_member_id;

    IF v_fm_household IS NULL OR v_fm_household IS DISTINCT FROM NEW.household_id THEN
      RAISE EXCEPTION 'Cross-household invariant violation: family_member_id does not belong to invitation household_id';
    END IF;
  END IF;

  NEW.invited_email := lower(trim(NEW.invited_email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_household_invitation_integrity ON public.household_invitations;
CREATE TRIGGER trg_validate_household_invitation_integrity
  BEFORE INSERT OR UPDATE ON public.household_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_household_invitation_integrity();

-- Row-Level Security & Least-Privilege Table Grants
ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.household_invitations FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.household_invitations FROM authenticated;
GRANT SELECT ON TABLE public.household_invitations TO authenticated;
GRANT ALL ON TABLE public.household_invitations TO service_role;

CREATE POLICY "Household owners and admins can view invitations"
  ON public.household_invitations FOR SELECT
  USING (public.is_household_admin_or_owner(household_id, auth.uid()));

-- Helper: mask email safely for pre-auth invitation preview
CREATE OR REPLACE FUNCTION public.mask_email_preview(p_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_local text;
  v_domain text;
BEGIN
  v_local := split_part(COALESCE(p_email, ''), '@', 1);
  v_domain := split_part(COALESCE(p_email, ''), '@', 2);
  IF v_local = '' OR v_domain = '' THEN
    RETURN '***';
  END IF;
  RETURN left(v_local, 1) || '***@' || v_domain;
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC: Create Household Invitation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_household_invitation(
  p_household_id uuid,
  p_invited_email text,
  p_role text DEFAULT 'member',
  p_family_member_id uuid DEFAULT NULL,
  p_expires_in_hours int DEFAULT 168
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_norm_email text;
  v_fm_household uuid;
  v_fm_linked_user uuid;
  v_raw_token text;
  v_token_hash text;
  v_expires_at timestamptz;
  v_inv_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_role NOT IN ('admin', 'member', 'viewer') THEN
    RAISE EXCEPTION 'Invalid invitation role: % (only admin, member, viewer permitted)', p_role;
  END IF;

  v_caller_role := public.get_household_role(p_household_id, v_caller_id);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('primary_owner', 'admin') THEN
    RAISE EXCEPTION 'Access Denied: Only household primary_owner or admins can issue invitations';
  END IF;

  IF p_role = 'admin' AND v_caller_role IS DISTINCT FROM 'primary_owner' THEN
    RAISE EXCEPTION 'Access Denied: Only the primary_owner can invite an administrator';
  END IF;

  v_norm_email := lower(trim(COALESCE(p_invited_email, '')));
  IF length(v_norm_email) < 5 OR position('@' IN v_norm_email) <= 1 THEN
    RAISE EXCEPTION 'A valid recipient email address is required';
  END IF;

  IF p_expires_in_hours IS NULL OR p_expires_in_hours < 1 OR p_expires_in_hours > 720 THEN
    RAISE EXCEPTION 'Invitation expiration must be between 1 and 720 hours';
  END IF;

  IF p_family_member_id IS NOT NULL THEN
    SELECT household_id, linked_user_id INTO v_fm_household, v_fm_linked_user
    FROM public.family_members
    WHERE id = p_family_member_id
    FOR UPDATE;

    IF v_fm_household IS NULL OR v_fm_household IS DISTINCT FROM p_household_id THEN
      RAISE EXCEPTION 'Selected family member profile does not belong to this household';
    END IF;

    IF v_fm_linked_user IS NOT NULL THEN
      RAISE EXCEPTION 'Selected family member profile is already linked to a user login';
    END IF;
  END IF;

  -- Revoke any prior open invitation for the same email in this household
  UPDATE public.household_invitations
  SET revoked_at = timezone('utc'::text, now()),
      revoked_by = v_caller_id
  WHERE household_id = p_household_id
    AND lower(trim(invited_email)) = v_norm_email
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

  v_raw_token := encode(
    sha256(convert_to(gen_random_uuid()::text || ':' || gen_random_uuid()::text || ':' || clock_timestamp()::text, 'UTF8')),
    'hex'
  );
  v_token_hash := encode(sha256(convert_to(v_raw_token, 'UTF8')), 'hex');
  v_expires_at := timezone('utc'::text, now()) + make_interval(hours => p_expires_in_hours);

  INSERT INTO public.household_invitations (
    household_id,
    family_member_id,
    invited_email,
    role,
    token_hash,
    invited_by,
    expires_at
  ) VALUES (
    p_household_id,
    p_family_member_id,
    v_norm_email,
    p_role,
    v_token_hash,
    v_caller_id,
    v_expires_at
  ) RETURNING id INTO v_inv_id;

  PERFORM public.log_household_action(
    p_household_id,
    v_caller_id,
    'INVITATION_CREATED',
    NULL,
    p_family_member_id,
    jsonb_build_object(
      'invitation_id', v_inv_id,
      'invited_email_masked', public.mask_email_preview(v_norm_email),
      'role', p_role,
      'expires_at', v_expires_at
    )
  );

  RETURN jsonb_build_object(
    'invitation_id', v_inv_id,
    'household_id', p_household_id,
    'family_member_id', p_family_member_id,
    'invited_email', v_norm_email,
    'role', p_role,
    'expires_at', v_expires_at,
    'invite_token', v_raw_token
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC: List Safe Invitations for Household Governance UI (Excludes token_hash)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_household_invitations(p_household_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF NOT public.is_household_admin_or_owner(p_household_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: Only household owners or admins can view pending invitations';
  END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT
      inv.id,
      inv.household_id,
      inv.family_member_id,
      fm.name AS family_member_name,
      inv.invited_email,
      inv.role,
      inv.invited_by,
      inv.expires_at,
      inv.accepted_at,
      inv.revoked_at,
      inv.created_at,
      CASE
        WHEN inv.revoked_at IS NOT NULL THEN 'revoked'
        WHEN inv.accepted_at IS NOT NULL THEN 'accepted'
        WHEN inv.expires_at <= timezone('utc'::text, now()) THEN 'expired'
        ELSE 'pending'
      END AS status
    FROM public.household_invitations inv
    LEFT JOIN public.family_members fm ON fm.id = inv.family_member_id
    WHERE inv.household_id = p_household_id
    ORDER BY inv.created_at DESC
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC: Revoke Invitation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_household_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_inv public.household_invitations%ROWTYPE;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_inv
  FROM public.household_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  v_caller_role := public.get_household_role(v_inv.household_id, v_caller_id);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('primary_owner', 'admin') THEN
    RAISE EXCEPTION 'Access Denied: Insufficient permissions to revoke invitation';
  END IF;

  IF v_inv.role = 'admin' AND v_caller_role IS DISTINCT FROM 'primary_owner' THEN
    RAISE EXCEPTION 'Access Denied: Only primary_owner can revoke an administrator invitation';
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has already been accepted';
  END IF;

  IF v_inv.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'invitation_id', v_inv.id, 'status', 'revoked');
  END IF;

  UPDATE public.household_invitations
  SET revoked_at = timezone('utc'::text, now()),
      revoked_by = v_caller_id
  WHERE id = v_inv.id;

  PERFORM public.log_household_action(
    v_inv.household_id,
    v_caller_id,
    'INVITATION_REVOKED',
    NULL,
    v_inv.family_member_id,
    jsonb_build_object('invitation_id', v_inv.id)
  );

  RETURN jsonb_build_object('success', true, 'invitation_id', v_inv.id, 'status', 'revoked');
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC: Safe Pre-Signup / Pre-Accept Invitation Metadata Preview (No PII Leak)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preview_household_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text;
  v_inv public.household_invitations%ROWTYPE;
  v_household_name text;
  v_member_name text;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_TOKEN');
  END IF;

  v_token_hash := encode(sha256(convert_to(trim(p_token), 'UTF8')), 'hex');

  SELECT * INTO v_inv
  FROM public.household_invitations
  WHERE token_hash = v_token_hash;

  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'NOT_FOUND');
  END IF;

  IF v_inv.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'REVOKED');
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'ALREADY_ACCEPTED');
  END IF;

  IF v_inv.expires_at <= timezone('utc'::text, now()) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'EXPIRED');
  END IF;

  SELECT name INTO v_household_name FROM public.households WHERE id = v_inv.household_id;
  IF v_inv.family_member_id IS NOT NULL THEN
    SELECT name INTO v_member_name FROM public.family_members WHERE id = v_inv.family_member_id;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'household_name', COALESCE(v_household_name, 'Household'),
    'role', v_inv.role,
    'masked_email', public.mask_email_preview(v_inv.invited_email),
    'family_member_name', v_member_name,
    'expires_at', v_inv.expires_at
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC: Accept Household Invitation (Verified Email + Explicit Link)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_household_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_email text;
  v_email_confirmed_at timestamptz;
  v_display_name text;
  v_token_hash text;
  v_inv public.household_invitations%ROWTYPE;
  v_existing_member_role text;
  v_existing_linked_fm_id uuid;
  v_target_fm_linked_user uuid;
  v_final_fm_id uuid;
  v_final_role text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to accept a household invitation';
  END IF;

  SELECT
    lower(trim(u.email)),
    u.email_confirmed_at,
    COALESCE(
      NULLIF(trim(p.display_name), ''),
      NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(u.raw_user_meta_data->>'display_name'), ''),
      split_part(COALESCE(u.email, 'Member'), '@', 1)
    )
  INTO v_caller_email, v_email_confirmed_at, v_display_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = v_caller_id;

  IF v_caller_email IS NULL OR v_caller_email = '' THEN
    RAISE EXCEPTION 'Authenticated account lacks an email address';
  END IF;

  IF v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Verified email confirmation is required before accepting a household invitation';
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RAISE EXCEPTION 'Invalid invitation token';
  END IF;

  v_token_hash := encode(sha256(convert_to(trim(p_token), 'UTF8')), 'hex');

  SELECT * INTO v_inv
  FROM public.household_invitations
  WHERE token_hash = v_token_hash
  FOR UPDATE;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or invalid token';
  END IF;

  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invitation has been revoked';
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invitation has already been accepted';
  END IF;

  IF v_inv.expires_at <= timezone('utc'::text, now()) THEN
    RAISE EXCEPTION 'This invitation has expired';
  END IF;

  IF v_caller_email IS DISTINCT FROM lower(trim(v_inv.invited_email)) THEN
    RAISE EXCEPTION 'Access Denied: Signed-in email does not match the invited email address';
  END IF;

  -- Upsert household_members without demoting an existing primary_owner
  SELECT household_role INTO v_existing_member_role
  FROM public.household_members
  WHERE household_id = v_inv.household_id
    AND user_id = v_caller_id
  FOR UPDATE;

  IF v_existing_member_role IS NULL THEN
    INSERT INTO public.household_members (household_id, user_id, household_role, status)
    VALUES (v_inv.household_id, v_caller_id, v_inv.role, 'active');
    v_final_role := v_inv.role;
  ELSIF v_existing_member_role = 'primary_owner' THEN
    UPDATE public.household_members
    SET status = 'active',
        updated_at = timezone('utc'::text, now())
    WHERE household_id = v_inv.household_id
      AND user_id = v_caller_id;
    v_final_role := 'primary_owner';
  ELSE
    UPDATE public.household_members
    SET household_role = v_inv.role,
        status = 'active',
        updated_at = timezone('utc'::text, now())
    WHERE household_id = v_inv.household_id
      AND user_id = v_caller_id;
    v_final_role := v_inv.role;
  END IF;

  -- Link or create family_members entity in the target household
  SELECT id INTO v_existing_linked_fm_id
  FROM public.family_members
  WHERE household_id = v_inv.household_id
    AND linked_user_id = v_caller_id
  FOR UPDATE;

  IF v_inv.family_member_id IS NOT NULL THEN
    SELECT linked_user_id INTO v_target_fm_linked_user
    FROM public.family_members
    WHERE id = v_inv.family_member_id
      AND household_id = v_inv.household_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Target family member record no longer exists in this household';
    END IF;

    IF v_target_fm_linked_user IS NOT NULL AND v_target_fm_linked_user IS DISTINCT FROM v_caller_id THEN
      RAISE EXCEPTION 'Conflict: Target family member is already linked to another login account';
    END IF;

    IF v_existing_linked_fm_id IS NOT NULL AND v_existing_linked_fm_id IS DISTINCT FROM v_inv.family_member_id THEN
      RAISE EXCEPTION 'Conflict: Your account is already linked to another family member profile in this household';
    END IF;

    UPDATE public.family_members
    SET linked_user_id = v_caller_id,
        email = COALESCE(email, v_caller_email),
        updated_by = v_caller_id,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_inv.family_member_id;

    v_final_fm_id := v_inv.family_member_id;
  ELSIF v_existing_linked_fm_id IS NOT NULL THEN
    v_final_fm_id := v_existing_linked_fm_id;
  ELSE
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
      v_inv.household_id,
      v_caller_id,
      'individual',
      v_display_name,
      'other',
      '#ec4899',
      false,
      v_caller_email,
      v_caller_id
    )
    RETURNING id INTO v_final_fm_id;
  END IF;

  UPDATE public.household_invitations
  SET accepted_at = timezone('utc'::text, now()),
      accepted_by = v_caller_id
  WHERE id = v_inv.id;

  PERFORM public.log_household_action(
    v_inv.household_id,
    v_caller_id,
    'INVITATION_ACCEPTED',
    v_caller_id,
    v_final_fm_id,
    jsonb_build_object('invitation_id', v_inv.id, 'assigned_role', v_final_role)
  );

  RETURN jsonb_build_object(
    'success', true,
    'household_id', v_inv.household_id,
    'household_role', v_final_role,
    'family_member_id', v_final_fm_id
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC: Safely Unlink Login Account from Family Member (Preserving Financial Data)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlink_family_member_account(
  p_household_id uuid,
  p_family_member_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_fm public.family_members%ROWTYPE;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_caller_role := public.get_household_role(p_household_id, v_caller_id);

  SELECT * INTO v_fm
  FROM public.family_members
  WHERE id = p_family_member_id
    AND household_id = p_household_id
  FOR UPDATE;

  IF v_fm.id IS NULL THEN
    RAISE EXCEPTION 'Family member not found in household';
  END IF;

  IF v_fm.linked_user_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'family_member_id', p_family_member_id, 'status', 'already_unlinked');
  END IF;

  IF v_fm.linked_user_id IS DISTINCT FROM v_caller_id AND v_caller_role IS DISTINCT FROM 'primary_owner' THEN
    RAISE EXCEPTION 'Access Denied: Only the linked user or household primary_owner can unlink a login';
  END IF;

  UPDATE public.family_members
  SET linked_user_id = NULL,
      updated_by = v_caller_id,
      updated_at = timezone('utc'::text, now())
  WHERE id = v_fm.id;

  PERFORM public.log_household_action(
    p_household_id,
    v_caller_id,
    'FAMILY_MEMBER_UNLINKED',
    v_fm.linked_user_id,
    v_fm.id,
    jsonb_build_object('member_name', v_fm.name)
  );

  RETURN jsonb_build_object('success', true, 'family_member_id', v_fm.id, 'previous_user_id', v_fm.linked_user_id);
END;
$$;

-- Explicit Execution Grants
REVOKE ALL ON FUNCTION public.validate_household_invitation_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mask_email_preview(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_household_invitation(uuid, text, text, uuid, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_household_invitations(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_household_invitation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.preview_household_invitation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_household_invitation(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unlink_family_member_account(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mask_email_preview(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.preview_household_invitation(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_household_invitation(uuid, text, text, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_household_invitations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_household_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_household_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_family_member_account(uuid, uuid) TO authenticated;
