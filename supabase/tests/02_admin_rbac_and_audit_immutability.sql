BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(14);

-- 1: Verify QA self-elevation RPC is absent from live schema
SELECT hasnt_function(
  'public',
  'seed_qa_grant_admin',
  ARRAY['uuid', 'text'],
  'seed_qa_grant_admin does not exist in live database schema'
);

-- Setup test users (regular non-admin user and platform super_admin)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('44444444-4444-4444-4444-444444444444'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'regular@test.wealthnest.local', 'hash', now(), '{}'::jsonb, '{"display_name":"Regular User"}'::jsonb, now(), now()),
  ('55555555-5555-5555-5555-555555555555'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'admin@test.wealthnest.local', 'hash', now(), '{}'::jsonb, '{"display_name":"Super Admin"}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.platform_admin_roles (user_id, role, is_active)
VALUES ('55555555-5555-5555-5555-555555555555'::uuid, 'super_admin', true);

-- 2-8: Regular user RBAC, NULL-role RPC guard, and direct table write denial
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);

SELECT is(
  public.is_platform_admin('44444444-4444-4444-4444-444444444444'::uuid),
  false,
  'regular user is not recognized as a platform admin'
);
SELECT is(
  public.get_platform_admin_role('44444444-4444-4444-4444-444444444444'::uuid),
  NULL::text,
  'regular user get_platform_admin_role returns NULL'
);
SELECT throws_ok(
  $$SELECT public.admin_get_users()$$,
  'Access Denied: Caller does not have platform administrative privileges',
  'regular user cannot invoke admin_get_users'
);
SELECT throws_ok(
  $$SELECT public.admin_manage_role('44444444-4444-4444-4444-444444444444'::uuid, 'super_admin', 'grant')$$,
  'Access Denied: Only super_admin can grant or revoke platform roles',
  'regular user cannot self-grant super_admin via NULL role bypass'
);
SELECT throws_ok(
  $$SELECT public.admin_set_user_status('55555555-5555-5555-5555-555555555555'::uuid, 'suspended', 'ABUSE')$$,
  'Access Denied: Insufficient permissions to change user status',
  'regular user cannot change user status via NULL role bypass'
);
SELECT throws_ok(
  $$SELECT public.admin_start_support_session('55555555-5555-5555-5555-555555555555'::uuid, 'Investigating ticket #123')$$,
  'Access Denied: Only super_admin or support_admin can initiate support sessions',
  'regular user cannot start support impersonation via NULL role bypass'
);
SELECT throws_ok(
  $$INSERT INTO public.admin_audit_logs (action, outcome) VALUES ('REGULAR_FORGE', 'success')$$,
  '42501',
  NULL,
  'regular user cannot directly insert admin_audit_logs'
);

-- 9-11: Super admin valid support session creation & self-impersonation denial
SELECT set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);

SELECT is(
  public.get_platform_admin_role('55555555-5555-5555-5555-555555555555'::uuid),
  'super_admin',
  'super_admin resolves expected platform role'
);
SELECT lives_ok(
  $$SELECT set_config('test.support_session_id', (public.admin_start_support_session('44444444-4444-4444-4444-444444444444'::uuid, 'Investigating portfolio ticket #999'))->>'session_id', true)$$,
  'super_admin can initiate support session with documented reason'
);
SELECT throws_ok(
  $$SELECT public.admin_start_support_session('55555555-5555-5555-5555-555555555555'::uuid, 'Self impersonation check')$$,
  'Administrative Invariant: Administrators cannot start support impersonation on their own account',
  'super_admin cannot start support impersonation on own account'
);

-- 12: Cross-user support session validation denial
SELECT set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
SELECT throws_ok(
  $$SELECT public.validate_support_session(current_setting('test.support_session_id')::uuid)$$,
  'Access Denied: Support session not found or does not belong to caller',
  'non-owner caller cannot validate another admin support session'
);

-- 13-14: Audit log append-only immutability trigger (verify even owner/postgres role cannot tamper)
RESET ROLE;
SELECT throws_ok(
  $$DELETE FROM public.admin_audit_logs$$,
  'admin_audit_logs records are strictly append-only and immutable. UPDATE and DELETE are prohibited.',
  'admin_audit_logs blocks DELETE via immutability trigger'
);
SELECT throws_ok(
  $$UPDATE public.admin_audit_logs SET action = 'TAMPERED'$$,
  'admin_audit_logs records are strictly append-only and immutable. UPDATE and DELETE are prohibited.',
  'admin_audit_logs blocks UPDATE via immutability trigger'
);

SELECT * FROM finish();
ROLLBACK;

