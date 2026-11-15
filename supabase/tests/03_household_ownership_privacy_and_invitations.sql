BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(32);

-- ==============================================================================
-- Phase 18A Part 2 (Phase 5) Verification Suite:
-- Governance, Ownership, Privacy Isolation, Invitations, Storage & Joint Math
-- ==============================================================================

-- 1-3: Onboarding Trigger (Auto Household Creation + skip_default_household opt-out)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a1111111-1111-1111-1111-111111111111'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'husband@qa.wealthnest.local', 'hash', now(), '{}'::jsonb, '{"full_name":"Ketan Qa"}'::jsonb, now(), now()),
  ('b2222222-2222-2222-2222-222222222222'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'wife@qa.wealthnest.local', 'hash', now(), '{}'::jsonb, '{"full_name":"Parul Qa","skip_default_household":true}'::jsonb, now(), now()),
  ('c3333333-3333-3333-3333-333333333333'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'sister@qa.wealthnest.local', 'hash', now(), '{}'::jsonb, '{"full_name":"Meera Qa"}'::jsonb, now(), now()),
  ('d4444444-4444-4444-4444-444444444444'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'unverified@qa.wealthnest.local', 'hash', NULL, '{}'::jsonb, '{"full_name":"Unverified Qa","skip_default_household":true}'::jsonb, now(), now()),
  ('e5555555-5555-5555-5555-555555555555'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'spouse.other@qa.wealthnest.local', 'hash', now(), '{}'::jsonb, '{"full_name":"Rohan Parent"}'::jsonb, now(), now());

SELECT is(
  (SELECT count(*)::int FROM public.household_members WHERE user_id = 'a1111111-1111-1111-1111-111111111111'::uuid AND household_role = 'primary_owner' AND status = 'active'),
  1,
  'new user automatically receives a household and primary_owner membership'
);
SELECT is(
  (SELECT count(*)::int FROM public.family_members WHERE linked_user_id = 'a1111111-1111-1111-1111-111111111111'::uuid AND relationship = 'self' AND is_primary = true),
  1,
  'new user automatically receives linked self family_member profile'
);
SELECT is(
  (SELECT count(*)::int FROM public.household_members WHERE user_id = 'b2222222-2222-2222-2222-222222222222'::uuid),
  0,
  'invited signup with skip_default_household=true does not create an unwanted solo household'
);

-- Capture primary household ID for husband and parental household ID for father/brother
SELECT set_config(
  'test.hh_marital',
  (SELECT household_id::text FROM public.household_members WHERE user_id = 'a1111111-1111-1111-1111-111111111111'::uuid LIMIT 1),
  true
);
SELECT set_config(
  'test.hh_parental',
  (SELECT household_id::text FROM public.household_members WHERE user_id = 'e5555555-5555-5555-5555-555555555555'::uuid LIMIT 1),
  true
);

-- Create pre-existing unlinked family_members in marital household (wife, minor child, HUF) and pre-linked/unlinked wife in parental household
INSERT INTO public.family_members (id, household_id, entity_type, name, relationship, pan_masked, is_primary)
VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, current_setting('test.hh_marital')::uuid, 'individual', 'Parul Qa', 'spouse', 'BGTYU5678K', false),
  ('10000000-0000-0000-0000-000000000002'::uuid, current_setting('test.hh_marital')::uuid, 'minor', 'Krisha Qa', 'child', NULL, false),
  ('10000000-0000-0000-0000-000000000003'::uuid, current_setting('test.hh_marital')::uuid, 'huf', 'Vaghela HUF', 'huf', 'AAACH9999H', false),
  ('20000000-0000-0000-0000-000000000001'::uuid, current_setting('test.hh_parental')::uuid, 'individual', 'Parul Parental', 'child', NULL, false);

-- 4: Pre-assign a shared asset & holding to unlinked wife before she accepts invite
INSERT INTO public.assets (id, household_id, name, ticker, asset_class_id, visibility, created_by)
VALUES ('30000000-0000-0000-0000-000000000001'::uuid, current_setting('test.hh_marital')::uuid, 'Parul Demat MF', 'INF209K', 'mutual_fund', 'owner_only', 'a1111111-1111-1111-1111-111111111111'::uuid);

