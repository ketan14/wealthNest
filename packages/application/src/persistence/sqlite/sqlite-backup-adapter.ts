import { Result, ok, err } from '@wealthnest/shared';
import { SqliteDatabase } from './sqlite-connection.js';
import { BackupPort, PortfolioBackupData } from '../../ports/backup.port.js';
import { generateId } from './sqlite-utils.js';
import { SqliteHoldingAdapter, SqliteTransactionAdapter } from './sqlite-portfolio-adapters.js';
import { SqliteLiabilityAdapter } from './sqlite-liability-adapter.js';
import { SqliteGoalAdapter } from './sqlite-goal-adapter.js';

export class SqliteBackupAdapter implements BackupPort {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly holdingAdapter: SqliteHoldingAdapter,
    private readonly transactionAdapter: SqliteTransactionAdapter,
    private readonly liabilityAdapter: SqliteLiabilityAdapter,
    private readonly goalAdapter: SqliteGoalAdapter
  ) {}

  async createFullBackup(userId: string): Promise<Result<PortfolioBackupData>> {
    try {
      const [holdingsRes, transactionsRes, liabilitiesRes, goalsRes] = await Promise.all([
        this.holdingAdapter.listDetailsByUser(userId),
        this.transactionAdapter.listByUser(userId),
        this.liabilityAdapter.listLiabilitiesByUser(userId),
        this.goalAdapter.listGoalsByUser(userId),
      ]);

      if (!holdingsRes.success) return holdingsRes;
      if (!transactionsRes.success) return transactionsRes;
      if (!liabilitiesRes.success) return liabilitiesRes;
      if (!goalsRes.success) return goalsRes;

      const holdings = holdingsRes.value;
      const transactions = transactionsRes.value;
      const liabilities = liabilitiesRes.value;
      const goals = goalsRes.value;

      const totalAssetsCents = holdings.reduce((sum, h) => sum + h.currentValueCents, 0);
      const totalLiabilitiesCents = Number(
        liabilities.reduce((sum, l) => sum + l.currentBalanceCents, 0n)
      );
      const netWorthCents = totalAssetsCents - totalLiabilitiesCents;

      const backup: PortfolioBackupData = {
        version: '1.0.0',
        schema: 'wealthnest-portfolio-v1',
        exportedAt: new Date().toISOString(),
        user: {
          id: userId,
          email: `${userId}@wealthnest.local`,
          displayName: 'Investor',
          defaultCurrency: 'INR',
        },
        holdings,
        transactions,
        liabilities,
        goals,
        metrics: {
          totalAssetsCents,
          totalLiabilitiesCents,
          netWorthCents,
          totalHoldings: holdings.length,
          totalTransactions: transactions.length,
          totalLiabilities: liabilities.length,
          totalGoals: goals.length,
        },
      };

      return ok(backup);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
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
      // Begin transaction for atomic restore
      this.db.exec('BEGIN IMMEDIATE TRANSACTION;');

      try {
        // Ensure user profile exists
        this.db
          .prepare(
            `INSERT INTO profiles (id, display_name, default_currency)
             VALUES (?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               display_name = excluded.display_name,
               default_currency = excluded.default_currency;`
          )
          .run(
            userId,
            backup.user.displayName || 'Restored Investor',
            backup.user.defaultCurrency || 'INR'
          );

        // Restore Holdings & Assets
        let restoredHoldings = 0;
        for (const h of backup.holdings) {
          const assetId = h.assetId || generateId('ast');
          this.db
            .prepare(
              `INSERT INTO assets (id, user_id, name, ticker, isin, asset_class_id, currency)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 name = excluded.name,
                 ticker = excluded.ticker,
                 isin = excluded.isin,
                 asset_class_id = excluded.asset_class_id,
                 currency = excluded.currency;`
            )
            .run(
              assetId,
              userId,
              h.name,
              h.ticker ?? null,
              h.isin ?? null,
              h.assetClassId || 'equity',
              h.currency || 'INR'
            );

          const holdingId = h.holdingId || generateId('hld');
          this.db
            .prepare(
              `INSERT INTO holdings (
                 id, user_id, asset_id, quantity, unit_cost_paise, current_value_paise,
                 member_id, account_id, demat_account_id, folio_number, amc_name, scheme_plan, cost_basis_verified
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 quantity = excluded.quantity,
                 unit_cost_paise = excluded.unit_cost_paise,
                 current_value_paise = excluded.current_value_paise;`
            )
            .run(
              holdingId,
              userId,
              assetId,
              h.quantity,
              h.unitCostCents,
              h.currentValueCents,
              h.memberId ?? null,
              h.accountId ?? null,
              h.dematAccountId ?? null,
              h.folioNumber ?? null,
              h.amcName ?? null,
              h.schemePlan ?? null,
              h.costBasisVerified ? 1 : 0
            );
          restoredHoldings++;
        }

        // Restore Transactions
        let restoredTransactions = 0;
        for (const t of backup.transactions) {
          const txnId = t.id || generateId('txn');
          this.db
            .prepare(
              `INSERT INTO transactions (id, user_id, asset_id, type, quantity, amount_paise, currency, transaction_date, notes, member_id, account_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 amount_paise = excluded.amount_paise,
                 notes = excluded.notes;`
            )
            .run(
              txnId,
              userId,
              t.assetId ?? null,
              t.type,
              t.quantity ?? null,
              t.amountCents,
              t.currency || 'INR',
              t.transactionDate,
              t.notes ?? null,
              t.memberId ?? null,
              t.accountId ?? null
            );
          restoredTransactions++;
        }

        // Restore Liabilities
        let restoredLiabilities = 0;
        for (const l of backup.liabilities) {
          const liaId = l.id || generateId('lia');
          this.db
            .prepare(
              `INSERT INTO liabilities (
                 id, user_id, name, loan_type, lender, account_number, original_principal_paise,
                 interest_rate, interest_type, tenure_months, emi_amount_paise, currency,
                 start_date, end_date, status, linked_asset_id, member_id, notes
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 interest_rate = excluded.interest_rate,
                 emi_amount_paise = excluded.emi_amount_paise;`
            )
            .run(
              liaId,
              userId,
              l.name,
              l.loanType,
              l.lender,
              l.accountNumber ?? null,
              Number(l.originalPrincipalCents),
              l.interestRate,
              l.interestType || 'floating',
              l.tenureMonths ?? null,
              Number(l.emiAmountCents ?? 0n),
              l.currency || 'INR',
              l.startDate ?? null,
              l.endDate ?? null,
              l.status || 'active',
              l.linkedAssetId ?? null,
              l.memberId ?? null,
              l.notes ?? null
            );

          // Add balance snapshot
          const balId = generateId('lbal');
          this.db
            .prepare(
              `INSERT INTO liability_balances (id, user_id, liability_id, balance_paise, as_of_date, source)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(liability_id, as_of_date) DO UPDATE SET balance_paise = excluded.balance_paise;`
            )
            .run(
              balId,
              userId,
              liaId,
              Number(l.currentBalanceCents ?? l.originalPrincipalCents),
              l.lastBalanceDate || new Date().toISOString().slice(0, 10),
              'restore'
            );
          restoredLiabilities++;
        }

        // Restore Goals
        let restoredGoals = 0;
        for (const g of backup.goals) {
          const golId = g.id || generateId('gol');
          this.db
            .prepare(
              `INSERT INTO financial_goals (
                 id, user_id, name, category, target_amount_paise, target_date,
                 initial_saved_paise, monthly_contribution_paise, expected_return_rate,
                 inflation_rate, priority, currency, notes, member_id
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 target_amount_paise = excluded.target_amount_paise;`
            )
            .run(
              golId,
              userId,
              g.name,
              g.category,
              g.targetAmountCents,
              g.targetDate,
              g.initialSavedCents ?? 0,
              g.monthlyContributionCents ?? 0,
              g.expectedReturnRate ?? 12.0,
              g.inflationRate ?? 6.0,
              g.priority ?? 'medium',
              g.currency || 'INR',
              g.notes ?? null,
              g.memberId ?? null
            );
          restoredGoals++;
        }

        this.db.exec('COMMIT;');

        return ok({
          restoredHoldings,
          restoredTransactions,
          restoredLiabilities,
          restoredGoals,
        });
      } catch (innerErr) {
        this.db.exec('ROLLBACK;');
        throw innerErr;
      }
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}
