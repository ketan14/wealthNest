import { RelationalDatabaseState } from './tauri-sqlite-types';

/**
 * Executes synchronous relational SELECT queries across all 13 local SQLite tables.
 */
export function executeRelationalRead<T>(
  state: RelationalDatabaseState,
  sql: string,
  params: unknown[]
): T[] {
  // 1. asset_classes
  if (/FROM asset_classes WHERE id = \?/i.test(sql)) {
    const [id] = params;
    return state.asset_classes.filter((r) => r.id === id) as unknown as T[];
  }
  if (/FROM asset_classes/i.test(sql)) {
    return [...state.asset_classes].sort(
      (a, b) => Number(a.display_order || 0) - Number(b.display_order || 0)
    ) as unknown as T[];
  }

  // 2. family_members
  if (/FROM family_members WHERE user_id = \? AND id = \?/i.test(sql)) {
    const [user_id, id] = params;
    return state.family_members.filter(
      (r) => r.user_id === user_id && r.id === id
    ) as unknown as T[];
  }
  if (/FROM family_members WHERE user_id = \?/i.test(sql)) {
    const [user_id] = params;
    return state.family_members
      .filter((r) => r.user_id === user_id)
      .sort((a, b) => Number(b.is_primary || 0) - Number(a.is_primary || 0)) as unknown as T[];
  }
  if (/FROM family_members WHERE id = \?/i.test(sql)) {
    const [id] = params;
    return state.family_members.filter((r) => r.id === id) as unknown as T[];
  }

  // 3. portfolio_accounts
  if (/FROM portfolio_accounts WHERE user_id = \? AND id = \?/i.test(sql)) {
    const [user_id, id] = params;
    return state.portfolio_accounts.filter(
      (r) => r.user_id === user_id && r.id === id
    ) as unknown as T[];
  }
  if (/FROM portfolio_accounts WHERE user_id = \?/i.test(sql)) {
    const [user_id] = params;
    return state.portfolio_accounts.filter((r) => r.user_id === user_id) as unknown as T[];
  }
  if (/FROM portfolio_accounts WHERE id = \?/i.test(sql)) {
    const [id] = params;
    return state.portfolio_accounts.filter((r) => r.id === id) as unknown as T[];
  }

  // 4. Holdings joined with assets and asset_classes
  if (/FROM holdings h JOIN assets a/i.test(sql)) {
    const [user_id] = params;
    const rows = state.holdings
      .filter((h) => h.user_id === user_id)
      .map((h) => {
        const asset = state.assets.find((a) => a.user_id === h.user_id && a.id === h.asset_id);
        if (!asset) return null;
        const ac = state.asset_classes.find((c) => c.id === asset.asset_class_id) || {
          id: asset.asset_class_id || 'equity',
          name: 'Equity & Stocks',
          color_hex: '#10B981',
        };
        return {
          holdingId: h.id,
          assetId: asset.id,
          name: asset.name,
          ticker: asset.ticker,
          isin: asset.isin,
          assetClassId: ac.id,
          assetClassName: ac.name,
          assetClassColor: ac.color_hex,
          quantity: h.quantity,
          unitCostCents: h.unit_cost_paise,
          currentValueCents: h.current_value_paise,
          currency: asset.currency || 'INR',
          updatedAt: h.updated_at,
          dematAccountId: h.demat_account_id,
          folioNumber: h.folio_number,
          amcName: h.amc_name,
          schemePlan: h.scheme_plan,
          costBasisVerified: h.cost_basis_verified,
          memberId: h.member_id,
          accountId: h.account_id,
        };
      })
      .filter(Boolean);
    return rows as unknown as T[];
  }

  if (/FROM holdings WHERE user_id = \? AND asset_id = \?/i.test(sql)) {
    const [user_id, asset_id] = params;
    return state.holdings.filter(
      (h) => h.user_id === user_id && h.asset_id === asset_id
    ) as unknown as T[];
  }

  // 5. assets lookups
  if (/FROM assets WHERE user_id = \? AND isin = \?/i.test(sql)) {
    const [user_id, isin] = params;
    return state.assets.filter((a) => a.user_id === user_id && a.isin === isin) as unknown as T[];
  }
  if (/FROM assets WHERE user_id = \? AND LOWER\(name\) = LOWER\(\?\)/i.test(sql)) {
    const [user_id, name] = params;
    const target = String(name || '').toLowerCase();
    return state.assets.filter(
      (a) => a.user_id === user_id && String(a.name || '').toLowerCase() === target
    ) as unknown as T[];
  }

  // 6. transactions
  if (/FROM transactions t LEFT JOIN assets a/i.test(sql)) {
    const [user_id] = params;
    const rows = state.transactions
      .filter((t) => t.user_id === user_id)
      .map((t) => {
        const asset = state.assets.find((a) => a.user_id === t.user_id && a.id === t.asset_id);
        return {
          id: t.id,
          userId: t.user_id,
          assetId: t.asset_id,
          assetName: asset?.name,
          assetTicker: asset?.ticker,
          type: t.type,
          quantity: t.quantity,
          amountCents: t.amount_paise,
          currency: t.currency || 'INR',
          transactionDate: t.transaction_date,
          notes: t.notes,
          memberId: t.member_id,
          accountId: t.account_id,
          createdAt: t.created_at,
        };
      })
      .sort((a, b) => String(b.transactionDate).localeCompare(String(a.transactionDate)));
    return rows as unknown as T[];
  }

  if (/FROM transactions WHERE user_id = \? AND asset_id = \?/i.test(sql)) {
    const [user_id, asset_id, transaction_date, amount_paise, type] = params;
    return state.transactions.filter(
      (t) =>
        t.user_id === user_id &&
        t.asset_id === asset_id &&
        t.transaction_date === transaction_date &&
        t.amount_paise === amount_paise &&
        t.type === type
    ) as unknown as T[];
  }

  // 7. liabilities & balances
  if (/FROM liabilities WHERE user_id = \?/i.test(sql)) {
    const [user_id] = params;
    return state.liabilities.filter((l) => l.user_id === user_id) as unknown as T[];
  }

  if (/FROM liability_balances WHERE liability_id = \? AND user_id = \?/i.test(sql)) {
    const [liability_id, user_id] = params;
    return state.liability_balances
      .filter((b) => b.liability_id === liability_id && b.user_id === user_id)
      .sort((a, b) => String(b.as_of_date).localeCompare(String(a.as_of_date))) as unknown as T[];
  }

  if (/FROM liability_balances WHERE liability_id = \?/i.test(sql)) {
    const [liability_id] = params;
    return state.liability_balances
      .filter((b) => b.liability_id === liability_id)
      .sort((a, b) => String(b.as_of_date).localeCompare(String(a.as_of_date))) as unknown as T[];
  }

  // 8. asset_valuations & links
  if (/FROM asset_valuations WHERE asset_id = \? AND user_id = \?/i.test(sql)) {
    const [asset_id, user_id] = params;
    return state.asset_valuations
      .filter((v) => v.asset_id === asset_id && v.user_id === user_id)
      .sort((a, b) => String(b.as_of_date).localeCompare(String(a.as_of_date))) as unknown as T[];
  }

  if (/FROM asset_liability_links WHERE user_id = \?/i.test(sql)) {
    const [user_id] = params;
    return state.asset_liability_links.filter((l) => l.user_id === user_id) as unknown as T[];
  }

  // 9. financial_goals & goal_holdings
  if (/FROM financial_goals WHERE user_id = \?/i.test(sql)) {
    const [user_id] = params;
    return state.financial_goals
      .filter((g) => g.user_id === user_id)
      .sort((a, b) => String(a.target_date).localeCompare(String(b.target_date))) as unknown as T[];
  }

  if (/FROM goal_holdings gh JOIN holdings h/i.test(sql)) {
    const [goal_id] = params;
    const rows = state.goal_holdings
      .filter((gh) => gh.goal_id === goal_id)
      .map((gh) => {
        const h = state.holdings.find((item) => item.id === gh.holding_id);
        if (!h) return null;
        const asset = state.assets.find((a) => a.user_id === h.user_id && a.id === h.asset_id);
        if (!asset) return null;
        return {
          holding_id: gh.holding_id,
          allocation_percentage: gh.allocation_percentage,
          holding_name: asset.name,
          ticker: asset.ticker,
          current_value_paise: h.current_value_paise,
        };
      })
      .filter(Boolean);
    return rows as unknown as T[];
  }

  return [];
}