INSERT INTO public.holdings (id, household_id, asset_id, member_id, quantity, unit_cost_cents, current_value_cents, visibility, created_by)
VALUES ('30000000-0000-0000-0000-000000000002'::uuid, current_setting('test.hh_marital')::uuid, '30000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 100, 10000, 1500000, 'owner_only', 'a1111111-1111-1111-1111-111111111111'::uuid);

-- 4-10: Invitations lifecycle & security guards
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

SELECT throws_ok(
  format($$SELECT public.appoint_household_admin(%L::uuid, 'b2222222-2222-2222-2222-222222222222'::uuid, true)$$, current_setting('test.hh_marital')),
  'Target user is not an active member of this household',
  'cannot appoint admin who is not yet a household member'
);

SELECT lives_ok(
  format(
    $$SELECT set_config('test.inv_token_wife', (public.create_household_invitation(%L::uuid, 'wife@qa.wealthnest.local', 'member', '10000000-0000-0000-0000-000000000001'::uuid, 72))->>'invite_token', true)$$,
    current_setting('test.hh_marital')
  ),
  'primary_owner can create invitation linked to pre-existing family_member'
);

SELECT lives_ok(
  format(
    $$SELECT set_config('test.inv_token_unverified', (public.create_household_invitation(%L::uuid, 'unverified@qa.wealthnest.local', 'member', NULL, 72))->>'invite_token', true)$$,
    current_setting('test.hh_marital')
  ),
  'primary_owner can issue second invitation for another email'
);

-- Wrong email user cannot accept wife invite
SELECT set_config('request.jwt.claims', '{"sub":"c3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
SELECT throws_ok(
  format($$SELECT public.accept_household_invitation(%L)$$, current_setting('test.inv_token_wife')),
  'Access Denied: Signed-in email does not match the invited email address',
  'wrong-email user cannot hijack invitation token'
);

-- Unverified email user cannot accept invite
SELECT set_config('request.jwt.claims', '{"sub":"d4444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
SELECT throws_ok(
  format($$SELECT public.accept_household_invitation(%L)$$, current_setting('test.inv_token_unverified')),
  'Access Denied: Verified email confirmation is required before accepting a household invitation',
  'unverified account cannot accept invitation'
);

-- Wife accepts her verified invite -> linked to pre-existing family_member cleanly
SELECT set_config('request.jwt.claims', '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
SELECT lives_ok(
  format($$SELECT public.accept_household_invitation(%L)$$, current_setting('test.inv_token_wife')),
  'verified spouse accepts invitation'
);

SELECT throws_ok(
  format($$SELECT public.accept_household_invitation(%L)$$, current_setting('test.inv_token_wife')),
  'This invitation has already been accepted',
  'accepted invitation token cannot be reused'
);

SELECT is(
  (SELECT linked_user_id FROM public.family_members WHERE id = '10000000-0000-0000-0000-000000000001'::uuid),
  'b2222222-2222-2222-2222-222222222222'::uuid,
  'invitation links user account directly to existing family_member record'
);

-- 12-14: Privacy isolation upon member linking (Requirement 13: admin/owner CANNOT see linked owner_only record!)
SELECT is(
  (SELECT count(*)::int FROM public.holdings WHERE id = '30000000-0000-0000-0000-000000000002'::uuid),
  1,
  'linked spouse can view her own owner_only holding'
);

SELECT set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.holdings WHERE id = '30000000-0000-0000-0000-000000000002'::uuid),
  0,
  'primary_owner CANNOT automatically read linked spouse owner_only holding (even if primary_owner created it prior to linking)'
);

-- Husband creates private account, private doc, and restricted holding; wife creates her restricted doc
INSERT INTO public.portfolio_accounts (id, household_id, member_id, account_name, broker_name, depository, account_type, visibility)
VALUES (
  '30000000-0000-0000-0000-000000000003'::uuid,
  current_setting('test.hh_marital')::uuid,
  (SELECT id FROM public.family_members WHERE household_id = current_setting('test.hh_marital')::uuid AND linked_user_id = 'a1111111-1111-1111-1111-111111111111'::uuid),
  'Husband Private Demat',
  'Zerodha',
  'CDSL',
  'demat',
  'owner_only'
);

-- 15-17: Multi-Admin governance & single active primary_owner invariants (Requirements 2, 3, 4)
SELECT lives_ok(
  format($$SELECT public.appoint_household_admin(%L::uuid, 'b2222222-2222-2222-2222-222222222222'::uuid, true)$$, current_setting('test.hh_marital')),
  'primary_owner can appoint spouse as household admin'
);

-- Verify partial unique index rejects second active primary_owner even as superuser
RESET ROLE;
SELECT throws_ok(
  format(
    $$UPDATE public.household_members SET household_role = 'primary_owner' WHERE household_id = %L::uuid AND user_id = 'b2222222-2222-2222-2222-222222222222'::uuid$$,
    current_setting('test.hh_marital')
  ),
  NULL,
  'partial unique index blocks second active primary_owner per household'
);

SET LOCAL ROLE authenticated;
-- Appointed admin CANNOT invite another admin (only primary_owner can appoint/invite admins!)
SELECT set_config('request.jwt.claims', '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
SELECT throws_ok(
  format($$SELECT public.create_household_invitation(%L::uuid, 'sister@qa.wealthnest.local', 'admin', NULL, 24)$$, current_setting('test.hh_marital')),
  'Access Denied: Only the primary_owner can invite an administrator',
  'household admin cannot invite another admin'
);

-- Appointed admin STILL cannot view husband private demat account
SELECT is(
  (SELECT count(*)::int FROM public.portfolio_accounts WHERE id = '30000000-0000-0000-0000-000000000003'::uuid),
  0,
  'household admin CANNOT view another members owner_only portfolio_account'
);

-- 18-20: Restricted document + explicit restricted_record_grants + Storage policy check
SELECT set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
INSERT INTO public.family_documents (id, household_id, member_id, title, category, file_name, file_size_bytes, mime_type, storage_path, visibility)
VALUES (
  '30000000-0000-0000-0000-000000000004'::uuid,
  current_setting('test.hh_marital')::uuid,
  (SELECT id FROM public.family_members WHERE household_id = current_setting('test.hh_marital')::uuid AND linked_user_id = 'a1111111-1111-1111-1111-111111111111'::uuid),
  'Will Draft',
  'other',
  'will.pdf',
  2048,
  'application/pdf',
  current_setting('test.hh_marital') || '/30000000-0000-0000-0000-000000000004/will.pdf',
  'restricted'
);

-- Before explicit grant: admin/spouse cannot view document or read storage object
SELECT set_config('request.jwt.claims', '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.family_documents WHERE id = '30000000-0000-0000-0000-000000000004'::uuid),
  0,
  'household admin cannot view restricted document without explicit grant'
);
SELECT is(
  public.can_read_vault_storage_object(
    current_setting('test.hh_marital') || '/30000000-0000-0000-0000-000000000004/will.pdf',
    'b2222222-2222-2222-2222-222222222222'::uuid
  ),
  false,
  'household admin cannot read restricted vault storage object without grant'
);

-- Admin tries granting herself access to husband restricted record -> DENIED
SELECT throws_ok(
  format(
    $$INSERT INTO public.restricted_record_grants (household_id, record_type, record_id, user_id, permission) VALUES (%L::uuid, 'family_document', '30000000-0000-0000-0000-000000000004'::uuid, 'b2222222-2222-2222-2222-222222222222'::uuid, 'manage')$$,
    current_setting('test.hh_marital')
  ),
  '42501',
  NULL,
  'household admin cannot self-grant access to another members restricted document'
);

-- Husband explicitly grants view access -> now wife sees document and vault storage object
SELECT set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
SELECT lives_ok(
  format(
    $$INSERT INTO public.restricted_record_grants (household_id, record_type, record_id, user_id, permission) VALUES (%L::uuid, 'family_document', '30000000-0000-0000-0000-000000000004'::uuid, 'b2222222-2222-2222-2222-222222222222'::uuid, 'view')$$,
    current_setting('test.hh_marital')
  ),
  'record owner can grant explicit view access on restricted document'
);

SELECT set_config('request.jwt.claims', '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.family_documents WHERE id = '30000000-0000-0000-0000-000000000004'::uuid),
  1,
  'grantee can view restricted document after explicit grant'
);
SELECT is(
  public.can_read_vault_storage_object(
    current_setting('test.hh_marital') || '/30000000-0000-0000-0000-000000000004/will.pdf',
    'b2222222-2222-2222-2222-222222222222'::uuid
  ),
  true,
  'grantee can read restricted vault storage object after explicit grant'
);

-- 24-26: Married woman belonging to BOTH Marital and Parental households (Zero Cross-Household Bleed)
SELECT set_config('request.jwt.claims', '{"sub":"e5555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
SELECT lives_ok(
  format(
    $$SELECT set_config('test.inv_token_parental', (public.create_household_invitation(%L::uuid, 'wife@qa.wealthnest.local', 'viewer', '20000000-0000-0000-0000-000000000001'::uuid, 72))->>'invite_token', true)$$,
    current_setting('test.hh_parental')
  ),
  'parental household owner can invite married daughter by same email to his household'
);

SELECT set_config('request.jwt.claims', '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
SELECT lives_ok(
  format($$SELECT public.accept_household_invitation(%L)$$, current_setting('test.inv_token_parental')),
  'same user accepts invitation into second (parental) household cleanly'
);

SELECT is(
  (SELECT count(*)::int FROM public.family_members WHERE linked_user_id = 'b2222222-2222-2222-2222-222222222222'::uuid),
  2,
  'single auth.users account cleanly links to separate family_members across two households'
);

-- 27-29: Joint ownership SUM = 100% enforcement & cross-household FK rejection
SELECT set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
INSERT INTO public.assets (id, household_id, name, asset_class_id)
VALUES ('30000000-0000-0000-0000-000000000005'::uuid, current_setting('test.hh_marital')::uuid, 'Family Villa', 'real_estate');

INSERT INTO public.holdings (id, household_id, asset_id, quantity, unit_cost_cents, current_value_cents, visibility)
VALUES ('30000000-0000-0000-0000-000000000006'::uuid, current_setting('test.hh_marital')::uuid, '30000000-0000-0000-0000-000000000005'::uuid, 1, 1000000000, 1200000000, 'owner_only');

SELECT throws_ok(
  format(
    $$SELECT public.set_holding_owners('30000000-0000-0000-0000-000000000006'::uuid, jsonb_build_array(
      jsonb_build_object('family_member_id', %L, 'ownership_share', 60, 'is_primary_owner', true),
      jsonb_build_object('family_member_id', '10000000-0000-0000-0000-000000000001', 'ownership_share', 30, 'is_primary_owner', false)
    ))$$,
    (SELECT id::text FROM public.family_members WHERE household_id = current_setting('test.hh_marital')::uuid AND linked_user_id = 'a1111111-1111-1111-1111-111111111111'::uuid)
  ),
  'Joint ownership shares must sum to 100% (got 90.0000 percent)',
  'joint holding owner shares summing to 90% are rejected atomically'
);

SELECT lives_ok(
  format(
    $$SELECT public.set_holding_owners('30000000-0000-0000-0000-000000000006'::uuid, jsonb_build_array(
      jsonb_build_object('family_member_id', %L, 'ownership_share', 60, 'is_primary_owner', true),
      jsonb_build_object('family_member_id', '10000000-0000-0000-0000-000000000001', 'ownership_share', 40, 'is_primary_owner', false)
    ))$$,
    (SELECT id::text FROM public.family_members WHERE household_id = current_setting('test.hh_marital')::uuid AND linked_user_id = 'a1111111-1111-1111-1111-111111111111'::uuid)
  ),
  'joint holding owner shares summing to 100% succeed atomically'
);

SELECT throws_ok(
  $$SELECT public.set_holding_owners('30000000-0000-0000-0000-000000000006'::uuid, jsonb_build_array(
    jsonb_build_object('family_member_id', '20000000-0000-0000-0000-000000000001', 'ownership_share', 100, 'is_primary_owner', true)
  ))$$,
  NULL,
  'cross-household family_member_id is rejected on holding_owners'
);

-- 30-31: Primary owner transfer atomicity & ownership invariant + household_audit_logs immutability
SELECT lives_ok(
  format($$SELECT public.transfer_household_primary_owner(%L::uuid, 'b2222222-2222-2222-2222-222222222222'::uuid)$$, current_setting('test.hh_marital')),
  'primary_owner can transfer ownership atomically to verified active member'
);

SELECT is(
  (SELECT household_role FROM public.household_members WHERE household_id = current_setting('test.hh_marital')::uuid AND user_id = 'b2222222-2222-2222-2222-222222222222'::uuid),
  'primary_owner',
  'new owner now holds primary_owner role'
);

-- 32: Deleting linked user login preserves family_members & financial holdings (linked_user_id becomes NULL)
RESET ROLE;
DELETE FROM auth.users WHERE id = 'b2222222-2222-2222-2222-222222222222'::uuid;

SELECT is(
  (SELECT count(*)::int FROM public.holdings WHERE id = '30000000-0000-0000-0000-000000000002'::uuid),
  1,
  'deleting linked auth user preserves family_member financial holdings cleanly'
);

SELECT * FROM finish();
ROLLBACK;
