import { Result, ok, err } from '@wealthnest/shared';
import {
  BackupPort,
  HouseholdDataResetPreview,
  HouseholdDataResetResult,
  HouseholdDeletionResult,
  PortfolioBackupData,
  ResettableFinancialCategory,
} from '@wealthnest/application';
import { supabase } from './client';
import { toValidUuidOrNull } from './uuid-utils';
import { resolveHouseholdIdForWrite } from './household-scope';

const VAULT_BUCKET = 'family-vault';

export class SupabaseBackupAdapter implements BackupPort {
  async createFullBackup(_scopeId: string): Promise<Result<PortfolioBackupData>> {
    return err(new Error('Use ExportPortfolioDataUseCase for backup generation'));
  }

  async restoreFromBackup(
    scopeId: string,
    backup: PortfolioBackupData,
    options?: { readonly targetUserId?: string; readonly householdId?: string }
  ): Promise<
    Result<{
      readonly restoredHoldings: number;
      readonly restoredTransactions: number;
      readonly restoredLiabilities: number;
      readonly restoredGoals: number;
    }>
  > {
    try {
      const requestedHousehold =
        options?.householdId ?? backup.household?.id ?? toValidUuidOrNull(scopeId) ?? undefined;
      const actorId =
        toValidUuidOrNull(options?.targetUserId) ?? toValidUuidOrNull(backup.user?.id) ?? null;

      const householdId = await resolveHouseholdIdForWrite(
        requestedHousehold,
        actorId ?? undefined
      );

      let restoredHoldings = 0;
      let restoredTransactions = 0;
      let restoredLiabilities = 0;
      let restoredGoals = 0;

      // 1. Restore Assets and Holdings
      for (const h of backup.holdings) {
        const visibility = h.visibility ?? 'household_shared';
        const { error: assetErr } = await supabase.from('assets').upsert(
          {
            id: h.assetId,
            household_id: householdId,
            visibility,
            ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
            name: h.name,
            ticker: h.ticker || null,
            isin: h.isin || null,
            asset_class_id: h.assetClassId,
            currency: h.currency || 'INR',
          },
          { onConflict: 'id' }
        );

        if (assetErr) {
          return err(new Error(`Failed to restore asset '${h.name}': ${assetErr.message}`));
        }

        const { error: holdingErr } = await supabase.from('holdings').upsert(
          {
            id: h.holdingId,
            household_id: householdId,
            visibility,
            ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
            asset_id: h.assetId,
            quantity: h.quantity,
            unit_cost_cents: h.unitCostCents,
            current_value_cents: h.currentValueCents,
            member_id: toValidUuidOrNull(h.memberId),
            account_id: toValidUuidOrNull(h.accountId),
            demat_account_id: h.dematAccountId || null,
            folio_number: h.folioNumber || null,
            amc_name: h.amcName || null,
            scheme_plan: h.schemePlan || null,
            cost_basis_verified: h.costBasisVerified ?? true,
          },
          { onConflict: 'id' }
        );

        if (holdingErr) {
          return err(new Error(`Failed to restore holding '${h.name}': ${holdingErr.message}`));
        }

        if (h.owners && h.owners.length > 0) {
          await supabase.rpc('set_holding_owners', {
            p_holding_id: h.holdingId,
            p_owners: h.owners.map((o) => ({
              family_member_id: o.familyMemberId,
              ownership_share: o.ownershipShare,
              is_primary_owner: Boolean(o.isPrimaryOwner),
            })),
          });
        }

        restoredHoldings++;
      }

      // 2. Restore Transactions
      for (const t of backup.transactions) {
        const { error: txErr } = await supabase.from('transactions').upsert(
          {
            id: t.id,
            household_id: householdId,
            visibility: t.visibility ?? 'household_shared',
            ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
            asset_id: toValidUuidOrNull(t.assetId),
            type: t.type,
            quantity: t.quantity ?? null,
            amount_cents: t.amountCents,
            currency: t.currency || 'INR',
            transaction_date: t.transactionDate,
            notes: t.notes || null,
            member_id: toValidUuidOrNull(t.memberId),
            account_id: toValidUuidOrNull(t.accountId),
          },
          { onConflict: 'id' }
        );

        if (txErr) {
          return err(new Error(`Failed to restore transaction '${t.id}': ${txErr.message}`));
        }
        restoredTransactions++;
      }

      // 3. Restore Liabilities
      for (const l of backup.liabilities) {
        const { error: libErr } = await supabase.from('liabilities').upsert(
          {
            id: l.id,
            household_id: householdId,
            visibility: l.visibility ?? 'household_shared',
            ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
            name: l.name,
            loan_type: l.loanType,
            lender: l.lender,
            account_number: l.accountNumber || null,
            original_principal_cents: Number(l.originalPrincipalCents),
            interest_rate: l.interestRate,
            interest_type: l.interestType || 'floating',
            tenure_months: l.tenureMonths || null,
            emi_amount_cents: Number(l.emiAmountCents),
            currency: l.currency || 'INR',
            start_date: l.startDate || null,
            end_date: l.endDate || null,
            status: l.status,
            linked_asset_id: toValidUuidOrNull(l.linkedAssetId),
            member_id: toValidUuidOrNull(l.memberId),
            notes: l.notes || null,
          },
          { onConflict: 'id' }
        );

        if (libErr) {
          return err(new Error(`Failed to restore liability '${l.name}': ${libErr.message}`));
        }

        if (l.parties && l.parties.length > 0) {
          await supabase.rpc('set_liability_parties', {
            p_liability_id: l.id,
            p_parties: l.parties.map((p) => ({
              family_member_id: p.familyMemberId,
              party_role: p.partyRole,
              liability_share: p.liabilityShare,
            })),
          });
        }

        restoredLiabilities++;
      }

      // 4. Restore Goals (fixed table name 'goals')
      for (const g of backup.goals) {
        const { error: goalErr } = await supabase.from('goals').upsert(
          {
            id: g.id,
            household_id: householdId,
            visibility: g.visibility ?? 'household_shared',
            ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
            name: g.name,
            category: g.category,
            target_amount_cents: g.targetAmountCents,
            target_date: g.targetDate,
            initial_saved_cents: g.initialSavedCents || 0,
            monthly_contribution_cents: g.monthlyContributionCents || 0,
            expected_return_rate: g.expectedReturnRate || 12.0,
            inflation_rate: g.inflationRate || 6.0,
            priority: g.priority || 'medium',
            currency: g.currency || 'INR',
            notes: g.notes || null,
            member_id: toValidUuidOrNull(g.memberId),
          },
          { onConflict: 'id' }
        );

        if (goalErr) {
          return err(new Error(`Failed to restore goal '${g.name}': ${goalErr.message}`));
        }
        restoredGoals++;
      }

      return ok({
        restoredHoldings,
        restoredTransactions,
        restoredLiabilities,
        restoredGoals,
      });
    } catch (e: any) {
      return err(new Error(`Restore execution aborted: ${e?.message || 'Unknown error'}`));
    }
  }

