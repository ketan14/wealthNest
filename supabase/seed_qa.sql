-- ==============================================================================
-- WealthNest Option A Multi-User & Multi-Household QA Seed (Post-Migration 000023)
-- ==============================================================================
-- Intended for explicit manual execution by a privileged DBA / SQL Editor after
-- `supabase db reset` (NOT automatically loaded as a schema migration because
-- `02_admin_rbac_and_audit_immutability.sql` enforces that `seed_qa_grant_admin`
-- is absent from the production migrated schema).
--
-- Security Design:
--   - All helper functions run SECURITY DEFINER with fixed search_path.
--   - All functions explicitly reject calls from `anon`, `authenticated`, or any
--     session with a non-null `auth.uid()`.
--   - All functions revoke EXECUTE from PUBLIC, anon, and authenticated.
--   - Zero `user_id` columns are referenced on financial/vault tables: all
--     financial entities use `household_id`, `visibility`, `created_by`,
--     `updated_by`, `holding_owners`, `liability_parties`, and
--     `restricted_record_grants`.
--
-- QA Fixtures Provided:
--   1. `public.seed_qa_grant_admin(p_user_id, p_role)`
--      Promotes a QA auth user into `platform_admin_roles` ('super_admin' |
--      'support_admin' | 'auditor') with `user_access_status = 'active'`.
--
--   2. `public.seed_qa_multi_household_matrix()`
--      Provisions 6 GoTrue QA login accounts (password: `WealthNestQA@2026!`)
--      across 2 isolated households + 1 platform admin:
--      - **Vaghela Marital Household**:
--          * Ketan Vaghela (`primary_owner`)
--          * Ananya Vaghela (`admin` — married spouse, ALSO `viewer` in Shinde)
--          * Rohan Vaghela (`member` — adult brother)
--          * Meera Nair (`viewer` — family CA advisor with explicit grant)
--          * Unlinked entities: Aarav Vaghela (`minor`), Vaghela HUF (`huf`),
--            Dinesh Vaghela (`individual`, senior parent without login)
--          * Joint 60/40 real estate (`holding_owners` = 100%) + Valuation +
--            Joint HDFC Home Loan (`liability_parties` 55% primary + 45% co +
--            0% guarantor = 100%) + `asset_liability_links` + balance + EMI
--          * Ananya `owner_only` Groww account & Mutual Fund (invisible to Ketan
--            `primary_owner` and Rohan `member`)
--          * Ketan `restricted` startup equity (`visibility = 'restricted'`)
--            with `restricted_record_grants` `'view'` for Meera CA
--          * `family_documents` using canonical `<household_id>/<doc_id>/<file>`
--            paths including one `'restricted'` estate will shared with Ananya
--      - **Shinde Parental Household**:
--          * Suresh Shinde (`primary_owner` — Ananya's father)
--          * Ananya Shinde (`viewer` — second household without cross-bleed!)
--          * Unlinked Kavita Shinde (`individual` — mother)
--          * Parental residence, FD, loan & pending `household_invitations` row
--      - **Platform Super Admin**: `ops.admin@wealthnest.local`
--
--   3. `public.seed_qa_primary_household(p_user_id)` & alias
--      `public.seed_qa_vaghela_household(p_user_id)`
--      Populates the default household belonging to an existing signup user
--      using modern `household_id`, `holding_owners`, and `liability_parties`.
--
--   4. `public.seed_qa_secondary_user(p_user_id)`
--      Populates an isolated secondary user's household for quick cross-tenant
--      verification.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.seed_qa_grant_admin(
  p_user_id uuid DEFAULT NULL,
  p_role text DEFAULT 'super_admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL OR current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Forbidden: seed_qa_grant_admin may only run as a privileged database owner';
  END IF;

  IF p_role NOT IN ('super_admin', 'support_admin', 'auditor') THEN
    RAISE EXCEPTION 'Invalid platform admin role: %. Allowed: super_admin, support_admin, auditor', p_role;
  END IF;

  v_user_id := COALESCE(
    p_user_id,
    (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  );

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users account exists to promote';
  END IF;

  INSERT INTO public.user_access_status (user_id, status, reason_code, changed_by)
  VALUES (v_user_id, 'active', 'qa_seed_promotion', v_user_id)
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'active',
    reason_code = 'qa_seed_promotion',
    changed_by = EXCLUDED.changed_by,
    updated_at = now();

  UPDATE public.platform_admin_roles
  SET
    is_active = false,
    revoked_at = COALESCE(revoked_at, now()),
    revoked_by = v_user_id,
    updated_at = now()
  WHERE user_id = v_user_id
    AND is_active = true
    AND role IS DISTINCT FROM p_role;

  IF EXISTS (
    SELECT 1 FROM public.platform_admin_roles
    WHERE user_id = v_user_id AND role = p_role
  ) THEN
    UPDATE public.platform_admin_roles
    SET
      is_active = true,
      revoked_at = NULL,
      revoked_by = NULL,
      granted_by = v_user_id,
      granted_at = now(),
      updated_at = now()
    WHERE user_id = v_user_id AND role = p_role;
  ELSE
    INSERT INTO public.platform_admin_roles (user_id, role, is_active, granted_by)
    VALUES (v_user_id, p_role, true, v_user_id);
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'role', p_role,
    'status', 'active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seed_qa_grant_admin(uuid, text) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- Helper: Provision/Upsert a Confirmed QA Auth Account without Creating Extra
-- Personal Households When Pre-Assigned to deterministic QA Households
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._seed_qa_upsert_auth_user(
  p_id uuid,
  p_email text,
  p_display_name text,
  p_password text DEFAULT 'WealthNestQA@2026!',
  p_skip_default_household boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_norm_email text := lower(trim(p_email));
  v_hash text := extensions.crypt(p_password, extensions.gen_salt('bf'));
BEGIN
  IF auth.uid() IS NOT NULL OR current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Forbidden: _seed_qa_upsert_auth_user is privileged-only';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    v_norm_email,
    v_hash,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', p_display_name,
      'skip_default_household', p_skip_default_household
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
    raw_user_meta_data = auth.users.raw_user_meta_data || EXCLUDED.raw_user_meta_data,
    updated_at = now();

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    p_id,
    p_id,
    jsonb_build_object('sub', p_id::text, 'email', v_norm_email),
    'email',
    p_id::text,
    now(),
    now(),
    now()
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.profiles (id, display_name, default_currency)
  VALUES (p_id, p_display_name, 'INR')
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    default_currency = 'INR',
    updated_at = now();

  INSERT INTO public.user_access_status (user_id, status, reason_code, changed_by)
  VALUES (p_id, 'active', 'qa_seed_user', p_id)
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'active',
    updated_at = now();

  RETURN p_id;
END;
$$;

REVOKE ALL ON FUNCTION public._seed_qa_upsert_auth_user(uuid, text, text, text, boolean) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- Main Option A Multi-User / Multi-Household QA Matrix Seed
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_qa_multi_household_matrix()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  -- Deterministic QA auth users
  v_ketan_id   uuid := '11111111-1111-4111-8111-111111111101';
  v_ananya_id  uuid := '11111111-1111-4111-8111-111111111102';
  v_rohan_id   uuid := '11111111-1111-4111-8111-111111111103';
  v_meera_id   uuid := '11111111-1111-4111-8111-111111111104';
  v_suresh_id  uuid := '11111111-1111-4111-8111-111111111105';
  v_admin_id   uuid := '11111111-1111-4111-8111-111111111106';

  -- Deterministic QA households
  v_hh_vaghela uuid := '22222222-2222-4222-8222-222222222201';
  v_hh_shinde  uuid := '22222222-2222-4222-8222-222222222202';

  -- Vaghela family_members (3 linked, 3 unlinked: minor, huf, senior parent)
  v_fm_ketan   uuid := '33333333-3333-4333-8333-333333333301';
  v_fm_ananya  uuid := '33333333-3333-4333-8333-333333333302';
  v_fm_rohan   uuid := '33333333-3333-4333-8333-333333333303';
  v_fm_aarav   uuid := '33333333-3333-4333-8333-333333333304';
  v_fm_huf     uuid := '33333333-3333-4333-8333-333333333305';
  v_fm_dinesh  uuid := '33333333-3333-4333-8333-333333333306';

  -- Shinde family_members (Ananya appears in parental household too)
  v_fm_suresh        uuid := '33333333-3333-4333-8333-333333333401';
  v_fm_ananya_shinde uuid := '33333333-3333-4333-8333-333333333402';
  v_fm_kavita        uuid := '33333333-3333-4333-8333-333333333403';

  -- Portfolio accounts
  v_acc_ketan_zerodha uuid := '44444444-4444-4444-8444-444444444401';
  v_acc_ananya_groww  uuid := '44444444-4444-4444-8444-444444444402';
  v_acc_huf_hdfc      uuid := '44444444-4444-4444-8444-444444444403';
  v_acc_suresh_icici  uuid := '44444444-4444-4444-8444-444444444404';

  -- Assets
  v_asset_worli_flat   uuid := '55555555-5555-4555-8555-555555555501';
  v_asset_joint_fd     uuid := '55555555-5555-4555-8555-555555555502';
  v_asset_sgb_gold     uuid := '55555555-5555-4555-8555-555555555503';
  v_asset_aarav_ppf    uuid := '55555555-5555-4555-8555-555555555504';
  v_asset_ppfas_mf     uuid := '55555555-5555-4555-8555-555555555505';
  v_asset_angel_equity uuid := '55555555-5555-4555-8555-555555555506';
  v_asset_pune_home    uuid := '55555555-5555-4555-8555-555555555507';
  v_asset_parent_fd    uuid := '55555555-5555-4555-8555-555555555508';

  -- Holdings
  v_hold_worli_flat   uuid := '66666666-6666-4666-8666-666666666601';
  v_hold_joint_fd     uuid := '66666666-6666-4666-8666-666666666602';
  v_hold_sgb_gold     uuid := '66666666-6666-4666-8666-666666666603';
  v_hold_aarav_ppf    uuid := '66666666-6666-4666-8666-666666666604';
  v_hold_ppfas_mf     uuid := '66666666-6666-4666-8666-666666666605';
  v_hold_angel_equity uuid := '66666666-6666-4666-8666-666666666606';
  v_hold_pune_home    uuid := '66666666-6666-4666-8666-666666666607';
  v_hold_parent_fd    uuid := '66666666-6666-4666-8666-666666666608';

  -- Liabilities
  v_liab_home_loan    uuid := '77777777-7777-4777-8777-777777777701';
  v_liab_ananya_loc   uuid := '77777777-7777-4777-8777-777777777702';
  v_liab_parent_auto  uuid := '77777777-7777-4777-8777-777777777703';

  -- Goals & Docs & Invites
  v_goal_aarav_edu    uuid := '88888888-8888-4888-8888-888888888801';
  v_goal_ananya_sab   uuid := '88888888-8888-4888-8888-888888888802';
  v_doc_worli_deed    uuid := '99999999-9999-4999-8999-999999999901';
  v_doc_ketan_will    uuid := '99999999-9999-4999-8999-999999999902';
  v_invite_shinde     uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
BEGIN
  IF auth.uid() IS NOT NULL OR current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Forbidden: seed_qa_multi_household_matrix may only run as a privileged database owner';
  END IF;

  PERFORM set_config('wealthnest.allow_owner_transition', 'true', true);

  -- 1. Provision QA Auth Accounts
  PERFORM public._seed_qa_upsert_auth_user(v_ketan_id,  'ketan.vaghela@wealthnest.local', 'Ketan Vaghela');
  PERFORM public._seed_qa_upsert_auth_user(v_ananya_id, 'ananya.shinde@wealthnest.local', 'Ananya Vaghela');
  PERFORM public._seed_qa_upsert_auth_user(v_rohan_id,  'rohan.vaghela@wealthnest.local', 'Rohan Vaghela');
  PERFORM public._seed_qa_upsert_auth_user(v_meera_id,  'meera.ca@wealthnest.local',      'Meera Nair (CA)');
  PERFORM public._seed_qa_upsert_auth_user(v_suresh_id, 'suresh.shinde@wealthnest.local', 'Suresh Shinde');
  PERFORM public._seed_qa_upsert_auth_user(v_admin_id,  'ops.admin@wealthnest.local',     'WealthNest Ops Admin');

  PERFORM public.seed_qa_grant_admin(v_admin_id, 'super_admin');

  -- 2. Reset QA Household Graphs Idempotently (do not delete household_audit_logs)
  DELETE FROM public.restricted_record_grants WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.family_member_access WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.household_invitations WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.goal_holding_allocations WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.goals WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.family_documents WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.asset_liability_links WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.loan_payments WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.liability_balances WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.liabilities WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.asset_valuations WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.transactions WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.import_batches WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.holdings WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.assets WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.portfolio_accounts WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.family_members WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.household_members WHERE household_id IN (v_hh_vaghela, v_hh_shinde);
  DELETE FROM public.households WHERE id IN (v_hh_vaghela, v_hh_shinde);

  -- 3. Provision Households & Multi-Role Memberships
  INSERT INTO public.households (id, name, plan_tier, created_by) VALUES
    (v_hh_vaghela, 'Vaghela Marital Household', 'family', v_ketan_id),
    (v_hh_shinde,  'Shinde Parental Household', 'family', v_suresh_id);

  INSERT INTO public.household_members (household_id, user_id, household_role, status) VALUES
    (v_hh_vaghela, v_ketan_id,  'primary_owner', 'active'),
    (v_hh_vaghela, v_ananya_id, 'admin',         'active'),
    (v_hh_vaghela, v_rohan_id,  'member',        'active'),
    (v_hh_vaghela, v_meera_id,  'viewer',        'active'),
    (v_hh_shinde,  v_suresh_id, 'primary_owner', 'active'),
    (v_hh_shinde,  v_ananya_id, 'viewer',        'active');

  -- 4. Provision Family Members (Linked & Unlinked Legal Entities)
  INSERT INTO public.family_members (
    id, household_id, name, relationship, entity_type, pan_masked, color_hex,
    is_primary, linked_user_id, email, notes, created_by, updated_by
  ) VALUES
    (v_fm_ketan, v_hh_vaghela, 'Ketan Vaghela', 'self', 'individual', 'ABCDE1234F', '#3b82f6',
     true, v_ketan_id, 'ketan.vaghela@wealthnest.local', 'Primary earner and household owner', v_ketan_id, v_ketan_id),
    (v_fm_ananya, v_hh_vaghela, 'Ananya Vaghela', 'spouse', 'individual', 'FGHIJ5678K', '#ec4899',
     false, v_ananya_id, 'ananya.shinde@wealthnest.local', 'Co-admin spouse linked across both marital and parental households', v_ketan_id, v_ketan_id),
    (v_fm_rohan, v_hh_vaghela, 'Rohan Vaghela', 'other', 'individual', 'KLMNO9012L', '#8b5cf6',
     false, v_rohan_id, 'rohan.vaghela@wealthnest.local', 'Adult sibling member account', v_ketan_id, v_ketan_id),
    (v_fm_aarav, v_hh_vaghela, 'Aarav Vaghela', 'child', 'minor', NULL, '#10b981',
     false, NULL, NULL, 'Minor child education portfolio managed by guardians', v_ketan_id, v_ketan_id),
    (v_fm_huf, v_hh_vaghela, 'Ketan Vaghela HUF', 'huf', 'huf', 'AAAHV4321M', '#f59e0b',
     false, NULL, NULL, 'Hindu Undivided Family tax entity (never directly login-linked)', v_ketan_id, v_ketan_id),
    (v_fm_dinesh, v_hh_vaghela, 'Dinesh Vaghela', 'parent', 'individual', 'PQRSX6789N', '#06b6d4',
     false, NULL, NULL, 'Unlinked senior parent tracked inside marital household', v_ketan_id, v_ketan_id),
    (v_fm_suresh, v_hh_shinde, 'Suresh Shinde', 'self', 'individual', 'UVWXY1122P', '#3b82f6',
     true, v_suresh_id, 'suresh.shinde@wealthnest.local', 'Parental household primary owner', v_suresh_id, v_suresh_id),
    (v_fm_ananya_shinde, v_hh_shinde, 'Ananya Shinde', 'child', 'individual', 'FGHIJ5678K', '#ec4899',
     false, v_ananya_id, 'ananya.shinde@wealthnest.local', 'Married daughter view-only beneficiary link in parental household', v_suresh_id, v_suresh_id),
    (v_fm_kavita, v_hh_shinde, 'Kavita Shinde', 'spouse', 'individual', NULL, '#f43f5e',
     false, NULL, NULL, 'Unlinked mother tracked by Suresh', v_suresh_id, v_suresh_id);

  -- Delegate management permission on minor & HUF entities cleanly to Ananya
  INSERT INTO public.family_member_access (household_id, family_member_id, user_id, permission, granted_by) VALUES
    (v_hh_vaghela, v_fm_aarav, v_ananya_id, 'manage', v_ketan_id),
    (v_hh_vaghela, v_fm_huf,   v_ananya_id, 'view',   v_ketan_id);

  -- Pending email invitation inside Shinde Parental Household (token: 'qa-shinde-pending-invite-token-2026')
  INSERT INTO public.household_invitations (
    id, household_id, family_member_id, invited_email, role, token_hash, invited_by, expires_at
  ) VALUES (
    v_invite_shinde,
    v_hh_shinde,
    NULL,
    'pending.son@wealthnest.local',
    'member',
    encode(extensions.digest('qa-shinde-pending-invite-token-2026', 'sha256'), 'hex'),
    v_suresh_id,
    now() + interval '14 days'
  );

  -- 5. Portfolio Accounts (showing shared + Ananya owner_only)
  INSERT INTO public.portfolio_accounts (
    id, household_id, member_id, account_name, broker_name, depository,
    account_number_masked, account_type, visibility, created_by, updated_by
  ) VALUES
    (v_acc_ketan_zerodha, v_hh_vaghela, v_fm_ketan, 'Zerodha Kite', 'Zerodha', 'CDSL', '****4411', 'demat', 'household_shared', v_ketan_id, v_ketan_id),
    (v_acc_ananya_groww,  v_hh_vaghela, v_fm_ananya, 'Ananya Personal Groww', 'Groww', 'CDSL', '****8822', 'mutual_fund_folio', 'owner_only', v_ananya_id, v_ananya_id),
    (v_acc_huf_hdfc,      v_hh_vaghela, v_fm_huf, 'Vaghela HUF Securities', 'HDFC Securities', 'NSDL', '****3399', 'demat', 'household_shared', v_ketan_id, v_ketan_id),
    (v_acc_suresh_icici,  v_hh_shinde,  v_fm_suresh, 'Suresh ICICI Direct', 'ICICI Direct', 'NSDL', '****7710', 'demat', 'household_shared', v_suresh_id, v_suresh_id);

  -- 6. Assets across Vaghela & Shinde Households
  INSERT INTO public.assets (
    id, household_id, name, ticker, isin, instrument_type, amc_name,
    asset_class_id, currency, visibility, notes, created_by, updated_by
  ) VALUES
    (v_asset_worli_flat,   v_hh_vaghela, 'Worli Sea-View 3BHK Residence', NULL, NULL, 'residential_property', NULL, 'real_estate', 'INR', 'household_shared', 'Joint marital residence (60% Ketan / 40% Ananya)', v_ketan_id, v_ketan_id),
    (v_asset_joint_fd,     v_hh_vaghela, 'SBI Joint Senior Citizen & Family FD', 'SBIFD2029', NULL, 'fixed_deposit', 'State Bank of India', 'fixed_income', 'INR', 'household_shared', 'Joint FD 50% Dinesh / 50% Ketan', v_ketan_id, v_ketan_id),
    (v_asset_sgb_gold,     v_hh_vaghela, 'Sovereign Gold Bond 2024 Series', 'SGBMAR32', 'IN0020230185', 'sovereign_gold_bond', 'RBI', 'commodity', 'INR', 'household_shared', 'Held under Vaghela HUF', v_ketan_id, v_ketan_id),
    (v_asset_aarav_ppf,    v_hh_vaghela, 'Aarav Minor PPF Account', 'PPFAARAV', NULL, 'ppf', 'SBI', 'fixed_income', 'INR', 'household_shared', 'Minor long-term education corpus', v_ketan_id, v_ketan_id),
    (v_asset_ppfas_mf,     v_hh_vaghela, 'Parag Parikh Flexi Cap Direct Growth', 'PPFASFCF', 'INF879O01027', 'mutual_fund', 'PPFAS Mutual Fund', 'mutual_fund', 'INR', 'owner_only', 'Ananya private SIP corpus', v_ananya_id, v_ananya_id),
    (v_asset_angel_equity, v_hh_vaghela, 'Stealth FinTech Unlisted Equity Shares', 'SFTECH', NULL, 'unlisted_equity', NULL, 'alternative', 'INR', 'restricted', 'Restricted cap-table stake shared only with CA Meera', v_ketan_id, v_ketan_id),
    (v_asset_pune_home,    v_hh_shinde,  'Kothrud Pune Independent House', NULL, NULL, 'residential_property', NULL, 'real_estate', 'INR', 'household_shared', 'Shinde parental residence', v_suresh_id, v_suresh_id),
    (v_asset_parent_fd,    v_hh_shinde,  'HDFC Senior Pension Reserve FD', 'HDFCFDPAR', NULL, 'fixed_deposit', 'HDFC Bank', 'fixed_income', 'INR', 'household_shared', 'Parents liquidity buffer', v_suresh_id, v_suresh_id);

  -- 7. Holdings + Exact Fractional Joint Ownership (`SUM(ownership_share) = 100.00`)
  INSERT INTO public.holdings (
    id, household_id, asset_id, member_id, account_id, quantity, unit_cost_cents,
    current_value_cents, folio_number, amc_name, scheme_plan, cost_basis_verified,
    source, visibility, created_by, updated_by
  ) VALUES
    (v_hold_worli_flat,   v_hh_vaghela, v_asset_worli_flat,   v_fm_ketan,  NULL,                1,      1800000000, 2400000000, NULL,          NULL,                NULL,     true, 'manual', 'household_shared', v_ketan_id, v_ketan_id),
    (v_hold_joint_fd,     v_hh_vaghela, v_asset_joint_fd,     v_fm_dinesh, NULL,                1,       300000000,  330000000, 'FDR-99201',   'State Bank of India', NULL,    true, 'manual', 'household_shared', v_ketan_id, v_ketan_id),
    (v_hold_sgb_gold,     v_hh_vaghela, v_asset_sgb_gold,     v_fm_huf,    v_acc_huf_hdfc,      120,         620000,   91200000, NULL,          'RBI',               NULL,     true, 'manual', 'household_shared', v_ketan_id, v_ketan_id),
    (v_hold_aarav_ppf,    v_hh_vaghela, v_asset_aarav_ppf,    v_fm_aarav,  NULL,                1,        75000000,   84000000, 'PPF-88012',   'SBI',               NULL,     true, 'manual', 'household_shared', v_ketan_id, v_ketan_id),
    (v_hold_ppfas_mf,     v_hh_vaghela, v_asset_ppfas_mf,     v_fm_ananya, v_acc_ananya_groww,  2850.5,       6400,  22804000, '10492811/19', 'PPFAS Mutual Fund', 'Direct', true, 'cas_import', 'owner_only', v_ananya_id, v_ananya_id),
    (v_hold_angel_equity, v_hh_vaghela, v_asset_angel_equity, v_fm_ketan,  v_acc_ketan_zerodha, 500,         40000,   45000000, NULL,          NULL,                NULL,     true, 'manual', 'restricted', v_ketan_id, v_ketan_id),
    (v_hold_pune_home,    v_hh_shinde,  v_asset_pune_home,    v_fm_suresh, NULL,                1,       950000000, 1450000000, NULL,          NULL,                NULL,     true, 'manual', 'household_shared', v_suresh_id, v_suresh_id),
    (v_hold_parent_fd,    v_hh_shinde,  v_asset_parent_fd,    v_fm_kavita, NULL,                1,       220000000,  240000000, 'HDFC-7701',   'HDFC Bank',         NULL,     true, 'manual', 'household_shared', v_suresh_id, v_suresh_id);

  INSERT INTO public.holding_owners (
    household_id, holding_id, family_member_id, ownership_share, is_primary_owner, created_by
  ) VALUES
    (v_hh_vaghela, v_hold_worli_flat,   v_fm_ketan,  60.00, true,  v_ketan_id),
    (v_hh_vaghela, v_hold_worli_flat,   v_fm_ananya, 40.00, false, v_ketan_id),
    (v_hh_vaghela, v_hold_joint_fd,     v_fm_dinesh, 50.00, true,  v_ketan_id),
    (v_hh_vaghela, v_hold_joint_fd,     v_fm_ketan,  50.00, false, v_ketan_id),
    (v_hh_vaghela, v_hold_sgb_gold,     v_fm_huf,   100.00, true,  v_ketan_id),
    (v_hh_vaghela, v_hold_aarav_ppf,    v_fm_aarav, 100.00, true,  v_ketan_id),
    (v_hh_vaghela, v_hold_ppfas_mf,     v_fm_ananya,100.00, true,  v_ananya_id),
    (v_hh_vaghela, v_hold_angel_equity, v_fm_ketan, 100.00, true,  v_ketan_id),
    (v_hh_shinde,  v_hold_pune_home,    v_fm_suresh, 50.00, true,  v_suresh_id),
    (v_hh_shinde,  v_hold_pune_home,    v_fm_kavita, 50.00, false, v_suresh_id),
    (v_hh_shinde,  v_hold_parent_fd,    v_fm_kavita,100.00, true,  v_suresh_id);

  -- Explicit restricted grants for Ketan's unlisted equity shared with CA advisor Meera
  INSERT INTO public.restricted_record_grants (household_id, record_type, record_id, user_id, permission, granted_by) VALUES
    (v_hh_vaghela, 'asset',   v_asset_angel_equity, v_meera_id, 'view', v_ketan_id),
    (v_hh_vaghela, 'holding', v_hold_angel_equity,  v_meera_id, 'view', v_ketan_id);

  -- Property Valuations
  INSERT INTO public.asset_valuations (
    household_id, asset_id, valuation_cents, currency, as_of_date, source, notes, created_by, updated_by
  ) VALUES
    (v_hh_vaghela, v_asset_worli_flat, 2400000000, 'INR', current_date - 30, 'registered_valuer', 'Q3 Mumbai circle-rate & broker benchmark', v_ketan_id, v_ketan_id),
    (v_hh_shinde,  v_asset_pune_home,  1450000000, 'INR', current_date - 45, 'manual_appraisal',  'Annual Pune society valuation estimate', v_suresh_id, v_suresh_id);

  -- 8. Liabilities + `liability_parties` (`SUM = 100.00`) + Balances + Links + EMI Payments
  INSERT INTO public.liabilities (
    id, household_id, member_id, name, loan_type, lender, account_number,
    original_principal_cents, interest_rate, interest_type, tenure_months,
    emi_amount_cents, currency, start_date, status, linked_asset_id, visibility,
    notes, created_by, updated_by
  ) VALUES
    (v_liab_home_loan, v_hh_vaghela, v_fm_ketan, 'HDFC Joint Housing Loan', 'home_loan', 'HDFC Bank', 'HL-902114',
     1100000000, 8.45, 'floating', 240, 9515000, 'INR', current_date - 540, 'active', v_asset_worli_flat,
     'household_shared', 'Joint home loan on Worli flat (55% Ketan / 45% Ananya, Dinesh guarantor)', v_ketan_id, v_ketan_id),
    (v_liab_ananya_loc, v_hh_vaghela, v_fm_ananya, 'Ananya Personal Credit Line', 'personal_loan', 'ICICI Bank', 'PL-4019',
     40000000, 10.75, 'fixed', 36, 1304000, 'INR', current_date - 180, 'active', NULL,
     'owner_only', 'Ananya private credit line', v_ananya_id, v_ananya_id),
    (v_liab_parent_auto, v_hh_shinde, v_fm_suresh, 'Suresh Sedan Auto Loan', 'vehicle_loan', 'Axis Bank', 'AL-7188',
     120000000, 8.90, 'fixed', 60, 2485000, 'INR', current_date - 400, 'active', NULL,
     'household_shared', 'Parental vehicle loan', v_suresh_id, v_suresh_id);

  INSERT INTO public.liability_parties (
    household_id, liability_id, family_member_id, party_role, liability_share, created_by
  ) VALUES
    (v_hh_vaghela, v_liab_home_loan,   v_fm_ketan,  'primary_borrower', 55.00, v_ketan_id),
    (v_hh_vaghela, v_liab_home_loan,   v_fm_ananya, 'co_borrower',      45.00, v_ketan_id),
    (v_hh_vaghela, v_liab_home_loan,   v_fm_dinesh, 'guarantor',         0.00, v_ketan_id),
    (v_hh_vaghela, v_liab_ananya_loc,  v_fm_ananya, 'primary_borrower',100.00, v_ananya_id),
    (v_hh_shinde,  v_liab_parent_auto, v_fm_suresh, 'primary_borrower',100.00, v_suresh_id);

  INSERT INTO public.liability_balances (
    household_id, liability_id, balance_cents, as_of_date, source, notes, created_by, updated_by
  ) VALUES
    (v_hh_vaghela, v_liab_home_loan,   965000000, current_date - 5, 'bank_statement', 'Latest HDFC EMI statement', v_ketan_id, v_ketan_id),
    (v_hh_vaghela, v_liab_ananya_loc,   34500000, current_date - 5, 'manual',         'Latest personal loan balance', v_ananya_id, v_ananya_id),
    (v_hh_shinde,  v_liab_parent_auto,  89000000, current_date - 5, 'bank_statement', 'Axis auto statement', v_suresh_id, v_suresh_id);

  INSERT INTO public.asset_liability_links (
    household_id, asset_id, liability_id, link_type, ownership_share_percentage, created_by, updated_by
  ) VALUES
    (v_hh_vaghela, v_asset_worli_flat, v_liab_home_loan, 'mortgage', 100.00, v_ketan_id, v_ketan_id);

  INSERT INTO public.loan_payments (
    household_id, liability_id, payment_date, total_payment_cents, principal_cents,
    interest_cents, extra_payment_cents, currency, notes, created_by, updated_by
  ) VALUES
    (v_hh_vaghela, v_liab_home_loan,   current_date - 5, 9515000, 2715000, 6800000, 0, 'INR', 'Monthly HDFC EMI auto-debit', v_ketan_id, v_ketan_id),
    (v_hh_shinde,  v_liab_parent_auto, current_date - 5, 2485000, 1825000,  660000, 0, 'INR', 'Monthly Axis auto EMI', v_suresh_id, v_suresh_id);

  -- 9. Transactions & Import Batches
  INSERT INTO public.transactions (
    household_id, asset_id, member_id, account_id, type, quantity, amount_cents,
    currency, transaction_date, visibility, notes, created_by, updated_by
  ) VALUES
    (v_hh_vaghela, v_asset_sgb_gold,     v_fm_huf,    v_acc_huf_hdfc,     'buy',     120,   74400000, 'INR', now() - interval '90 days', 'household_shared', 'SGB HUF primary subscription', v_ketan_id, v_ketan_id),
    (v_hh_vaghela, v_asset_ppfas_mf,     v_fm_ananya, v_acc_ananya_groww, 'buy',     250,    2000000, 'INR', now() - interval '15 days', 'owner_only',       'Ananya private monthly SIP', v_ananya_id, v_ananya_id),
    (v_hh_vaghela, v_asset_angel_equity, v_fm_ketan,  v_acc_ketan_zerodha,'buy',     500,   20000000, 'INR', now() - interval '45 days', 'restricted',       'Cap-table allotment (restricted)', v_ketan_id, v_ketan_id),
    (v_hh_shinde,  v_asset_parent_fd,    v_fm_kavita, NULL,               'deposit',   1,  220000000, 'INR', now() - interval '120 days','household_shared', 'Parent reserve FD opening', v_suresh_id, v_suresh_id);

  INSERT INTO public.import_batches (
    household_id, member_id, provider, statement_date, total_records, imported_records,
    updated_records, skipped_records, failed_records, status, visibility, notes, created_by, updated_by
  ) VALUES
    (v_hh_vaghela, v_fm_ananya, 'CAMS_KFIN', current_date - 14, 1, 1, 0, 0, 0, 'completed', 'owner_only', 'Ananya CAMS CAS import', v_ananya_id, v_ananya_id);

  -- 10. Goals & Goal Holding Allocations
  INSERT INTO public.goals (
    id, household_id, member_id, name, category, target_amount_cents, target_date,
    initial_saved_cents, monthly_contribution_cents, expected_return_rate, inflation_rate,
    priority, currency, visibility, notes, created_by, updated_by
  ) VALUES
    (v_goal_aarav_edu, v_hh_vaghela, v_fm_aarav, 'Aarav Higher Education 2038', 'education',
     1500000000, (current_date + interval '12 years')::date, 50000000, 4500000, 11.50, 6.50,
     'critical', 'INR', 'household_shared', 'Funded jointly for Aarav undergraduate study', v_ketan_id, v_ketan_id),
    (v_goal_ananya_sab, v_hh_vaghela, v_fm_ananya, 'Ananya Personal Research Sabbatical', 'wealth_creation',
     350000000, (current_date + interval '4 years')::date, 25000000, 2500000, 12.00, 6.00,
     'medium', 'INR', 'owner_only', 'Ananya private goal funded by her PPFAS folio', v_ananya_id, v_ananya_id);

  INSERT INTO public.goal_holding_allocations (
    household_id, goal_id, holding_id, allocation_percentage, created_by, updated_by
  ) VALUES
    (v_hh_vaghela, v_goal_aarav_edu, v_hold_aarav_ppf, 100.00, v_ketan_id, v_ketan_id),
    (v_hh_vaghela, v_goal_ananya_sab, v_hold_ppfas_mf, 100.00, v_ananya_id, v_ananya_id);

  -- 11. Family Document Vault Metadata (`<household_id>/<doc_id>/<file>` paths + restricted grant)
  INSERT INTO public.family_documents (
    id, household_id, member_id, title, category, file_name, file_size_bytes, mime_type,
    storage_path, document_date, notes, is_encrypted, visibility, created_by, updated_by
  ) VALUES
    (v_doc_worli_deed, v_hh_vaghela, v_fm_ketan, 'Worli 3BHK Registered Index-II Deed', 'property_deed',
     'worli_registered_deed.pdf', 1843200, 'application/pdf',
     v_hh_vaghela::text || '/' || v_doc_worli_deed::text || '/worli_registered_deed.pdf',
     current_date - 540, 'Shared registration deed for joint apartment', false, 'household_shared', v_ketan_id, v_ketan_id),
    (v_doc_ketan_will, v_hh_vaghela, v_fm_ketan, 'Ketan Estate Will & Nomination Schedule', 'other',
     'ketan_estate_will_draft.pdf', 512000, 'application/pdf',
     v_hh_vaghela::text || '/' || v_doc_ketan_will::text || '/ketan_estate_will_draft.pdf',
     current_date - 20, 'Restricted document accessible only to Ketan & spouse Ananya', true, 'restricted', v_ketan_id, v_ketan_id);

  INSERT INTO public.restricted_record_grants (household_id, record_type, record_id, user_id, permission, granted_by) VALUES
    (v_hh_vaghela, 'family_document', v_doc_ketan_will, v_ananya_id, 'view', v_ketan_id);

  RETURN jsonb_build_object(
    'vaghela_household_id', v_hh_vaghela,
    'shinde_household_id',  v_hh_shinde,
    'users', jsonb_build_object(
      'ketan_primary_owner', v_ketan_id,
      'ananya_dual_admin_viewer', v_ananya_id,
      'rohan_member', v_rohan_id,
      'meera_viewer_advisor', v_meera_id,
      'suresh_parent_owner', v_suresh_id,
      'ops_super_admin', v_admin_id
    ),
    'pending_shinde_invite_token_plaintext', 'qa-shinde-pending-invite-token-2026',
    'qa_password', 'WealthNestQA@2026!'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seed_qa_multi_household_matrix() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- Single-User / Existing-Signup Household Seed (Updated to Post-000023 Schema)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_qa_primary_household(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id      uuid;
  v_household_id uuid;
  v_self_fm_id   uuid;
  v_spouse_fm_id uuid := gen_random_uuid();
  v_huf_fm_id    uuid := gen_random_uuid();
  v_acc_self_id  uuid := gen_random_uuid();
  v_acc_huf_id   uuid := gen_random_uuid();
  v_asset_eq_id  uuid := gen_random_uuid();
  v_asset_re_id  uuid := gen_random_uuid();
  v_hold_eq_id   uuid := gen_random_uuid();
  v_hold_re_id   uuid := gen_random_uuid();
  v_liab_id      uuid := gen_random_uuid();
  v_goal_id      uuid := gen_random_uuid();
  v_doc_id       uuid := gen_random_uuid();
BEGIN
  IF auth.uid() IS NOT NULL OR current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Forbidden: seed_qa_primary_household may only run as a privileged database owner';
  END IF;

  v_user_id := COALESCE(
    p_user_id,
    (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
  );
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users account exists to seed primary household';
  END IF;

  SELECT household_id INTO v_household_id
  FROM public.household_members
  WHERE user_id = v_user_id AND status = 'active'
  ORDER BY (household_role = 'primary_owner') DESC, joined_at ASC
  LIMIT 1;

  IF v_household_id IS NULL THEN
    SELECT public.ensure_user_default_household(v_user_id, NULL) INTO v_household_id;
  END IF;

  UPDATE public.households SET plan_tier = 'family' WHERE id = v_household_id;

  SELECT id INTO v_self_fm_id
  FROM public.family_members
  WHERE household_id = v_household_id AND linked_user_id = v_user_id
  LIMIT 1;

  IF v_self_fm_id IS NULL THEN
    v_self_fm_id := gen_random_uuid();
    INSERT INTO public.family_members (
      id, household_id, name, relationship, entity_type, color_hex,
      is_primary, linked_user_id, created_by, updated_by
    ) VALUES (
      v_self_fm_id, v_household_id, 'Primary Owner', 'self', 'individual',
      '#3b82f6', true, v_user_id, v_user_id, v_user_id
    );
  END IF;

  -- Clean financial graph within this target household only
  DELETE FROM public.goal_holding_allocations WHERE household_id = v_household_id;
  DELETE FROM public.goals WHERE household_id = v_household_id;
  DELETE FROM public.family_documents WHERE household_id = v_household_id;
  DELETE FROM public.asset_liability_links WHERE household_id = v_household_id;
  DELETE FROM public.loan_payments WHERE household_id = v_household_id;
  DELETE FROM public.liability_balances WHERE household_id = v_household_id;
  DELETE FROM public.liabilities WHERE household_id = v_household_id;
  DELETE FROM public.asset_valuations WHERE household_id = v_household_id;
  DELETE FROM public.transactions WHERE household_id = v_household_id;
  DELETE FROM public.holdings WHERE household_id = v_household_id;
  DELETE FROM public.assets WHERE household_id = v_household_id;
  DELETE FROM public.portfolio_accounts WHERE household_id = v_household_id;
  DELETE FROM public.family_members WHERE household_id = v_household_id AND id <> v_self_fm_id;

  INSERT INTO public.family_members (
    id, household_id, name, relationship, entity_type, pan_masked, color_hex,
    is_primary, linked_user_id, created_by, updated_by
  ) VALUES
    (v_spouse_fm_id, v_household_id, 'Spouse Profile (Unlinked)', 'spouse', 'individual', 'FGHIJ5678K', '#ec4899', false, NULL, v_user_id, v_user_id),
    (v_huf_fm_id,    v_household_id, 'Family HUF',                'huf',    'huf',        'AAAHV4321M', '#f59e0b', false, NULL, v_user_id, v_user_id);

  INSERT INTO public.portfolio_accounts (
    id, household_id, member_id, account_name, broker_name, depository,
    account_number_masked, account_type, visibility, created_by, updated_by
  ) VALUES
    (v_acc_self_id, v_household_id, v_self_fm_id, 'Zerodha Kite', 'Zerodha', 'CDSL', '****1029', 'demat', 'household_shared', v_user_id, v_user_id),
    (v_acc_huf_id,  v_household_id, v_huf_fm_id,  'HUF Demat',    'HDFC Securities', 'NSDL', '****3399', 'demat', 'household_shared', v_user_id, v_user_id);

  INSERT INTO public.assets (
    id, household_id, name, ticker, isin, instrument_type, asset_class_id,
    currency, visibility, created_by, updated_by
  ) VALUES
    (v_asset_eq_id, v_household_id, 'Reliance Industries Ltd', 'RELIANCE', 'INE002A01018', 'equity_share', 'equity', 'INR', 'household_shared', v_user_id, v_user_id),
    (v_asset_re_id, v_household_id, 'Primary Joint Apartment', NULL, NULL, 'residential_property', 'real_estate', 'INR', 'household_shared', v_user_id, v_user_id);

  INSERT INTO public.holdings (
    id, household_id, asset_id, member_id, account_id, quantity, unit_cost_cents,
    current_value_cents, cost_basis_verified, source, visibility, created_by, updated_by
  ) VALUES
    (v_hold_eq_id, v_household_id, v_asset_eq_id, v_self_fm_id, v_acc_self_id, 150, 240000, 44250000, true, 'manual', 'household_shared', v_user_id, v_user_id),
    (v_hold_re_id, v_household_id, v_asset_re_id, v_self_fm_id, NULL,          1, 1400000000, 1850000000, true, 'manual', 'household_shared', v_user_id, v_user_id);

  INSERT INTO public.holding_owners (
    household_id, holding_id, family_member_id, ownership_share, is_primary_owner, created_by
  ) VALUES
    (v_household_id, v_hold_eq_id, v_self_fm_id,   100.00, true,  v_user_id),
    (v_household_id, v_hold_re_id, v_self_fm_id,    60.00, true,  v_user_id),
    (v_household_id, v_hold_re_id, v_spouse_fm_id,  40.00, false, v_user_id);

  INSERT INTO public.asset_valuations (
    household_id, asset_id, valuation_cents, currency, as_of_date, source, created_by, updated_by
  ) VALUES
    (v_household_id, v_asset_re_id, 1850000000, 'INR', current_date - 7, 'manual_appraisal', v_user_id, v_user_id);

  INSERT INTO public.liabilities (
    id, household_id, member_id, name, loan_type, lender, original_principal_cents,
    interest_rate, interest_type, tenure_months, emi_amount_cents, currency, start_date,
    status, linked_asset_id, visibility, created_by, updated_by
  ) VALUES
    (v_liab_id, v_household_id, v_self_fm_id, 'HDFC Joint Home Loan', 'home_loan', 'HDFC Bank',
     950000000, 8.50, 'floating', 240, 8245000, 'INR', current_date - 365, 'active',
     v_asset_re_id, 'household_shared', v_user_id, v_user_id);

  INSERT INTO public.liability_parties (
    household_id, liability_id, family_member_id, party_role, liability_share, created_by
  ) VALUES
    (v_household_id, v_liab_id, v_self_fm_id,   'primary_borrower', 60.00, v_user_id),
    (v_household_id, v_liab_id, v_spouse_fm_id, 'co_borrower',      40.00, v_user_id);

  INSERT INTO public.liability_balances (
    household_id, liability_id, balance_cents, as_of_date, source, created_by, updated_by
  ) VALUES
    (v_household_id, v_liab_id, 845000000, current_date - 5, 'bank_statement', v_user_id, v_user_id);

  INSERT INTO public.asset_liability_links (
    household_id, asset_id, liability_id, link_type, ownership_share_percentage, created_by, updated_by
  ) VALUES
    (v_household_id, v_asset_re_id, v_liab_id, 'mortgage', 100.00, v_user_id, v_user_id);

  INSERT INTO public.transactions (
    household_id, asset_id, member_id, account_id, type, quantity, amount_cents,
    currency, transaction_date, visibility, notes, created_by, updated_by
  ) VALUES
    (v_household_id, v_asset_eq_id, v_self_fm_id, v_acc_self_id, 'buy', 150, 36000000, 'INR', now() - interval '60 days', 'household_shared', 'Initial Reliance stake', v_user_id, v_user_id);

  INSERT INTO public.goals (
    id, household_id, member_id, name, category, target_amount_cents, target_date,
    initial_saved_cents, monthly_contribution_cents, expected_return_rate, inflation_rate,
    priority, currency, visibility, created_by, updated_by
  ) VALUES
    (v_goal_id, v_household_id, v_self_fm_id, 'Household Financial Freedom Fund', 'retirement',
     5000000000, (current_date + interval '15 years')::date, 50000000, 10000000, 12.00, 6.00,
     'high', 'INR', 'household_shared', v_user_id, v_user_id);

  INSERT INTO public.goal_holding_allocations (
    household_id, goal_id, holding_id, allocation_percentage, created_by, updated_by
  ) VALUES
    (v_household_id, v_goal_id, v_hold_eq_id, 100.00, v_user_id, v_user_id);

  INSERT INTO public.family_documents (
    id, household_id, member_id, title, category, file_name, file_size_bytes, mime_type,
    storage_path, visibility, created_by, updated_by
  ) VALUES
    (v_doc_id, v_household_id, v_self_fm_id, 'Apartment Title Deed', 'property_deed',
     'apartment_deed.pdf', 1024000, 'application/pdf',
     v_household_id::text || '/' || v_doc_id::text || '/apartment_deed.pdf',
     'household_shared', v_user_id, v_user_id);

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'household_id', v_household_id,
    'self_member_id', v_self_fm_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seed_qa_primary_household(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.seed_qa_vaghela_household(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.seed_qa_primary_household(p_user_id);
$$;

REVOKE ALL ON FUNCTION public.seed_qa_vaghela_household(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.seed_qa_secondary_user(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id      uuid;
  v_household_id uuid;
  v_self_fm_id   uuid;
  v_asset_id     uuid := gen_random_uuid();
  v_holding_id   uuid := gen_random_uuid();
  v_liab_id      uuid := gen_random_uuid();
BEGIN
  IF auth.uid() IS NOT NULL OR current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Forbidden: seed_qa_secondary_user may only run as a privileged database owner';
  END IF;

  v_user_id := COALESCE(
    p_user_id,
    (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1)
  );
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users account exists to seed secondary household';
  END IF;

  SELECT household_id INTO v_household_id
  FROM public.household_members
  WHERE user_id = v_user_id AND status = 'active'
  ORDER BY (household_role = 'primary_owner') DESC, joined_at ASC
  LIMIT 1;

  IF v_household_id IS NULL THEN
    SELECT public.ensure_user_default_household(v_user_id, NULL) INTO v_household_id;
  END IF;

  UPDATE public.households SET plan_tier = 'family' WHERE id = v_household_id;

  SELECT id INTO v_self_fm_id
  FROM public.family_members
  WHERE household_id = v_household_id AND linked_user_id = v_user_id
  LIMIT 1;

  IF v_self_fm_id IS NULL THEN
    v_self_fm_id := gen_random_uuid();
    INSERT INTO public.family_members (
      id, household_id, name, relationship, entity_type, color_hex,
      is_primary, linked_user_id, created_by, updated_by
    ) VALUES (
      v_self_fm_id, v_household_id, 'Secondary Tenant Owner', 'self', 'individual',
      '#6366f1', true, v_user_id, v_user_id, v_user_id
    );
  END IF;

  DELETE FROM public.liabilities WHERE household_id = v_household_id;
  DELETE FROM public.holdings WHERE household_id = v_household_id;
  DELETE FROM public.assets WHERE household_id = v_household_id;

  INSERT INTO public.assets (
    id, household_id, name, ticker, isin, instrument_type, asset_class_id,
    currency, visibility, created_by, updated_by
  ) VALUES (
    v_asset_id, v_household_id, 'HDFC Nifty 50 Index Direct', 'HDFCNIFTY', 'INF179KC1965',
    'mutual_fund', 'mutual_fund', 'INR', 'owner_only', v_user_id, v_user_id
  );

  INSERT INTO public.holdings (
    id, household_id, asset_id, member_id, quantity, unit_cost_cents,
    current_value_cents, cost_basis_verified, source, visibility, created_by, updated_by
  ) VALUES (
    v_holding_id, v_household_id, v_asset_id, v_self_fm_id, 500, 15000, 9500000,
    true, 'manual', 'owner_only', v_user_id, v_user_id
  );

  INSERT INTO public.holding_owners (
    household_id, holding_id, family_member_id, ownership_share, is_primary_owner, created_by
  ) VALUES (
    v_household_id, v_holding_id, v_self_fm_id, 100.00, true, v_user_id
  );

  INSERT INTO public.liabilities (
    id, household_id, member_id, name, loan_type, lender, original_principal_cents,
    interest_rate, interest_type, tenure_months, emi_amount_cents, currency,
    status, visibility, created_by, updated_by
  ) VALUES (
    v_liab_id, v_household_id, v_self_fm_id, 'Isolated Car Loan', 'vehicle_loan', 'ICICI Bank',
    80000000, 9.10, 'fixed', 48, 1995000, 'INR', 'active', 'household_shared', v_user_id, v_user_id
  );

  INSERT INTO public.liability_parties (
    household_id, liability_id, family_member_id, party_role, liability_share, created_by
  ) VALUES (
    v_household_id, v_liab_id, v_self_fm_id, 'primary_borrower', 100.00, v_user_id
  );

  INSERT INTO public.liability_balances (
    household_id, liability_id, balance_cents, as_of_date, source, created_by, updated_by
  ) VALUES (
    v_household_id, v_liab_id, 61000000, current_date - 3, 'bank_statement', v_user_id, v_user_id
  );

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'household_id', v_household_id,
    'self_member_id', v_self_fm_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seed_qa_secondary_user(uuid) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- Ready-to-run verification snippet (uncomment when executing manually in SQL Editor):
--   SELECT public.seed_qa_multi_household_matrix();
-- ------------------------------------------------------------------------------
