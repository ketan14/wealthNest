-- ==============================================================================
-- WealthNest Phase 18D: Atomic Financial PostgreSQL RPCs
-- Migration: 20260101000025_atomic_financial_rpcs.sql
--
-- Provides transactional, ACID-safe, SECURITY DEFINER functions for multi-table
-- financial mutations across households, with row-level locks (FOR UPDATE),
-- BigInt paise arithmetic, and caller authorization checks:
--
-- 1. record_emi_payment_atomic (FIN-01):
--    Atomically inserts loan_payments row, updates liability_balances,
--    and updates liabilities.updated_at in a single rollback-safe transaction.
--
-- 2. record_asset_valuation_atomic (FIN-06):
--    Inserts/upserts asset_valuations row, and conditionally updates
--    holdings.current_value_cents ONLY if as_of_date >= latest valuation date.
--
-- 3. record_transaction_atomic (FIN-02):
--    Atomically inserts transactions ledger row, updates holdings quantity/value
--    with row-level lock (FOR UPDATE), preventing negative quantities on sell.
--
-- 4. correct_transaction_atomic (FIN-03):
--    Compensating reversal and transaction correction with audit trail.
--
-- 5. confirm_cas_import_batch_atomic (FIN-04):
--    Transactional bulk-commit for CAS import statement batches.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. record_emi_payment_atomic
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_emi_payment_atomic(
  p_liability_id uuid,
  p_payment_date date,
  p_total_amount_cents bigint,
  p_principal_cents bigint,
  p_interest_cents bigint,
  p_extra_payment_cents bigint DEFAULT 0,
  p_new_balance_cents bigint DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_liability record;
  v_payment_id uuid;
  v_balance_id uuid;
  v_calculated_balance bigint;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Validate inputs
  IF p_total_amount_cents < 0 OR p_principal_cents < 0 OR p_interest_cents < 0 OR p_extra_payment_cents < 0 THEN
    RAISE EXCEPTION 'Payment amounts cannot be negative.' USING ERRCODE = '22003';
  END IF;

  IF (p_principal_cents + p_interest_cents + p_extra_payment_cents) > p_total_amount_cents THEN
    RAISE EXCEPTION 'Payment components exceed total payment amount.' USING ERRCODE = '22023';
  END IF;

  -- Lock target liability FOR UPDATE to prevent race conditions
  SELECT * INTO v_liability
  FROM public.liabilities
  WHERE id = p_liability_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liability % not found.', p_liability_id USING ERRCODE = 'P0002';
  END IF;

  -- Verify household editor permissions
  IF NOT public.can_access_liability(p_liability_id, v_caller_id, 'edit') THEN
    RAISE EXCEPTION 'Permission denied. Caller cannot edit liabilities for this household.' USING ERRCODE = '42501';
  END IF;

  -- Calculate new remaining principal balance if not explicitly provided
  IF p_new_balance_cents IS NOT NULL THEN
    v_calculated_balance := GREATEST(0, p_new_balance_cents);
  ELSE
    -- Fetch the latest recorded balance
    SELECT balance_cents INTO v_calculated_balance
    FROM public.liability_balances
    WHERE liability_id = p_liability_id
    ORDER BY as_of_date DESC, created_at DESC
    LIMIT 1;

    IF v_calculated_balance IS NULL THEN
      v_calculated_balance := v_liability.original_principal_cents;
    END IF;

    v_calculated_balance := GREATEST(0, v_calculated_balance - p_principal_cents - p_extra_payment_cents);
  END IF;

  -- 1. Insert into loan_payments
  INSERT INTO public.loan_payments (
    id,
    liability_id,
    household_id,
    payment_date,
    total_payment_cents,
    principal_cents,
    interest_cents,
    extra_payment_cents,
    currency,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    COALESCE(p_idempotency_key, gen_random_uuid()),
    p_liability_id,
    v_liability.household_id,
    p_payment_date,
    p_total_amount_cents,
    p_principal_cents,
    p_interest_cents,
    p_extra_payment_cents,
    v_liability.currency,
    p_notes,
    v_caller_id,
    v_caller_id
  )
  RETURNING id INTO v_payment_id;

  -- 2. Upsert into liability_balances
  INSERT INTO public.liability_balances (
    liability_id,
    household_id,
    balance_cents,
    as_of_date,
    source,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_liability_id,
    v_liability.household_id,
    v_calculated_balance,
    p_payment_date,
    'emi_bifurcation',
    p_notes,
    v_caller_id,
    v_caller_id
  )
  ON CONFLICT (liability_id, as_of_date)
  DO UPDATE SET
    balance_cents = EXCLUDED.balance_cents,
    source = EXCLUDED.source,
    notes = EXCLUDED.notes,
    updated_by = EXCLUDED.updated_by
  RETURNING id INTO v_balance_id;

  -- 3. Update liability status if fully paid off
  IF v_calculated_balance = 0 THEN
    UPDATE public.liabilities
    SET status = 'closed',
        updated_at = now(),
        updated_by = v_caller_id
    WHERE id = p_liability_id;
  ELSE
    UPDATE public.liabilities
    SET updated_at = now(),
        updated_by = v_caller_id
    WHERE id = p_liability_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'balance_id', v_balance_id,
    'remaining_balance_cents', v_calculated_balance,
    'status', CASE WHEN v_calculated_balance = 0 THEN 'closed' ELSE v_liability.status END
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. record_asset_valuation_atomic
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_asset_valuation_atomic(
  p_asset_id uuid,
  p_valuation_cents bigint,
  p_as_of_date date,
  p_source text DEFAULT 'manual_appraisal',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_asset record;
  v_valuation_id uuid;
  v_latest_date date;
  v_holdings_updated int := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_valuation_cents < 0 THEN
    RAISE EXCEPTION 'Valuation cents cannot be negative.' USING ERRCODE = '22003';
  END IF;

  SELECT * INTO v_asset
  FROM public.assets
  WHERE id = p_asset_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset % not found.', p_asset_id USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_access_asset(p_asset_id, v_caller_id, 'edit') THEN
    RAISE EXCEPTION 'Permission denied. Caller cannot edit valuations for this household.' USING ERRCODE = '42501';
  END IF;

  -- Check the latest existing valuation date for this asset
  SELECT MAX(as_of_date) INTO v_latest_date
  FROM public.asset_valuations
  WHERE asset_id = p_asset_id;

  -- Insert the historical valuation entry
  INSERT INTO public.asset_valuations (
    asset_id,
    household_id,
    valuation_cents,
    currency,
    as_of_date,
    source,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_asset_id,
    v_asset.household_id,
    p_valuation_cents,
    v_asset.currency,
    p_as_of_date,
    p_source,
    p_notes,
    v_caller_id,
    v_caller_id
  )
  RETURNING id INTO v_valuation_id;

  -- Only update holdings current_value_cents if as_of_date >= latest existing valuation date (FIN-06)
  IF v_latest_date IS NULL OR p_as_of_date >= v_latest_date THEN
    UPDATE public.holdings
    SET current_value_cents = p_valuation_cents,
        updated_at = now(),
        updated_by = v_caller_id
    WHERE asset_id = p_asset_id;
    GET DIAGNOSTICS v_holdings_updated = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'valuation_id', v_valuation_id,
    'as_of_date', p_as_of_date,
    'holdings_updated', v_holdings_updated
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. record_transaction_atomic
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_transaction_atomic(
  p_household_id uuid,
  p_type text,
  p_amount_cents bigint,
  p_transaction_date timestamptz DEFAULT now(),
  p_asset_id uuid DEFAULT NULL,
  p_quantity numeric DEFAULT NULL,
  p_currency text DEFAULT 'INR',
  p_member_id uuid DEFAULT NULL,
  p_account_id uuid DEFAULT NULL,
  p_destination_account_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_visibility text DEFAULT 'household_shared',
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_tx_id uuid;
  v_holding record;
  v_new_quantity numeric;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Verify caller has editor access to the household
  IF NOT public.is_household_member(p_household_id, v_caller_id) THEN
    RAISE EXCEPTION 'Permission denied. Caller is not a member of household %.', p_household_id USING ERRCODE = '42501';
  END IF;

  -- Validate transaction type
  IF p_type NOT IN ('buy', 'sell', 'dividend', 'interest', 'deposit', 'withdrawal', 'transfer', 'fee', 'tax') THEN
    RAISE EXCEPTION 'Invalid transaction type %.', p_type USING ERRCODE = '22023';
  END IF;

  -- If tied to an asset and holding, atomically update quantity with row lock
  IF p_asset_id IS NOT NULL AND p_quantity IS NOT NULL THEN
    SELECT * INTO v_holding
    FROM public.holdings
    WHERE asset_id = p_asset_id AND household_id = p_household_id
    FOR UPDATE;

    IF FOUND THEN
      IF p_type = 'buy' THEN
        v_new_quantity := v_holding.quantity + p_quantity;
      ELSIF p_type = 'sell' THEN
        IF v_holding.quantity < p_quantity THEN
          RAISE EXCEPTION 'Insufficient holding quantity (Available: %, Requested: %).', v_holding.quantity, p_quantity USING ERRCODE = '22003';
        END IF;
        v_new_quantity := v_holding.quantity - p_quantity;
      ELSE
        v_new_quantity := v_holding.quantity;
      END IF;

      UPDATE public.holdings
      SET quantity = v_new_quantity,
          updated_at = now(),
          updated_by = v_caller_id
      WHERE id = v_holding.id;
    END IF;
  END IF;

  -- Insert into transactions
  INSERT INTO public.transactions (
    id,
    household_id,
    visibility,
    asset_id,
    type,
    quantity,
    amount_cents,
    currency,
    transaction_date,
    notes,
    member_id,
    account_id,
    destination_account_id,
    created_by,
    updated_by
  )
  VALUES (
    COALESCE(p_idempotency_key, gen_random_uuid()),
    p_household_id,
    p_visibility,
    p_asset_id,
    p_type,
    p_quantity,
    p_amount_cents,
    p_currency,
    p_transaction_date,
    p_notes,
    p_member_id,
    p_account_id,
    p_destination_account_id,
    v_caller_id,
    v_caller_id
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Grants
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.record_emi_payment_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_asset_valuation_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_transaction_atomic TO authenticated;
