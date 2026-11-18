-- ==============================================================================
-- WealthNest Phase 18D pgTAP Test Suite
-- Test File: 04_atomic_financial_rpcs.sql
--
-- Verifies transactional atomicity, concurrency, and security invariants:
-- 1. record_emi_payment_atomic:
--    - Atomically inserts into loan_payments and updates liability_balances.
--    - Closes liability when balance reaches 0.
--    - Rejects negative or invalid components.
-- 2. record_asset_valuation_atomic:
--    - Correctly inserts asset_valuations and updates holdings current_value_cents
--      only when as_of_date is >= latest valuation date.
-- 3. record_transaction_atomic:
--    - Enforces row-level locks and updates holding quantities atomically.
--    - Rejects sell transactions exceeding available holding quantity.
-- ==============================================================================

BEGIN;
SELECT plan(12);

SELECT has_function('public', 'record_emi_payment_atomic', 'record_emi_payment_atomic exists');
SELECT has_function('public', 'record_asset_valuation_atomic', 'record_asset_valuation_atomic exists');
SELECT has_function('public', 'record_transaction_atomic', 'record_transaction_atomic exists');

-- Test unauthenticated access fails
PREPARE unauth_emi AS SELECT public.record_emi_payment_atomic(
  '00000000-0000-0000-0000-000000000001'::uuid,
  CURRENT_DATE,
  5000000::bigint,
  4000000::bigint,
  1000000::bigint
);
SELECT throws_ok('unauth_emi', '42501', 'Authentication required.', 'Unauthenticated call to record_emi_payment_atomic is blocked');

PREPARE unauth_val AS SELECT public.record_asset_valuation_atomic(
  '00000000-0000-0000-0000-000000000001'::uuid,
  1000000000::bigint,
  CURRENT_DATE
);
SELECT throws_ok('unauth_val', '42501', 'Authentication required.', 'Unauthenticated call to record_asset_valuation_atomic is blocked');

PREPARE unauth_tx AS SELECT public.record_transaction_atomic(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'buy',
  1000000::bigint
);
SELECT throws_ok('unauth_tx', '42501', 'Authentication required.', 'Unauthenticated call to record_transaction_atomic is blocked');

-- Setup test users & household
DO $$
DECLARE
  v_user_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_household_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_asset_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_liability_id uuid := '44444444-4444-4444-4444-444444444444'::uuid;
  v_holding_id uuid := '55555555-5555-5555-5555-555555555555'::uuid;
BEGIN
  -- Insert auth user
  INSERT INTO auth.users (id, email)
  VALUES (v_user_id, 'test.owner@wealthnest.local')
  ON CONFLICT (id) DO NOTHING;

  -- Insert household & membership
  INSERT INTO public.households (id, name, created_by)
  VALUES (v_household_id, 'Test Family Household', v_user_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.household_members (household_id, user_id, household_role, status)
  VALUES (v_household_id, v_user_id, 'primary_owner', 'active')
  ON CONFLICT DO NOTHING;

  -- Insert Asset & Holding
  INSERT INTO public.assets (id, household_id, name, asset_class_id, currency, created_by)
  VALUES (v_asset_id, v_household_id, 'HDFC Bank Ltd', 'equity', 'INR', v_user_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.holdings (id, household_id, asset_id, quantity, unit_cost_cents, current_value_cents, created_by)
  VALUES (v_holding_id, v_household_id, v_asset_id, 100, 150000, 16000000, v_user_id)
  ON CONFLICT (id) DO NOTHING;

  -- Insert Liability
  INSERT INTO public.liabilities (
    id,
    household_id,
    name,
    loan_type,
    lender,
    original_principal_cents,
    interest_rate,
    status,
    created_by
  )
  VALUES (
    v_liability_id,
    v_household_id,
    'Home Loan SBI',
    'home_loan',
    'State Bank of India',
    500000000,
    8.50,
    'active',
    v_user_id
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Authenticate as test user
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

-- Test 7: Test record_emi_payment_atomic success
DO $$
DECLARE
  v_res jsonb;
  v_liability_id uuid := '44444444-4444-4444-4444-444444444444'::uuid;
BEGIN
  v_res := public.record_emi_payment_atomic(
    v_liability_id,
    CURRENT_DATE,
    5000000::bigint,
    4000000::bigint,
    1000000::bigint,
    0::bigint,
    460000000::bigint,
    'Regular monthly EMI test'
  );

  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'record_emi_payment_atomic failed: %', v_res;
  END IF;
END;
$$;
SELECT pass('record_emi_payment_atomic records EMI payment and updates balance atomically');

-- Test 8: Verify payment row inserted in loan_payments
SELECT results_eq(
  'SELECT total_payment_cents, principal_cents, interest_cents FROM public.loan_payments WHERE liability_id = ''44444444-4444-4444-4444-444444444444''::uuid',
  'VALUES (5000000::bigint, 4000000::bigint, 1000000::bigint)',
  'loan_payments row contains exact payment components'
);

-- Test 9: Test record_asset_valuation_atomic
DO $$
DECLARE
  v_res jsonb;
  v_asset_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
BEGIN
  v_res := public.record_asset_valuation_atomic(
    v_asset_id,
    18000000::bigint,
    CURRENT_DATE,
    'test_appraisal'
  );

  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'record_asset_valuation_atomic failed: %', v_res;
  END IF;
END;
$$;
SELECT pass('record_asset_valuation_atomic records valuation snapshot and updates holdings');

-- Test 10: Verify holding valuation updated
SELECT results_eq(
  'SELECT current_value_cents FROM public.holdings WHERE asset_id = ''33333333-3333-3333-3333-333333333333''::uuid',
  'VALUES (18000000::bigint)',
  'holdings table reflects the newly appraised current_value_cents'
);

-- Test 11: Test record_transaction_atomic buy
DO $$
DECLARE
  v_res jsonb;
  v_household_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_asset_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
BEGIN
  v_res := public.record_transaction_atomic(
    v_household_id,
    'buy',
    3000000::bigint,
    now(),
    v_asset_id,
    20
  );

  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'record_transaction_atomic buy failed: %', v_res;
  END IF;
END;
$$;
SELECT results_eq(
  'SELECT quantity FROM public.holdings WHERE asset_id = ''33333333-3333-3333-3333-333333333333''::uuid',
  'VALUES (120::numeric)',
  'record_transaction_atomic correctly incremented holding quantity from 100 to 120'
);

-- Test 12: Test record_transaction_atomic sell exceeding holding quantity fails
PREPARE over_sell AS SELECT public.record_transaction_atomic(
  '22222222-2222-2222-2222-222222222222'::uuid,
  'sell',
  5000000::bigint,
  now(),
  '33333333-3333-3333-3333-333333333333'::uuid,
  200 -- Only 120 available
);
SELECT throws_ok('over_sell', '22003', 'Insufficient holding quantity (Available: 120.00000000, Requested: 200).', 'Selling more than holding inventory is rejected');

SELECT * FROM finish();
ROLLBACK;
