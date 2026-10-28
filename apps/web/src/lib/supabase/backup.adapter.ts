import { Result, ok, err } from '@wealthnest/shared';
import { BackupPort, PortfolioBackupData } from '@wealthnest/application';
import { supabase } from './client';

export class SupabaseBackupAdapter implements BackupPort {
  async createFullBackup(_userId: string): Promise<Result<PortfolioBackupData>> {
    // Delegated to ExportPortfolioDataUseCase for unified logic
    return err(new Error('Use ExportPortfolioDataUseCase for backup generation'));
  }

  async restoreFromBackup(
    userId: string,
    backup: PortfolioBackupData
  ): Promise<
    Result<{
      readonly restoredHoldings: number;
      readonly restoredTransactions: number;
      readonly restoredLiabilities: number;
      readonly restoredGoals: number;
    }>
  > {
    try {
      if (!userId) {
        return err(new Error('User ID is required for restore'));
      }

      let restoredHoldings = 0;
      let restoredTransactions = 0;
      let restoredLiabilities = 0;
      let restoredGoals = 0;

      // 1. Restore Assets and Holdings
      for (const h of backup.holdings) {
        // Ensure parent asset exists
        const { error: assetErr } = await supabase.from('assets').upsert(
          {
            id: h.assetId,
            user_id: userId,
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

        // Upsert holding
        const { error: holdingErr } = await supabase.from('holdings').upsert(
          {
            id: h.holdingId,
            user_id: userId,
            asset_id: h.assetId,
            quantity: h.quantity,
            unit_cost_cents: h.unitCostCents,
            current_value_cents: h.currentValueCents,
            member_id: h.memberId || null,
            account_id: h.accountId || null,
            demat_account_id: h.dematAccountId || null,
            folio_number: h.folioNumber || null,
            amc_name: h.amcName || null,
            scheme_plan: h.schemePlan || null,
            cost_basis_verified: h.costBasisVerified ?? true,
          },
          { onConflict: 'user_id, asset_id' }
        );

        if (holdingErr) {
          return err(new Error(`Failed to restore holding '${h.name}': ${holdingErr.message}`));
        }
        restoredHoldings++;
      }

      // 2. Restore Transactions
      for (const t of backup.transactions) {
        const { error: txErr } = await supabase.from('transactions').upsert(
          {
            id: t.id,
            user_id: userId,
            asset_id: t.assetId || null,
            type: t.type,
            quantity: t.quantity || null,
            amount_cents: t.amountCents,
            currency: t.currency || 'INR',
            transaction_date: t.transactionDate,
            notes: t.notes || null,
            member_id: t.memberId || null,
            account_id: t.accountId || null,
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
            user_id: userId,
            name: l.name,
            loan_type: l.loanType,
            lender: l.lender,
            account_number: l.accountNumber || null,
            original_principal_cents: l.originalPrincipalCents,
            interest_rate: l.interestRate,
            interest_type: l.interestType || 'floating',
            tenure_months: l.tenureMonths || null,
            emi_amount_cents: l.emiAmountCents,
            currency: l.currency || 'INR',
            start_date: l.startDate || null,
            end_date: l.endDate || null,
            status: l.status,
            linked_asset_id: l.linkedAssetId || null,
            notes: l.notes || null,
          },
          { onConflict: 'id' }
        );

        if (libErr) {
          return err(new Error(`Failed to restore liability '${l.name}': ${libErr.message}`));
        }
        restoredLiabilities++;
      }

      // 4. Restore Financial Goals
      for (const g of backup.goals) {
        const { error: goalErr } = await supabase.from('financial_goals').upsert(
          {
            id: g.id,
            user_id: userId,
            name: g.name,
            category: g.category,
            target_amount_cents: g.targetAmountCents,
            target_date: g.targetDate,
            initial_saved_cents: g.initialSavedCents || 0,
            monthly_contribution_cents: g.monthlyContributionCents || 0,
            expected_return_rate: g.expectedReturnRate || 12.0,
            inflation_rate: g.inflationRate || 6.0,
            priority: g.priority || 'medium',
            notes: g.notes || null,
            member_id: g.memberId || null,
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
