import { RelationalDatabaseState } from './tauri-sqlite-types';

/**
 * Executes synchronous relational SELECT queries across all 13 local SQLite tables.
 */
export function executeRelationalRead<T>(
  state: RelationalDatabaseState,
  sql: string,
  params: unknown[]
): T[] {
  // 0. Households, household_members, invitations, grants, audit logs
  if (/FROM households h JOIN household_members hm/i.test(sql)) {
    const [user_id] = params;
    return state.household_members
      .filter((hm) => hm.user_id === user_id && hm.status === 'active')
      .map((hm) => {
        const h = state.households.find((hh) => hh.id === hm.household_id);
        if (!h) return null;
        return {
          id: h.id,
          name: h.name,
          created_by: h.created_by,
          plan_tier: h.plan_tier ?? 'family',
          role: hm.household_role,
          status: hm.status,
          created_at: h.created_at,
          updated_at: h.updated_at,
        };
      })
      .filter(Boolean) as unknown as T[];
  }
  if (/SELECT id, name FROM households WHERE id = \?/i.test(sql) || /SELECT id FROM households WHERE id = \?/i.test(sql)) {
    const [id] = params;
    return state.households.filter((h) => h.id === id) as unknown as T[];
  }
  if (/SELECT id FROM profiles WHERE id = \?/i.test(sql)) {
    const [id] = params;
    return state.profiles.filter((p) => p.id === id) as unknown as T[];
  }
  if (/SELECT COUNT\(\*\) as cnt FROM household_members WHERE household_id = \?/i.test(sql)) {
    const [household_id] = params;
    const cnt = state.household_members.filter(
      (hm) => hm.household_id === household_id && hm.status === 'active'
    ).length;
    return [{ cnt }] as unknown as T[];
  }
  if (/FROM household_members hm LEFT JOIN profiles p/i.test(sql)) {
    const [household_id] = params;
    return state.household_members
      .filter((hm) => hm.household_id === household_id)
      .map((hm) => {
        const p = state.profiles.find((prof) => prof.id === hm.user_id);
        return {
          ...hm,
          display_name: p?.display_name,
        };
      }) as unknown as T[];
  }
  if (/FROM household_members WHERE household_id = \? AND user_id = \?/i.test(sql)) {
    const [household_id, user_id] = params;
    return state.household_members.filter(
      (hm) => hm.household_id === household_id && hm.user_id === user_id
    ) as unknown as T[];
  }
  if (/FROM household_members WHERE user_id = \? AND status = 'active'/i.test(sql)) {
    const [user_id] = params;
    return state.household_members.filter(
      (hm) => hm.user_id === user_id && hm.status === 'active'
    ) as unknown as T[];
  }
  if (/FROM household_invitations hi LEFT JOIN households h/i.test(sql)) {
    const [token_hash] = params;
    return state.household_invitations
      .filter((hi) => hi.token_hash === token_hash)
      .map((hi) => {
        const h = state.households.find((hh) => hh.id === hi.household_id);
        const fm = state.family_members.find((m) => m.id === hi.family_member_id);
        return {
          ...hi,
          household_name: h?.name,
          family_member_name: fm?.name,
        };
      }) as unknown as T[];
  }
  if (/FROM household_invitations hi LEFT JOIN family_members fm/i.test(sql)) {
    const [household_id] = params;
    return state.household_invitations
      .filter((hi) => hi.household_id === household_id)
      .map((hi) => {
        const fm = state.family_members.find((m) => m.id === hi.family_member_id);
        return {
          ...hi,
          family_member_name: fm?.name,
        };
      }) as unknown as T[];
  }
  if (/FROM household_invitations WHERE token_hash = \?/i.test(sql)) {
    const [token_hash] = params;
    return state.household_invitations.filter((hi) => hi.token_hash === token_hash) as unknown as T[];
  }
  if (/FROM household_invitations WHERE id = \?/i.test(sql)) {
    const [id] = params;
    return state.household_invitations.filter((hi) => hi.id === id) as unknown as T[];
  }
  if (/FROM family_member_access WHERE household_id = \? AND family_member_id = \?/i.test(sql)) {
    const [household_id, family_member_id] = params;
    return state.family_member_access.filter(
      (r) => r.household_id === household_id && r.family_member_id === family_member_id
    ) as unknown as T[];
  }
  if (/FROM family_member_access WHERE household_id = \?/i.test(sql)) {
    const [household_id] = params;
    return state.family_member_access.filter((r) => r.household_id === household_id) as unknown as T[];
  }
  if (/FROM restricted_record_grants WHERE household_id = \?/i.test(sql)) {
    const [household_id, p2, p3] = params;
    return state.restricted_record_grants.filter((r) => {
      if (r.household_id !== household_id) return false;
      if (/AND record_type = \?/i.test(sql) && r.record_type !== p2) return false;
      const recordIdParam = /AND record_type = \?/i.test(sql) ? p3 : p2;
      if (/AND record_id = \?/i.test(sql) && r.record_id !== recordIdParam) return false;
      return true;
    }) as unknown as T[];
  }
  if (/FROM household_audit_logs WHERE household_id = \?/i.test(sql)) {
    const [household_id, limit] = params;
    return [...state.household_audit_logs]
      .filter((r) => r.household_id === household_id)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, Number(limit || 50)) as unknown as T[];
  }

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
  if (/FROM family_members WHERE household_id = \? AND linked_user_id = \?/i.test(sql)) {
    const [household_id, linked_user_id] = params;
    return state.family_members.filter(
      (r) => r.household_id === household_id && r.linked_user_id === linked_user_id
    ) as unknown as T[];
  }
  if (/FROM family_members WHERE household_id = \?/i.test(sql)) {
    const [household_id] = params;
    return state.family_members
      .filter((r) => r.household_id === household_id)
      .sort((a, b) => Number(b.is_primary || 0) - Number(a.is_primary || 0)) as unknown as T[];
  }
  if (/FROM family_members WHERE id = \? AND \(user_id = \? OR household_id = \?\)/i.test(sql)) {
    const [id, user_id, household_id] = params;
    return state.family_members.filter(
      (r) => r.id === id && (r.user_id === user_id || r.household_id === household_id)
    ) as unknown as T[];
  }
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
  if (/FROM portfolio_accounts WHERE household_id = \?/i.test(sql)) {
    const [household_id] = params;
    return state.portfolio_accounts.filter(
      (r) => r.household_id === household_id
    ) as unknown as T[];
  }
  if (/FROM portfolio_accounts WHERE id = \? AND \(user_id = \? OR household_id = \?\)/i.test(sql)) {
    const [id, user_id, household_id] = params;
    return state.portfolio_accounts.filter(
      (r) => r.id === id && (r.user_id === user_id || r.household_id === household_id)
    ) as unknown as T[];
  }
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

  // 4. Holdings, holding_owners joined with assets and asset_classes
  if (/FROM holding_owners WHERE holding_id = \?/i.test(sql)) {
    const [holding_id] = params;
    return [...state.holding_owners]
      .filter((o) => o.holding_id === holding_id)
      .sort((a, b) => Number(b.is_primary_owner || 0) - Number(a.is_primary_owner || 0)) as unknown as T[];
  }
  if (/FROM holdings h JOIN assets a/i.test(sql)) {
    const [scopeId] = params;
    const isByHousehold = /WHERE h\.household_id = \?/i.test(sql);
    const rows = state.holdings
      .filter((h) => (isByHousehold ? h.household_id === scopeId : h.user_id === scopeId))
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
          householdId: h.household_id,
          visibility: h.visibility || 'household_shared',
          createdBy: h.created_by,
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
  if (/SELECT household_id FROM holdings WHERE id = \?/i.test(sql)) {
    const [id] = params;
    return state.holdings.filter((h) => h.id === id) as unknown as T[];
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
    const [scopeId] = params;
    const isByHousehold = /WHERE t\.household_id = \?/i.test(sql);
    const rows = state.transactions
      .filter((t) => (isByHousehold ? t.household_id === scopeId : t.user_id === scopeId))
      .map((t) => {
        const asset = state.assets.find((a) => a.user_id === t.user_id && a.id === t.asset_id);
        return {
          id: t.id,
          householdId: t.household_id,
          userId: t.user_id,
          visibility: t.visibility || 'household_shared',
          createdBy: t.created_by,
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
          destinationAccountId: t.destination_account_id,
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

  // 7. liabilities, liability_parties & balances
  if (/FROM liability_parties WHERE liability_id = \?/i.test(sql)) {
    const [liability_id] = params;
    return [...state.liability_parties]
      .filter((p) => p.liability_id === liability_id)
      .sort((a, b) => Number(b.liability_share || 0) - Number(a.liability_share || 0)) as unknown as T[];
  }
  if (/SELECT household_id FROM liabilities WHERE id = \?/i.test(sql)) {
    const [id] = params;
    return state.liabilities.filter((l) => l.id === id) as unknown as T[];
  }
  if (/FROM liabilities WHERE id = \? AND \(user_id = \? OR household_id = \?\)/i.test(sql)) {
    const [id, user_id, household_id] = params;
    return state.liabilities.filter(
      (l) => l.id === id && (l.user_id === user_id || l.household_id === household_id)
    ) as unknown as T[];
  }
  if (/FROM liabilities WHERE household_id = \?/i.test(sql)) {
    const [household_id] = params;
    return state.liabilities.filter((l) => l.household_id === household_id) as unknown as T[];
  }
  if (/FROM liabilities WHERE user_id = \?/i.test(sql)) {
    const [user_id] = params;
    return state.liabilities.filter((l) => l.user_id === user_id) as unknown as T[];
  }

  if (/FROM liability_balances WHERE liability_id = \? AND \(user_id = \? OR household_id = \?\)/i.test(sql)) {
    const [liability_id, user_id, household_id] = params;
    return state.liability_balances
      .filter(
        (b) =>
          b.liability_id === liability_id &&
          (b.user_id === user_id || b.household_id === household_id)
      )
      .sort((a, b) => String(b.as_of_date).localeCompare(String(a.as_of_date))) as unknown as T[];
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
  if (/FROM asset_valuations WHERE asset_id = \? AND \(user_id = \? OR household_id = \?\)/i.test(sql)) {
    const [asset_id, user_id, household_id] = params;
    return state.asset_valuations
      .filter(
        (v) => v.asset_id === asset_id && (v.user_id === user_id || v.household_id === household_id)
      )
      .sort((a, b) => String(b.as_of_date).localeCompare(String(a.as_of_date))) as unknown as T[];
  }
  if (/FROM asset_valuations WHERE asset_id = \? AND user_id = \?/i.test(sql)) {
    const [asset_id, user_id] = params;
    return state.asset_valuations
      .filter((v) => v.asset_id === asset_id && v.user_id === user_id)
      .sort((a, b) => String(b.as_of_date).localeCompare(String(a.as_of_date))) as unknown as T[];
  }

  if (/FROM asset_liability_links WHERE user_id = \? OR household_id = \?/i.test(sql)) {
    const [user_id, household_id] = params;
    return state.asset_liability_links.filter(
      (l) => l.user_id === user_id || l.household_id === household_id
    ) as unknown as T[];
  }
  if (/FROM asset_liability_links WHERE user_id = \?/i.test(sql)) {
    const [user_id] = params;
    return state.asset_liability_links.filter((l) => l.user_id === user_id) as unknown as T[];
  }

  // 9. financial_goals & goal_holdings
  if (/FROM financial_goals WHERE household_id = \?/i.test(sql)) {
    const [household_id] = params;
    return state.financial_goals
      .filter((g) => g.household_id === household_id)
      .sort((a, b) => String(a.target_date).localeCompare(String(b.target_date))) as unknown as T[];
  }
  if (/FROM financial_goals WHERE user_id = \?/i.test(sql)) {
    const [user_id] = params;
    return state.financial_goals
      .filter((g) => g.user_id === user_id)
      .sort((a, b) => String(a.target_date).localeCompare(String(b.target_date))) as unknown as T[];
  }

  // 10. family_documents
  if (/SELECT local_data_url as localDataUrl FROM family_documents WHERE id = \?/i.test(sql)) {
    const [id, user_id, household_id] = params;
    return state.family_documents
      .filter((d) => d.id === id && (!user_id || d.user_id === user_id || d.household_id === household_id))
      .map((d) => ({ localDataUrl: d.local_data_url })) as unknown as T[];
  }
  if (/FROM family_documents WHERE (user_id|household_id) = \?/i.test(sql)) {
    const [scopeId] = params;
    const byHousehold = /WHERE household_id = \?/i.test(sql);
    return state.family_documents
      .filter((d) => (byHousehold ? d.household_id === scopeId : d.user_id === scopeId))
      .map((d) => ({
        id: d.id,
        userId: d.user_id,
        householdId: d.household_id,
        memberId: d.member_id,
        title: d.title,
        category: d.category,
        fileName: d.file_name,
        fileSizeBytes: d.file_size_bytes,
        mimeType: d.mime_type,
        storagePath: d.storage_path,
        documentDate: d.document_date,
        expiryDate: d.expiry_date,
        notes: d.notes,
        isEncrypted: d.is_encrypted,
        visibility: d.visibility || 'household_shared',
        createdBy: d.created_by,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      })) as unknown as T[];
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
