BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(21);

-- 1-5: Verify RLS is enabled on sensitive financial, admin, and document vault tables
SELECT ok(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'assets'),
  'public.assets has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'holdings'),
  'public.holdings has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'family_documents'),
  'public.family_documents has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'admin_audit_logs'),
  'public.admin_audit_logs has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'admin_support_sessions'),
  'public.admin_support_sessions has RLS enabled'
);

-- 6: Verify SECURITY DEFINER search_path hardening on handle_new_user()
SELECT ok(
  (SELECT 'search_path=public' = ANY(proconfig)
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'),
  'public.handle_new_user() sets search_path = public'
);

-- Setup test users, household, asset, holding, and document
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'owner@test.wealthnest.local', 'hash', now(), '{}'::jsonb, '{"display_name":"Owner"}'::jsonb, now(), now()),
  ('22222222-2222-2222-2222-222222222222'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'viewer@test.wealthnest.local', 'hash', now(), '{}'::jsonb, '{"display_name":"Viewer"}'::jsonb, now(), now()),
  ('33333333-3333-3333-3333-333333333333'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'outsider@test.wealthnest.local', 'hash', now(), '{}'::jsonb, '{"display_name":"Outsider"}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.households (id, name, created_by)
VALUES ('99999999-9999-9999-9999-999999999999'::uuid, 'Test Household', '11111111-1111-1111-1111-111111111111'::uuid);

INSERT INTO public.household_members (household_id, user_id, household_role)
VALUES
  ('99999999-9999-9999-9999-999999999999'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'primary_owner'),
  ('99999999-9999-9999-9999-999999999999'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'viewer');

INSERT INTO public.assets (id, user_id, name, asset_class_id)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Nifty 50 ETF', 'equity');

INSERT INTO public.holdings (user_id, asset_id, quantity, unit_cost_cents, current_value_cents)
VALUES ('11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 10, 10000, 12000);

INSERT INTO public.family_documents (user_id, title, category, file_name, file_size_bytes, mime_type, storage_path)
VALUES ('11111111-1111-1111-1111-111111111111'::uuid, 'Test PAN', 'identity_pan', 'pan.pdf', 1024, 'application/pdf', '11111111-1111-1111-1111-111111111111/doc-1/pan.pdf');

-- 7-10: Anonymous (anon) access boundaries
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}', true);

SELECT lives_ok(
  $$SELECT count(*) FROM public.asset_classes$$,
  'anon can read public.asset_classes taxonomy for health checks'
);
SELECT throws_ok(
  $$SELECT count(*) FROM public.assets$$,
  '42501',
  NULL,
  'anon is denied SELECT on public.assets'
);
SELECT throws_ok(
  $$SELECT count(*) FROM public.admin_audit_logs$$,
  '42501',
  NULL,
  'anon is denied SELECT on public.admin_audit_logs'
);
SELECT throws_ok(
  $$INSERT INTO public.admin_audit_logs (action, outcome) VALUES ('ANON_FORGE', 'success')$$,
  '42501',
  NULL,
  'anon is denied INSERT on public.admin_audit_logs'
);

-- 11: Primary owner access
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.assets WHERE user_id = '11111111-1111-1111-1111-111111111111'::uuid),
  1,
  'primary owner can read own asset'
);

-- 12-13: Household viewer access (read allowed, write denied)
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.assets WHERE user_id = '11111111-1111-1111-1111-111111111111'::uuid),
  1,
  'household viewer can read shared household asset'
);
SELECT throws_ok(
  $$INSERT INTO public.assets (user_id, name, asset_class_id) VALUES ('11111111-1111-1111-1111-111111111111'::uuid, 'Viewer Forged Asset', 'equity')$$,
  '42501',
  NULL,
  'household viewer cannot insert asset for primary owner'
);

-- 14-16: Outsider isolation across financial tables & documents
SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.assets WHERE user_id = '11111111-1111-1111-1111-111111111111'::uuid),
  0,
  'outsider cannot read another household assets'
);
SELECT is(
  (SELECT count(*)::int FROM public.family_documents WHERE user_id = '11111111-1111-1111-1111-111111111111'::uuid),
  0,
  'outsider cannot read another household family_documents'
);
SELECT throws_ok(
  $$INSERT INTO public.holdings (user_id, asset_id, quantity, unit_cost_cents, current_value_cents) VALUES ('11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 1, 100, 100)$$,
  '42501',
  NULL,
  'outsider cannot insert holding for another user'
);

-- 17: Storage bucket privacy check
RESET ROLE;
SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'family-vault'),
  false,
  'family-vault storage bucket is strictly private'
);

-- 18-21: HH-03 Household & membership write RLS boundaries
SET LOCAL ROLE authenticated;

-- Viewer cannot invite new members or self-promote to primary_owner
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

SELECT throws_ok(
  $$INSERT INTO public.household_members (household_id, user_id, household_role) VALUES ('99999999-9999-9999-9999-999999999999'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'member')$$,
  '42501',
  NULL,
  'household viewer cannot insert household members'
);

UPDATE public.household_members
SET household_role = 'primary_owner'
WHERE household_id = '99999999-9999-9999-9999-999999999999'::uuid
  AND user_id = '22222222-2222-2222-2222-222222222222'::uuid;

SELECT is(
  (SELECT household_role FROM public.household_members WHERE household_id = '99999999-9999-9999-9999-999999999999'::uuid AND user_id = '22222222-2222-2222-2222-222222222222'::uuid),
  'viewer',
  'household viewer cannot self-promote to primary_owner'
);

-- Outsider cannot join another household even if trying to assign primary_owner
SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

SELECT throws_ok(
  $$INSERT INTO public.household_members (household_id, user_id, household_role) VALUES ('99999999-9999-9999-9999-999999999999'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'primary_owner')$$,
  '42501',
  NULL,
  'outsider cannot add themselves to another household'
);

-- Primary owner can add a new household member
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

SELECT lives_ok(
  $$INSERT INTO public.household_members (household_id, user_id, household_role) VALUES ('99999999-9999-9999-9999-999999999999'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'member')$$,
  'primary owner can add a household member'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;

