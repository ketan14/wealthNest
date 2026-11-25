-- ==============================================================================
-- WealthNest Stage 1 (P0): Household Selective Financial Data Management & Reset
-- Migration: 20260101000026_household_data_reset_rpc.sql
--
-- Provides:
-- 1. get_household_data_reset_preview(p_household_id uuid):
--    Returns exact record counts per resettable financial category and
--    cross-category dependency counts for the specified household.
-- 2. reset_household_financial_data_atomic(p_household_id uuid, p_categories text[]):
--    SECURITY DEFINER transactional reset restricted strictly to the active
--    household primary_owner. Deletes selected financial categories in
--    foreign-key dependency order, unlinks surviving references cleanly,
--    preserves household identity/members/accounts/preferences, and appends an
--    immutable audit entry to public.household_audit_logs.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_household_data_reset_preview(
  p_household_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_investment_portfolio_count int := 0;
  v_real_estate_count int := 0;
  v_loans_liabilities_count int := 0;
  v_transactions_count int := 0;
  v_financial_goals_count int := 0;
  v_documents_vault_count int := 0;
  v_cas_import_history_count int := 0;
  v_linked_home_loans_count int := 0;
  v_linked_goal_holdings_count int := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR NOT public.is_household_member(p_household_id, v_caller_id) THEN
    RAISE EXCEPTION 'Permission denied. Caller is not an active member of household %.', p_household_id
      USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_investment_portfolio_count
  FROM public.holdings h
  JOIN public.assets a ON a.id = h.asset_id
  WHERE h.household_id = p_household_id
    AND COALESCE(a.asset_class_id, 'equity') <> 'real_estate';

  SELECT COUNT(*) INTO v_real_estate_count
  FROM public.holdings h
  JOIN public.assets a ON a.id = h.asset_id
  WHERE h.household_id = p_household_id
    AND a.asset_class_id = 'real_estate';

  SELECT COUNT(*) INTO v_loans_liabilities_count
  FROM public.liabilities
  WHERE household_id = p_household_id;

  SELECT COUNT(*) INTO v_transactions_count
  FROM public.transactions
  WHERE household_id = p_household_id;

  SELECT COUNT(*) INTO v_financial_goals_count
  FROM public.goals
  WHERE household_id = p_household_id;

  SELECT COUNT(*) INTO v_documents_vault_count
  FROM public.family_documents
  WHERE household_id = p_household_id;

  SELECT COUNT(*) INTO v_cas_import_history_count
  FROM public.import_batches
  WHERE household_id = p_household_id;

  SELECT COUNT(*) INTO v_linked_home_loans_count
  FROM public.liabilities
  WHERE household_id = p_household_id
    AND linked_asset_id IS NOT NULL;

  SELECT COUNT(*) INTO v_linked_goal_holdings_count
  FROM public.goal_holding_allocations gha
  JOIN public.goals g ON g.id = gha.goal_id
  WHERE g.household_id = p_household_id;

  RETURN jsonb_build_object(
    'investment_portfolio', v_investment_portfolio_count,
    'real_estate', v_real_estate_count,
    'loans_liabilities', v_loans_liabilities_count,
    'transactions', v_transactions_count,
    'financial_goals', v_financial_goals_count,
    'documents_vault', v_documents_vault_count,
    'cas_import_history', v_cas_import_history_count,
    'linked_home_loans', v_linked_home_loans_count,
    'linked_goal_holdings', v_linked_goal_holdings_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_household_financial_data_atomic(
  p_household_id uuid,
  p_categories text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_deleted_investment_portfolio int := 0;
  v_deleted_real_estate int := 0;
  v_deleted_loans_liabilities int := 0;
  v_deleted_transactions int := 0;
  v_deleted_financial_goals int := 0;
  v_deleted_documents_vault int := 0;
  v_deleted_cas_import_history int := 0;
  v_audit_id uuid;
  v_summary jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Strictly enforce primary_owner authorization on the server
  IF NOT public.is_household_primary_owner(p_household_id, v_caller_id) THEN
    RAISE EXCEPTION 'Permission denied. Only the household primary owner can reset household financial data.'
      USING ERRCODE = '42501';
  END IF;

  IF p_categories IS NULL OR array_length(p_categories, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one financial category must be selected for reset.'
      USING ERRCODE = '22023';
  END IF;

  -- 1. Financial Goals
  IF 'financial_goals' = ANY(p_categories) THEN
    DELETE FROM public.goal_holding_allocations
    WHERE goal_id IN (SELECT id FROM public.goals WHERE household_id = p_household_id);

    DELETE FROM public.restricted_record_grants
    WHERE household_id = p_household_id AND record_type = 'goal';

    DELETE FROM public.goals
    WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_deleted_financial_goals = ROW_COUNT;
  END IF;

  -- 2. Loans & Liabilities
  IF 'loans_liabilities' = ANY(p_categories) THEN
    DELETE FROM public.loan_payments
    WHERE household_id = p_household_id;

    DELETE FROM public.liability_balances
    WHERE household_id = p_household_id;

    DELETE FROM public.asset_liability_links
    WHERE household_id = p_household_id;

    DELETE FROM public.liability_parties
    WHERE household_id = p_household_id;

    DELETE FROM public.restricted_record_grants
    WHERE household_id = p_household_id AND record_type = 'liability';

    DELETE FROM public.liabilities
    WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_deleted_loans_liabilities = ROW_COUNT;
  END IF;

  -- 3. Transactions
  IF 'transactions' = ANY(p_categories) THEN
    DELETE FROM public.restricted_record_grants
    WHERE household_id = p_household_id AND record_type = 'transaction';

    DELETE FROM public.transactions
    WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_deleted_transactions = ROW_COUNT;
  END IF;

  -- 4. Real Estate (holdings + assets where asset_class_id = 'real_estate')
  IF 'real_estate' = ANY(p_categories) THEN
    -- Unlink surviving loans pointing to real estate assets
    UPDATE public.liabilities l
    SET linked_asset_id = NULL,
        updated_at = timezone('utc'::text, now()),
        updated_by = v_caller_id
    FROM public.assets a
    WHERE l.household_id = p_household_id
      AND l.linked_asset_id = a.id
      AND a.asset_class_id = 'real_estate';

    DELETE FROM public.asset_liability_links all_lnk
    USING public.assets a
    WHERE all_lnk.household_id = p_household_id
      AND all_lnk.asset_id = a.id
      AND a.asset_class_id = 'real_estate';

    DELETE FROM public.goal_holding_allocations gha
    USING public.holdings h, public.assets a
    WHERE gha.holding_id = h.id
      AND h.asset_id = a.id
      AND h.household_id = p_household_id
      AND a.asset_class_id = 'real_estate';

    DELETE FROM public.holding_owners ho
    USING public.holdings h, public.assets a
    WHERE ho.holding_id = h.id
      AND h.asset_id = a.id
      AND h.household_id = p_household_id
      AND a.asset_class_id = 'real_estate';

    DELETE FROM public.holdings h
    USING public.assets a
    WHERE h.asset_id = a.id
      AND h.household_id = p_household_id
      AND a.asset_class_id = 'real_estate';
    GET DIAGNOSTICS v_deleted_real_estate = ROW_COUNT;

    DELETE FROM public.asset_valuations av
    USING public.assets a
    WHERE av.asset_id = a.id
      AND av.household_id = p_household_id
      AND a.asset_class_id = 'real_estate';

    -- Only delete real_estate assets not referenced by surviving transactions
    DELETE FROM public.assets a
    WHERE a.household_id = p_household_id
      AND a.asset_class_id = 'real_estate'
      AND NOT EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.household_id = p_household_id AND t.asset_id = a.id
      );
  END IF;

  -- 5. Investment Portfolio (holdings + assets where asset_class_id <> 'real_estate')
  IF 'investment_portfolio' = ANY(p_categories) THEN
    UPDATE public.liabilities l
    SET linked_asset_id = NULL,
        updated_at = timezone('utc'::text, now()),
        updated_by = v_caller_id
    FROM public.assets a
    WHERE l.household_id = p_household_id
      AND l.linked_asset_id = a.id
      AND COALESCE(a.asset_class_id, 'equity') <> 'real_estate';

    DELETE FROM public.asset_liability_links all_lnk
    USING public.assets a
    WHERE all_lnk.household_id = p_household_id
      AND all_lnk.asset_id = a.id
      AND COALESCE(a.asset_class_id, 'equity') <> 'real_estate';

    DELETE FROM public.goal_holding_allocations gha
    USING public.holdings h, public.assets a
    WHERE gha.holding_id = h.id
      AND h.asset_id = a.id
      AND h.household_id = p_household_id
      AND COALESCE(a.asset_class_id, 'equity') <> 'real_estate';

    DELETE FROM public.holding_owners ho
    USING public.holdings h, public.assets a
    WHERE ho.holding_id = h.id
      AND h.asset_id = a.id
      AND h.household_id = p_household_id
      AND COALESCE(a.asset_class_id, 'equity') <> 'real_estate';

    DELETE FROM public.holdings h
    USING public.assets a
    WHERE h.asset_id = a.id
      AND h.household_id = p_household_id
      AND COALESCE(a.asset_class_id, 'equity') <> 'real_estate';
    GET DIAGNOSTICS v_deleted_investment_portfolio = ROW_COUNT;

    DELETE FROM public.asset_valuations av
    USING public.assets a
    WHERE av.asset_id = a.id
      AND av.household_id = p_household_id
      AND COALESCE(a.asset_class_id, 'equity') <> 'real_estate';

    DELETE FROM public.assets a
    WHERE a.household_id = p_household_id
      AND COALESCE(a.asset_class_id, 'equity') <> 'real_estate'
      AND NOT EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.household_id = p_household_id AND t.asset_id = a.id
      );
  END IF;

  -- 6. Documents Vault
  IF 'documents_vault' = ANY(p_categories) THEN
    DELETE FROM public.restricted_record_grants
    WHERE household_id = p_household_id AND record_type = 'family_document';

    DELETE FROM public.family_documents
    WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_deleted_documents_vault = ROW_COUNT;
  END IF;

  -- 7. CAS & Import History
  IF 'cas_import_history' = ANY(p_categories) THEN
    DELETE FROM public.import_batches
    WHERE household_id = p_household_id;
    GET DIAGNOSTICS v_deleted_cas_import_history = ROW_COUNT;
  END IF;

  v_summary := jsonb_build_object(
    'investment_portfolio', v_deleted_investment_portfolio,
    'real_estate', v_deleted_real_estate,
    'loans_liabilities', v_deleted_loans_liabilities,
    'transactions', v_deleted_transactions,
    'financial_goals', v_deleted_financial_goals,
    'documents_vault', v_deleted_documents_vault,
    'cas_import_history', v_deleted_cas_import_history
  );

  -- Record immutable audit log outside reset targets
  v_audit_id := public.log_household_action(
    p_household_id,
    v_caller_id,
    'household_financial_data_reset',
    NULL,
    NULL,
    jsonb_build_object(
      'categories', to_jsonb(p_categories),
      'deleted_counts', v_summary,
      'executed_at', timezone('utc'::text, now())
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'audit_log_id', v_audit_id,
    'deleted_counts', v_summary
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_household_data_reset_preview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_household_financial_data_atomic(uuid, text[]) TO authenticated;
