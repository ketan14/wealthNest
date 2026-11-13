import { RelationalDatabaseState } from './tauri-sqlite-types';

/**
 * Executes write SQL statements for core portfolio tables
 * (asset_classes, profiles, family_members, portfolio_accounts, assets, holdings, transactions).
 * Returns affected row count, or null if the SQL did not match a portfolio table.
 */
export function executePortfolioWrite(
  state: RelationalDatabaseState,
  sql: string,
  params: unknown[],
  now: string
): number | null {
    // 1. asset_classes
    if (/INSERT OR IGNORE INTO asset_classes/i.test(sql)) {
      const [id, name, color_hex, display_order] = params;
      if (!state.asset_classes.some((r) => r.id === id)) {
        state.asset_classes.push({ id, name, color_hex, display_order });
        return 1;
      }
      return 0;
    }

    // 2. profiles
    if (/INSERT OR IGNORE INTO profiles/i.test(sql)) {
      const [id, display_name] = params;
      if (!state.profiles.some((r) => r.id === id)) {
        state.profiles.push({
          id,
          display_name: display_name || 'Local Investor',
          default_currency: 'INR',
          preferences_json: null,
          created_at: now,
          updated_at: now,
        });
        return 1;
      }
      return 0;
    }

    if (/INSERT INTO profiles/i.test(sql)) {
      const [id, display_name, default_currency] = params;
      const existing = state.profiles.find((r) => r.id === id);
      if (existing) {
        existing.display_name = display_name;
        existing.default_currency = default_currency || 'INR';
        existing.updated_at = now;
      } else {
        state.profiles.push({
          id,
          display_name,
          default_currency: default_currency || 'INR',
          preferences_json: null,
          created_at: now,
          updated_at: now,
        });
      }
      return 1;
    }

    // 3. family_members
    if (/INSERT INTO family_members/i.test(sql)) {
      const [id, user_id, name, relationship, pan_masked, color_hex, is_primary, notes] = params;
      const existing = state.family_members.find((r) => r.id === id);
      if (existing) {
        existing.name = name;
        existing.relationship = relationship;
        existing.pan_masked = pan_masked;
        existing.color_hex = color_hex;
        existing.is_primary = is_primary;
        existing.notes = notes;
      } else {
        state.family_members.push({
          id,
          user_id,
          name,
          relationship,
          pan_masked,
          color_hex,
          is_primary,
          notes,
          created_at: now,
        });
      }
      return 1;
    }

    if (/DELETE FROM family_members WHERE id = \?/i.test(sql)) {
      const [id] = params;
      const before = state.family_members.length;
      state.family_members = state.family_members.filter((r) => r.id !== id);
      return before - state.family_members.length;
    }

    // 4. portfolio_accounts
    if (/INSERT INTO portfolio_accounts/i.test(sql)) {
      const [
        id,
        user_id,
        member_id,
        account_name,
        broker_name,
        depository,
        account_number_masked,
        account_type,
      ] = params;
      const existing = state.portfolio_accounts.find((r) => r.id === id);
      if (existing) {
        existing.member_id = member_id;
        existing.account_name = account_name;
        existing.broker_name = broker_name;
        existing.depository = depository;
        existing.account_number_masked = account_number_masked;
        existing.account_type = account_type;
      } else {
        state.portfolio_accounts.push({
          id,
          user_id,
          member_id,
          account_name,
          broker_name,
          depository,
          account_number_masked,
          account_type,
          created_at: now,
        });
      }
      return 1;
    }

    if (/DELETE FROM portfolio_accounts WHERE id = \?/i.test(sql)) {
      const [id] = params;
      const before = state.portfolio_accounts.length;
      state.portfolio_accounts = state.portfolio_accounts.filter((r) => r.id !== id);
      return before - state.portfolio_accounts.length;
    }

    // 5. assets
    if (/INSERT INTO assets/i.test(sql)) {
      if (/'mutual_fund'/i.test(sql) && params.length === 6) {
        const [id, user_id, name, ticker, isin, currency] = params;
        state.assets.push({
          id,
          user_id,
          name,
          ticker,
          isin,
          asset_class_id: 'mutual_fund',
          currency: currency || 'INR',
          created_at: now,
        });
        return 1;
      }
      const [id, user_id, name, ticker, isin, asset_class_id, currency] = params;
      const existing = state.assets.find((r) => r.id === id);
      if (existing) {
        existing.name = name;
        existing.ticker = ticker ?? existing.ticker;
        existing.isin = isin ?? existing.isin;
        existing.asset_class_id = asset_class_id || existing.asset_class_id || 'equity';
        existing.currency = currency || existing.currency || 'INR';
      } else {
        state.assets.push({
          id,
          user_id,
          name,
          ticker: ticker ?? null,
          isin: isin ?? null,
          asset_class_id: asset_class_id || 'equity',
          currency: currency || 'INR',
          created_at: now,
        });
      }
      return 1;
    }

    if (/UPDATE assets SET name = \?, isin = COALESCE\(\?, isin\)/i.test(sql)) {
      const [name, isin, ticker, id, user_id] = params;
      const asset = state.assets.find((r) => r.id === id && r.user_id === user_id);
      if (asset) {
        asset.name = name;
        if (isin !== null && isin !== undefined) asset.isin = isin;
        if (ticker !== null && ticker !== undefined) asset.ticker = ticker;
        return 1;
      }
      return 0;
    }

    if (/UPDATE assets SET name = \?, ticker = COALESCE\(\?, ticker\)/i.test(sql)) {
      const [name, ticker, id, user_id] = params;
      const asset = state.assets.find((r) => r.id === id && r.user_id === user_id);
      if (asset) {
        asset.name = name;
        if (ticker !== null && ticker !== undefined) asset.ticker = ticker;
        return 1;
      }
      return 0;
    }

    // 6. holdings
    if (/INSERT INTO holdings/i.test(sql)) {
      const [
        id,
        user_id,
        asset_id,
        quantity,
        unit_cost_paise,
        current_value_paise,
        member_id,
        account_id,
        demat_account_id,
        folio_number,
        amc_name,
        scheme_plan,
        cost_basis_verified,
      ] = params;
      const existing = state.holdings.find(
        (r) => r.id === id || (r.user_id === user_id && r.asset_id === asset_id)
      );
      if (existing) {
        existing.quantity = quantity;
        existing.unit_cost_paise = unit_cost_paise;
        existing.current_value_paise = current_value_paise;
        existing.updated_at = now;
      } else {
        state.holdings.push({
          id,
          user_id,
          asset_id,
          quantity,
          unit_cost_paise,
          current_value_paise,
          member_id: member_id ?? null,
          account_id: account_id ?? null,
          demat_account_id: demat_account_id ?? null,
          folio_number: folio_number ?? null,
          amc_name: amc_name ?? null,
          scheme_plan: scheme_plan ?? null,
          cost_basis_verified: cost_basis_verified ?? 1,
          updated_at: now,
        });
      }
      return 1;
    }

    if (
      /UPDATE holdings SET quantity = \?, unit_cost_paise = \?, current_value_paise = \?, demat_account_id/i.test(
        sql
      )
    ) {
      const [
        quantity,
        unit_cost_paise,
        current_value_paise,
        demat_account_id,
        folio_number,
        amc_name,
        scheme_plan,
        cost_basis_verified,
        member_id,
        account_id,
        id,
        user_id,
      ] = params;
      const h = state.holdings.find((r) => r.id === id && r.user_id === user_id);
      if (h) {
        h.quantity = quantity;
        h.unit_cost_paise = unit_cost_paise;
        h.current_value_paise = current_value_paise;
        if (demat_account_id !== null && demat_account_id !== undefined)
          h.demat_account_id = demat_account_id;
        if (folio_number !== null && folio_number !== undefined) h.folio_number = folio_number;
        if (amc_name !== null && amc_name !== undefined) h.amc_name = amc_name;
        if (scheme_plan !== null && scheme_plan !== undefined) h.scheme_plan = scheme_plan;
        h.cost_basis_verified = cost_basis_verified;
        if (member_id !== null && member_id !== undefined) h.member_id = member_id;
        if (account_id !== null && account_id !== undefined) h.account_id = account_id;
        h.updated_at = now;
        return 1;
      }
      return 0;
    }

    if (
      /UPDATE holdings SET quantity = \?, unit_cost_paise = \?, current_value_paise = \?/i.test(sql)
    ) {
      const [quantity, unit_cost_paise, current_value_paise, id, user_id] = params;
      const h = state.holdings.find((r) => r.id === id && r.user_id === user_id);
      if (h) {
        h.quantity = quantity;
        h.unit_cost_paise = unit_cost_paise;
        h.current_value_paise = current_value_paise;
        h.updated_at = now;
        return 1;
      }
      return 0;
    }

    if (/DELETE FROM holdings WHERE id = \?/i.test(sql)) {
      const [id, user_id] = params;
      const before = state.holdings.length;
      state.holdings = state.holdings.filter(
        (r) => !(r.id === id && (!user_id || r.user_id === user_id))
      );
      return before - state.holdings.length;
    }

    // 7. transactions
    if (/INSERT INTO transactions/i.test(sql)) {
      const [
        id,
        user_id,
        asset_id,
        type,
        quantity,
        amount_paise,
        currency,
        transaction_date,
        notes,
        member_id,
        account_id,
      ] = params;
      const existing = state.transactions.find((r) => r.id === id);
      if (existing) {
        existing.amount_paise = amount_paise;
        existing.notes = notes;
      } else {
        state.transactions.push({
          id,
          user_id,
          asset_id: asset_id ?? null,
          type,
          quantity: quantity ?? null,
          amount_paise,
          currency: currency || 'INR',
          transaction_date,
          notes: notes ?? null,
          member_id: member_id ?? null,
          account_id: account_id ?? null,
          created_at: now,
        });
      }
      return 1;
    }

    if (/DELETE FROM transactions WHERE id = \?/i.test(sql)) {
      const [id, user_id] = params;
      const before = state.transactions.length;
      state.transactions = state.transactions.filter(
        (r) => !(r.id === id && (!user_id || r.user_id === user_id))
      );
      return before - state.transactions.length;
    }


  return null;
}
