BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(11);

-- 1: Verify RLS is enabled on plan_upgrade_requests
SELECT ok(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'plan_upgrade_requests'),
  'public.plan_upgrade_requests has RLS enabled'
);

-- Provision Free user & Platform Super Admin
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('77777777-7777-7777-7777-777777777701'::uuid, '00000000-0000-0000-0000-000000000777'::uuid, 'authenticated', 'authenticated', 'free.investor@test.wealthnest.local', 'hash', now(), '{}'::jsonb, '{"full_name":"Free Investor"}'::jsonb, now(), now()),
  ('77777777-7777-7777-7777-777777777702'::uuid, '00000000-0000-0000-0000-000000000777'::uuid, 'authenticated', 'authenticated', 'plan.admin@test.wealthnest.local', 'hash', now(), '{}'::jsonb, '{"full_name":"Plan Admin","skip_default_household":true}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.platform_admin_roles (user_id, role, is_active)
VALUES ('77777777-7777-7777-7777-777777777702'::uuid, 'super_admin', true);

SELECT set_config(
  'test.plan_hh',
  (SELECT household_id::text FROM public.household_members WHERE user_id = '77777777-7777-7777-7777-777777777701'::uuid LIMIT 1),
  true
);

-- 2: Default household starts on Free Starter plan
SELECT is(
  (SELECT plan_tier FROM public.households WHERE id = current_setting('test.plan_hh')::uuid),
  'free',
  'newly onboarded household defaults to free plan_tier'
);

-- Seed 1 equity asset and 5 holdings (exact Free limit = 5)
INSERT INTO public.assets (id, household_id, name, asset_class_id, visibility, created_by)
VALUES ('77777777-7777-7777-7777-777777777710'::uuid, current_setting('test.plan_hh')::uuid, 'Nifty Bees ETF', 'equity', 'household_shared', '77777777-7777-7777-7777-777777777701'::uuid);

INSERT INTO public.holdings (household_id, asset_id, quantity, unit_cost_cents, current_value_cents, visibility, created_by)
SELECT
  current_setting('test.plan_hh')::uuid,
  '77777777-7777-7777-7777-777777777710'::uuid,
  g,
  10000,
  12000,
  'household_shared',
  '77777777-7777-7777-7777-777777777701'::uuid
FROM generate_series(1, 5) AS g;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777701","role":"authenticated"}', true);

-- 3: Free tier blocks 2nd family_member (1 self member already created on signup)
SELECT throws_ok(
  format(
    $$INSERT INTO public.family_members (household_id, entity_type, name, relationship) VALUES (%L::uuid, 'individual', 'Second Member', 'spouse')$$,
    current_setting('test.plan_hh')
  ),
  'P0001',
  NULL,
  'free tier blocks inserting a second family_member beyond quota (1)'
);

-- 4: Free tier blocks 6th investment holding
SELECT throws_ok(
  format(
    $$INSERT INTO public.holdings (household_id, asset_id, quantity, unit_cost_cents, current_value_cents, visibility, created_by) VALUES (%L::uuid, '77777777-7777-7777-7777-777777777710'::uuid, 1, 10000, 12000, 'household_shared', '77777777-7777-7777-7777-777777777701'::uuid)$$,
    current_setting('test.plan_hh')
  ),
  'P0001',
  NULL,
  'free tier blocks inserting a 6th investment holding beyond quota (5)'
);

-- 5: Non-admin user cannot invoke admin_set_user_plan
SELECT throws_ok(
  $$SELECT public.admin_set_user_plan('77777777-7777-7777-7777-777777777701'::uuid, 'pro', 'Self upgrade attempt')$$,
  'Access Denied: Insufficient permissions to change user plan',
  'regular user cannot invoke admin_set_user_plan'
);

-- 6: Free user submits self-service plan upgrade request
SELECT lives_ok(
  format(
    $$SELECT set_config('test.upgrade_req_id', (public.submit_plan_upgrade_request(%L::uuid, 'pro', 'Need unlimited holdings'))->>'id', true)$$,
    current_setting('test.plan_hh')
  ),
  'household member can submit pending plan upgrade request'
);

-- 7: Super admin sets custom holding quota override (10) while still on Free plan
SELECT set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777702","role":"authenticated"}', true);
SELECT lives_ok(
  format(
    $$SELECT public.admin_set_household_plan(%L::uuid, 'free', 'VIP beta override', '{"holdings": 10}'::jsonb, NULL)$$,
    current_setting('test.plan_hh')
  ),
  'super_admin can set custom_limits override on household'
);

-- 8: Free user can now insert 6th holding thanks to custom_limits override
SELECT set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777701","role":"authenticated"}', true);
SELECT lives_ok(
  format(
    $$INSERT INTO public.holdings (household_id, asset_id, quantity, unit_cost_cents, current_value_cents, visibility, created_by) VALUES (%L::uuid, '77777777-7777-7777-7777-777777777710'::uuid, 1, 10000, 12000, 'household_shared', '77777777-7777-7777-7777-777777777701'::uuid)$$,
    current_setting('test.plan_hh')
  ),
  'custom_limits override permits 6th holding on free plan'
);

-- 9-10: Super admin approves upgrade request -> upgrades household to pro
SELECT set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777702","role":"authenticated"}', true);
SELECT lives_ok(
  format(
    $$SELECT public.admin_review_upgrade_request(%L::uuid, 'approved', 'Approved Pro upgrade')$$,
    current_setting('test.upgrade_req_id')
  ),
  'super_admin approves pending plan upgrade request'
);

SELECT is(
  public.get_household_plan_tier(current_setting('test.plan_hh')::uuid),
  'pro',
  'approved upgrade request elevates effective household plan tier to pro'
);

-- 11: Expired promotional trial falls back to free automatically
RESET ROLE;
UPDATE public.households
SET plan_expires_at = timezone('utc'::text, now()) - interval '1 day'
WHERE id = current_setting('test.plan_hh')::uuid;

SELECT is(
  public.get_household_plan_tier(current_setting('test.plan_hh')::uuid),
  'free',
  'expired plan_expires_at automatically resolves effective plan tier back to free'
);

SELECT * FROM finish();
ROLLBACK;
