import { RelationalDatabaseState } from './tauri-sqlite-types';

/**
 * Executes write SQL statements for liabilities, valuations, links, and financial goals.
 * Returns affected row count, or null if the SQL did not match a planning table.
 */
export function executePlanningWrite(
  state: RelationalDatabaseState,
  sql: string,
  params: unknown[],
  now: string
): number | null {
  // 8. liabilities
  if (/INSERT INTO liabilities/i.test(sql)) {
    const [
      id,
      user_id,
      name,
      loan_type,
      lender,
      account_number,
      original_principal_paise,
      interest_rate,
      interest_type,
      tenure_months,
      emi_amount_paise,
      currency,
      start_date,
      end_date,
      status,
      linked_asset_id,
      member_id,
      notes,
    ] = params;
    const existing = state.liabilities.find((r) => r.id === id);
    if (existing) {
      existing.interest_rate = interest_rate;
      existing.emi_amount_paise = emi_amount_paise;
    } else {
      state.liabilities.push({
        id,
        user_id,
        name,
        loan_type,
        lender,
        account_number: account_number ?? null,
        original_principal_paise,
        interest_rate,
        interest_type: interest_type || 'floating',
        tenure_months: tenure_months ?? null,
        emi_amount_paise: emi_amount_paise ?? 0,
        currency: currency || 'INR',
        start_date: start_date ?? null,
        end_date: end_date ?? null,
        status: status || 'active',
        linked_asset_id: linked_asset_id ?? null,
        member_id: member_id ?? null,
        notes: notes ?? null,
        created_at: now,
      });
    }
    return 1;
  }

  if (/UPDATE liabilities SET/i.test(sql)) {
    const [
      name,
      loan_type,
      lender,
      account_number,
      interest_rate,
      interest_type,
      tenure_months,
      emi_amount_paise,
      status,
      linked_asset_id,
      member_id,
      notes,
      id,
      user_id,
    ] = params;
    const lia = state.liabilities.find((r) => r.id === id && r.user_id === user_id);
    if (lia) {
      if (name !== null && name !== undefined) lia.name = name;
      if (loan_type !== null && loan_type !== undefined) lia.loan_type = loan_type;
      if (lender !== null && lender !== undefined) lia.lender = lender;
      if (account_number !== null && account_number !== undefined)
        lia.account_number = account_number;
      if (interest_rate !== null && interest_rate !== undefined) lia.interest_rate = interest_rate;
      if (interest_type !== null && interest_type !== undefined) lia.interest_type = interest_type;
      if (tenure_months !== null && tenure_months !== undefined) lia.tenure_months = tenure_months;
      if (emi_amount_paise !== null && emi_amount_paise !== undefined)
        lia.emi_amount_paise = emi_amount_paise;
      if (status !== null && status !== undefined) lia.status = status;
      if (linked_asset_id !== null && linked_asset_id !== undefined)
        lia.linked_asset_id = linked_asset_id;
      if (member_id !== null && member_id !== undefined) lia.member_id = member_id;
      if (notes !== null && notes !== undefined) lia.notes = notes;
      return 1;
    }
    return 0;
  }

  if (/DELETE FROM liabilities WHERE id = \?/i.test(sql)) {
    const [id, user_id] = params;
    const before = state.liabilities.length;
    state.liabilities = state.liabilities.filter(
      (r) => !(r.id === id && (!user_id || r.user_id === user_id))
    );
    return before - state.liabilities.length;
  }

  // 9. liability_balances
  if (/INSERT INTO liability_balances/i.test(sql)) {
    const [id, user_id, liability_id, balance_paise, as_of_date, source, notes] = params;
    const existing = state.liability_balances.find(
      (r) => r.liability_id === liability_id && r.as_of_date === as_of_date
    );
    if (existing) {
      existing.balance_paise = balance_paise;
      if (source) existing.source = source;
      if (notes !== undefined) existing.notes = notes;
    } else {
      state.liability_balances.push({
        id,
        user_id,
        liability_id,
        balance_paise,
        as_of_date,
        source: source || 'manual',
        notes: notes ?? null,
        created_at: now,
      });
    }
    return 1;
  }

  // 10. asset_valuations
  if (/INSERT INTO asset_valuations/i.test(sql)) {
    const [id, user_id, asset_id, valuation_paise, currency, as_of_date, source, notes] = params;
    const existing = state.asset_valuations.find(
      (r) => r.user_id === user_id && r.asset_id === asset_id && r.as_of_date === as_of_date
    );
    if (existing) {
      existing.valuation_paise = valuation_paise;
      existing.source = source;
      existing.notes = notes;
    } else {
      state.asset_valuations.push({
        id,
        user_id,
        asset_id,
        valuation_paise,
        currency: currency || 'INR',
        as_of_date,
        source: source || 'manual_appraisal',
        notes: notes ?? null,
        created_at: now,
      });
    }
    return 1;
  }

  // 11. asset_liability_links
  if (/INSERT INTO asset_liability_links/i.test(sql)) {
    const [id, user_id, asset_id, liability_id, link_type, ownership_share_percentage] = params;
    const existing = state.asset_liability_links.find(
      (r) => r.asset_id === asset_id && r.liability_id === liability_id
    );
    if (existing) {
      existing.link_type = link_type;
      existing.ownership_share_percentage = ownership_share_percentage;
    } else {
      state.asset_liability_links.push({
        id,
        user_id,
        asset_id,
        liability_id,
        link_type: link_type || 'mortgage',
        ownership_share_percentage: ownership_share_percentage ?? 100,
        created_at: now,
      });
    }
    return 1;
  }

  if (/DELETE FROM asset_liability_links/i.test(sql)) {
    const [user_id, asset_id, liability_id] = params;
    const before = state.asset_liability_links.length;
    state.asset_liability_links = state.asset_liability_links.filter(
      (r) => !(r.user_id === user_id && r.asset_id === asset_id && r.liability_id === liability_id)
    );
    return before - state.asset_liability_links.length;
  }

  // 12. financial_goals
  if (/INSERT INTO financial_goals/i.test(sql)) {
    const [
      id,
      user_id,
      name,
      category,
      target_amount_paise,
      target_date,
      initial_saved_paise,
      monthly_contribution_paise,
      expected_return_rate,
      inflation_rate,
      priority,
      currency,
      notes,
      member_id,
    ] = params;
    const existing = state.financial_goals.find((r) => r.id === id);
    if (existing) {
      existing.target_amount_paise = target_amount_paise;
    } else {
      state.financial_goals.push({
        id,
        user_id,
        name,
        category,
        target_amount_paise,
        target_date,
        initial_saved_paise: initial_saved_paise ?? 0,
        monthly_contribution_paise: monthly_contribution_paise ?? 0,
        expected_return_rate: expected_return_rate ?? 12.0,
        inflation_rate: inflation_rate ?? 6.0,
        priority: priority || 'medium',
        currency: currency || 'INR',
        notes: notes ?? null,
        member_id: member_id ?? null,
        created_at: now,
      });
    }
    return 1;
  }

  if (/UPDATE financial_goals SET/i.test(sql)) {
    const [
      name,
      category,
      target_amount_paise,
      target_date,
      initial_saved_paise,
      monthly_contribution_paise,
      expected_return_rate,
      inflation_rate,
      priority,
      notes,
      member_id,
      id,
      user_id,
    ] = params;
    const gol = state.financial_goals.find((r) => r.id === id && r.user_id === user_id);
    if (gol) {
      if (name !== null && name !== undefined) gol.name = name;
      if (category !== null && category !== undefined) gol.category = category;
      if (target_amount_paise !== null && target_amount_paise !== undefined)
        gol.target_amount_paise = target_amount_paise;
      if (target_date !== null && target_date !== undefined) gol.target_date = target_date;
      if (initial_saved_paise !== null && initial_saved_paise !== undefined)
        gol.initial_saved_paise = initial_saved_paise;
      if (monthly_contribution_paise !== null && monthly_contribution_paise !== undefined)
        gol.monthly_contribution_paise = monthly_contribution_paise;
      if (expected_return_rate !== null && expected_return_rate !== undefined)
        gol.expected_return_rate = expected_return_rate;
      if (inflation_rate !== null && inflation_rate !== undefined)
        gol.inflation_rate = inflation_rate;
      if (priority !== null && priority !== undefined) gol.priority = priority;
      if (notes !== null && notes !== undefined) gol.notes = notes;
      if (member_id !== null && member_id !== undefined) gol.member_id = member_id;
      return 1;
    }
    return 0;
  }

  if (/DELETE FROM financial_goals WHERE id = \?/i.test(sql)) {
    const [id, user_id] = params;
    const before = state.financial_goals.length;
    state.financial_goals = state.financial_goals.filter(
      (r) => !(r.id === id && (!user_id || r.user_id === user_id))
    );
    return before - state.financial_goals.length;
  }

  // 13. goal_holdings
  if (/INSERT INTO goal_holdings/i.test(sql)) {
    const [id, goal_id, holding_id, allocation_percentage] = params;
    const existing = state.goal_holdings.find(
      (r) => r.goal_id === goal_id && r.holding_id === holding_id
    );
    if (existing) {
      existing.allocation_percentage = allocation_percentage;
    } else {
      state.goal_holdings.push({
        id,
        goal_id,
        holding_id,
        allocation_percentage,
        created_at: now,
      });
    }
    return 1;
  }

  if (/DELETE FROM goal_holdings/i.test(sql)) {
    const [goal_id, holding_id] = params;
    const before = state.goal_holdings.length;
    state.goal_holdings = state.goal_holdings.filter(
      (r) => !(r.goal_id === goal_id && r.holding_id === holding_id)
    );
    return before - state.goal_holdings.length;
  }

  return null;
}