  async getDataResetPreview(params: {
    readonly householdId?: string;
    readonly userId?: string;
  }): Promise<Result<HouseholdDataResetPreview>> {
    try {
      const validHouseholdId = toValidUuidOrNull(params.householdId);
      if (!validHouseholdId) {
        return ok({
          investment_portfolio: 0,
          real_estate: 0,
          loans_liabilities: 0,
          transactions: 0,
          financial_goals: 0,
          documents_vault: 0,
          cas_import_history: 0,
          linked_home_loans: 0,
          linked_goal_holdings: 0,
        });
      }

      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        'get_household_data_reset_preview',
        { p_household_id: validHouseholdId }
      );

      if (!rpcErr && rpcData && typeof rpcData === 'object') {
        const raw = rpcData as Record<string, unknown>;
        return ok({
          investment_portfolio: Number(raw.investment_portfolio || 0),
          real_estate: Number(raw.real_estate || 0),
          loans_liabilities: Number(raw.loans_liabilities || 0),
          transactions: Number(raw.transactions || 0),
          financial_goals: Number(raw.financial_goals || 0),
          documents_vault: Number(raw.documents_vault || 0),
          cas_import_history: Number(raw.cas_import_history || 0),
          linked_home_loans: Number(raw.linked_home_loans || 0),
          linked_goal_holdings: Number(raw.linked_goal_holdings || 0),
        });
      }

      // Fallback count query if migration 26 has not been applied yet on local DB
      const [holdingsRes, liabilitiesRes, txRes, goalsRes, docsRes, batchesRes] =
        await Promise.all([
          supabase
            .from('holdings')
            .select('id, assets!inner(asset_class_id)')
            .eq('household_id', validHouseholdId),
          supabase
            .from('liabilities')
            .select('id, linked_asset_id')
            .eq('household_id', validHouseholdId),
          supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('household_id', validHouseholdId),
          supabase
            .from('goals')
            .select('id', { count: 'exact', head: true })
            .eq('household_id', validHouseholdId),
          supabase
            .from('family_documents')
            .select('id', { count: 'exact', head: true })
            .eq('household_id', validHouseholdId),
          supabase
            .from('import_batches')
            .select('id', { count: 'exact', head: true })
            .eq('household_id', validHouseholdId),
        ]);

      const holdingRows = (holdingsRes.data || []) as unknown as Array<{
        id: string;
        assets: { asset_class_id: string } | Array<{ asset_class_id: string }> | null;
      }>;
      let investmentCount = 0;
      let realEstateCount = 0;
      for (const h of holdingRows) {
        const assetObj = Array.isArray(h.assets) ? h.assets[0] : h.assets;
        if (assetObj?.asset_class_id === 'real_estate') {
          realEstateCount++;
        } else {
          investmentCount++;
        }
      }

      const liabilityRows = (liabilitiesRes.data || []) as Array<{
        id: string;
        linked_asset_id: string | null;
      }>;

      return ok({
        investment_portfolio: investmentCount,
        real_estate: realEstateCount,
        loans_liabilities: liabilityRows.length,
        transactions: txRes.count ?? 0,
        financial_goals: goalsRes.count ?? 0,
        documents_vault: docsRes.count ?? 0,
        cas_import_history: batchesRes.count ?? 0,
        linked_home_loans: liabilityRows.filter((l) => Boolean(l.linked_asset_id)).length,
        linked_goal_holdings: 0,
      });
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to load data reset preview'));
    }
  }

  async resetHouseholdFinancialData(params: {
    readonly householdId?: string;
    readonly userId?: string;
    readonly categories: readonly ResettableFinancialCategory[];
  }): Promise<Result<HouseholdDataResetResult>> {
    try {
      if (params.categories.length === 0) {
        return err(new Error('Please select at least one category to reset.'));
      }

      const householdId = await resolveHouseholdIdForWrite(params.householdId, params.userId);

      // 1. If documents_vault is selected, clean up storage objects in 'family-vault' first
      if (params.categories.includes('documents_vault')) {
        const { data: docs } = await supabase
          .from('family_documents')
          .select('storage_path')
          .eq('household_id', householdId);
        const paths = (docs || [])
          .map((d: { storage_path: string | null }) => d.storage_path)
          .filter((p): p is string => Boolean(p));
        if (paths.length > 0) {
          await supabase.storage.from(VAULT_BUCKET).remove(paths);
        }
      }

      // 2. Execute atomic server-side RPC (enforces primary_owner + audit log)
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        'reset_household_financial_data_atomic',
        {
          p_household_id: householdId,
          p_categories: [...params.categories],
        }
      );

      if (!rpcErr && rpcData && typeof rpcData === 'object') {
        const raw = rpcData as {
          audit_log_id?: string;
          deleted_counts?: Partial<Record<ResettableFinancialCategory, number>>;
        };
        const counts = raw.deleted_counts || {};
        return ok({
          auditLogId: raw.audit_log_id,
          deletedCounts: {
            investment_portfolio: Number(counts.investment_portfolio || 0),
            real_estate: Number(counts.real_estate || 0),
            loans_liabilities: Number(counts.loans_liabilities || 0),
            transactions: Number(counts.transactions || 0),
            financial_goals: Number(counts.financial_goals || 0),
            documents_vault: Number(counts.documents_vault || 0),
            cas_import_history: Number(counts.cas_import_history || 0),
          },
        });
      }

      // If the RPC failed due to authorization, surface that error immediately
      if (rpcErr && (rpcErr.code === '42501' || /permission denied/i.test(rpcErr.message))) {
        return err(new Error(rpcErr.message));
      }

      // 3. Fallback dependency-ordered deletion if migration 26 RPC is not yet loaded in local DB
      const actorId = toValidUuidOrNull(params.userId);
      if (actorId) {
        const { data: roleRow } = await supabase
          .from('household_members')
          .select('household_role, status')
          .eq('household_id', householdId)
          .eq('user_id', actorId)
          .maybeSingle();
        if (!roleRow || roleRow.status !== 'active' || roleRow.household_role !== 'primary_owner') {
          return err(
            new Error(
              'Permission denied. Only the household primary owner can reset household financial data.'
            )
          );
        }
      }

      const deletedCounts: Record<ResettableFinancialCategory, number> = {
        investment_portfolio: 0,
        real_estate: 0,
        loans_liabilities: 0,
        transactions: 0,
        financial_goals: 0,
        documents_vault: 0,
        cas_import_history: 0,
      };

      const cats = new Set(params.categories);

      if (cats.has('financial_goals')) {
        const { data: gRows } = await supabase
          .from('goals')
          .select('id')
          .eq('household_id', householdId);
        const gIds = (gRows || []).map((g: { id: string }) => g.id);
        if (gIds.length > 0) {
          await supabase.from('goal_holding_allocations').delete().in('goal_id', gIds);
          await supabase.from('goals').delete().in('id', gIds);
          deletedCounts.financial_goals = gIds.length;
        }
      }

      if (cats.has('loans_liabilities')) {
        await supabase.from('loan_payments').delete().eq('household_id', householdId);
        await supabase.from('liability_balances').delete().eq('household_id', householdId);
        await supabase.from('asset_liability_links').delete().eq('household_id', householdId);
        await supabase.from('liability_parties').delete().eq('household_id', householdId);
        const { data: lRows } = await supabase
          .from('liabilities')
          .delete()
          .eq('household_id', householdId)
          .select('id');
        deletedCounts.loans_liabilities = (lRows || []).length;
      }

      if (cats.has('transactions')) {
        const { data: tRows } = await supabase
          .from('transactions')
          .delete()
          .eq('household_id', householdId)
          .select('id');
        deletedCounts.transactions = (tRows || []).length;
      }

      if (cats.has('real_estate') || cats.has('investment_portfolio')) {
        const { data: hRows } = await supabase
          .from('holdings')
          .select('id, asset_id, assets!inner(asset_class_id)')
          .eq('household_id', householdId);

        const parsedHoldings = (hRows || []) as unknown as Array<{
          id: string;
          asset_id: string;
          assets: { asset_class_id: string } | Array<{ asset_class_id: string }> | null;
        }>;

        const reHoldingIds: string[] = [];
        const reAssetIds: string[] = [];
        const invHoldingIds: string[] = [];
        const invAssetIds: string[] = [];

        for (const h of parsedHoldings) {
          const assetObj = Array.isArray(h.assets) ? h.assets[0] : h.assets;
          if (assetObj?.asset_class_id === 'real_estate') {
            reHoldingIds.push(h.id);
            reAssetIds.push(h.asset_id);
          } else {
            invHoldingIds.push(h.id);
            invAssetIds.push(h.asset_id);
          }
        }

        if (cats.has('real_estate') && reHoldingIds.length > 0) {
          await supabase
            .from('liabilities')
            .update({ linked_asset_id: null })
            .eq('household_id', householdId)
            .in('linked_asset_id', reAssetIds);
          await supabase.from('holding_owners').delete().in('holding_id', reHoldingIds);
          await supabase.from('holdings').delete().in('id', reHoldingIds);
          deletedCounts.real_estate = reHoldingIds.length;
        }

        if (cats.has('investment_portfolio') && invHoldingIds.length > 0) {
          await supabase
            .from('liabilities')
            .update({ linked_asset_id: null })
            .eq('household_id', householdId)
            .in('linked_asset_id', invAssetIds);
          await supabase.from('holding_owners').delete().in('holding_id', invHoldingIds);
          await supabase.from('holdings').delete().in('id', invHoldingIds);
          deletedCounts.investment_portfolio = invHoldingIds.length;
        }
      }

      if (cats.has('documents_vault')) {
        const { data: dRows } = await supabase
          .from('family_documents')
          .delete()
          .eq('household_id', householdId)
          .select('id');
        deletedCounts.documents_vault = (dRows || []).length;
      }

      if (cats.has('cas_import_history')) {
        const { data: bRows } = await supabase
          .from('import_batches')
          .delete()
          .eq('household_id', householdId)
          .select('id');
        deletedCounts.cas_import_history = (bRows || []).length;
      }

      return ok({
        deletedCounts,
      });
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to reset household financial data'));
    }
  }

  async deleteHousehold(params: {
    readonly householdId: string;
    readonly userId?: string;
  }): Promise<Result<HouseholdDeletionResult>> {
    try {
      const validHouseholdId = toValidUuidOrNull(params.householdId);
      if (!validHouseholdId) {
        return err(new Error('Valid household ID is required to delete a household.'));
      }

      // Clean up storage objects in 'family-vault' first
      const { data: docs } = await supabase
        .from('family_documents')
        .select('storage_path')
        .eq('household_id', validHouseholdId);
      const paths = (docs || [])
        .map((d: { storage_path: string | null }) => d.storage_path)
        .filter((p): p is string => Boolean(p));
      if (paths.length > 0) {
        await supabase.storage.from(VAULT_BUCKET).remove(paths);
      }

      const { data: rpcData, error: rpcErr } = await supabase.rpc('delete_household_atomic', {
        p_household_id: validHouseholdId,
      });

      if (rpcErr) {
        return err(new Error(rpcErr.message));
      }

      const raw = (rpcData || {}) as {
        deleted_household_id?: string;
        deleted_household_name?: string;
        audit_log_id?: string;
      };

      return ok({
        deletedHouseholdId: raw.deleted_household_id || validHouseholdId,
        deletedHouseholdName: raw.deleted_household_name,
        auditLogId: raw.audit_log_id,
      });
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to delete household'));
    }
  }
}
