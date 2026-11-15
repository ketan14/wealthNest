import { Result, ok, err } from '@wealthnest/shared';
import { BackupPort, PortfolioBackupData } from '@wealthnest/application';
import { supabase } from './client';
import { toValidUuidOrNull } from './uuid-utils';
import { resolveHouseholdIdForWrite } from './household-scope';

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
}
