import { Result, ok, err } from '@wealthnest/shared';
import { SqliteDatabase } from './sqlite-connection.js';
import {
  BackupPort,
  HouseholdDataResetPreview,
  HouseholdDataResetResult,
  HouseholdDeletionResult,
  PortfolioBackupData,
  ResettableFinancialCategory,
} from '../../ports/backup.port.js';
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

  async createFullBackup(scopeId: string): Promise<Result<PortfolioBackupData>> {
    try {
      const hhRow = this.db
        .prepare<{ id: string; name: string }>('SELECT id, name FROM households WHERE id = ?;')
        .get(scopeId);

      const isHousehold = Boolean(hhRow);
      const [holdingsRes, transactionsRes, liabilitiesRes, goalsRes] = await Promise.all([
        isHousehold
          ? this.holdingAdapter.listDetailsByHousehold(scopeId)
          : this.holdingAdapter.listDetailsByUser(scopeId),
        isHousehold
          ? this.transactionAdapter.listByHousehold(scopeId)
          : this.transactionAdapter.listByUser(scopeId),
        isHousehold
          ? this.liabilityAdapter.listLiabilitiesByHousehold(scopeId)
          : this.liabilityAdapter.listLiabilitiesByUser(scopeId),
        isHousehold
          ? this.goalAdapter.listGoalsByHousehold(scopeId)
          : this.goalAdapter.listGoalsByUser(scopeId),
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
          id: scopeId,
          email: `${scopeId}@wealthnest.local`,
          displayName: hhRow?.name || 'Investor',
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
      const userId = options?.targetUserId ?? scopeId;
      const hhMatch = this.db
        .prepare<{ id: string }>('SELECT id FROM households WHERE id = ?;')
        .get(options?.householdId ?? scopeId);
      const householdId = options?.householdId ?? hhMatch?.id ?? null;

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

        if (householdId) {
          this.db
            .prepare('INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, ?, ?);')
            .run(householdId, 'Restored Household', userId);
        }

        // Restore Holdings & Assets
        let restoredHoldings = 0;
        for (const h of backup.holdings) {
          const assetId = h.assetId || generateId('ast');
          const visibility = h.visibility ?? 'household_shared';
          this.db
            .prepare(
              `INSERT INTO assets (id, user_id, name, ticker, isin, asset_class_id, currency, household_id, visibility, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              h.currency || 'INR',
              householdId,
              visibility,
              userId
            );

          const holdingId = h.holdingId || generateId('hld');
          this.db
            .prepare(
              `INSERT INTO holdings (
                 id, user_id, asset_id, quantity, unit_cost_paise, current_value_paise,
                 member_id, account_id, demat_account_id, folio_number, amc_name, scheme_plan, cost_basis_verified,
                 household_id, visibility, created_by
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              h.costBasisVerified ? 1 : 0,
              householdId,
              visibility,
              userId
            );
          restoredHoldings++;
        }

        // Restore Transactions
        let restoredTransactions = 0;
        for (const t of backup.transactions) {
          const txnId = t.id || generateId('txn');
          const visibility = t.visibility ?? 'household_shared';
          this.db
            .prepare(
              `INSERT INTO transactions (id, user_id, asset_id, type, quantity, amount_paise, currency, transaction_date, notes, member_id, account_id, destination_account_id, household_id, visibility, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              t.accountId ?? null,
              t.destinationAccountId ?? null,
              householdId,
              visibility,
              userId
            );
          restoredTransactions++;
        }

        // Restore Liabilities
        let restoredLiabilities = 0;
        for (const l of backup.liabilities) {
          const liaId = l.id || generateId('lia');
          const visibility = l.visibility ?? 'household_shared';
          this.db
            .prepare(
              `INSERT INTO liabilities (
                 id, user_id, name, loan_type, lender, account_number, original_principal_paise,
                 interest_rate, interest_type, tenure_months, emi_amount_paise, currency,
                 start_date, end_date, status, linked_asset_id, member_id, notes,
                 household_id, visibility, created_by
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              l.notes ?? null,
              householdId,
              visibility,
              userId
            );

          // Add balance snapshot
          const balId = generateId('lbal');
          this.db
            .prepare(
              `INSERT INTO liability_balances (id, user_id, liability_id, balance_paise, as_of_date, source, notes, household_id, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(liability_id, as_of_date) DO UPDATE SET balance_paise = excluded.balance_paise;`
            )
            .run(
              balId,
              userId,
              liaId,
              Number(l.currentBalanceCents ?? l.originalPrincipalCents),
              l.lastBalanceDate || new Date().toISOString().slice(0, 10),
              'restore',
              null,
              householdId,
              userId
            );
          restoredLiabilities++;
        }

        // Restore Goals
        let restoredGoals = 0;
        for (const g of backup.goals) {
          const golId = g.id || generateId('gol');
          const visibility = g.visibility ?? 'household_shared';
          this.db
            .prepare(
              `INSERT INTO financial_goals (
                 id, user_id, name, category, target_amount_paise, target_date,
                 initial_saved_paise, monthly_contribution_paise, expected_return_rate,
                 inflation_rate, priority, currency, notes, member_id,
                 household_id, visibility, created_by
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              g.memberId ?? null,
              householdId,
              visibility,
              userId
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

  async getDataResetPreview(params: {
    readonly householdId?: string;
    readonly userId?: string;
  }): Promise<Result<HouseholdDataResetPreview>> {
    try {
      const scopeId = params.householdId || params.userId || '';
      const isHousehold = Boolean(
        params.householdId &&
          this.db
            .prepare<{ id: string }>('SELECT id FROM households WHERE id = ?;')
            .get(params.householdId)
      );

      const [holdingsRes, transactionsRes, liabilitiesRes, goalsRes] = await Promise.all([
        isHousehold
          ? this.holdingAdapter.listDetailsByHousehold(scopeId)
          : this.holdingAdapter.listDetailsByUser(scopeId),
        isHousehold
          ? this.transactionAdapter.listByHousehold(scopeId)
          : this.transactionAdapter.listByUser(scopeId),
        isHousehold
          ? this.liabilityAdapter.listLiabilitiesByHousehold(scopeId)
          : this.liabilityAdapter.listLiabilitiesByUser(scopeId),
        isHousehold
          ? this.goalAdapter.listGoalsByHousehold(scopeId)
          : this.goalAdapter.listGoalsByUser(scopeId),
      ]);

      const holdings = holdingsRes.success ? holdingsRes.value : [];
      const transactions = transactionsRes.success ? transactionsRes.value : [];
      const liabilities = liabilitiesRes.success ? liabilitiesRes.value : [];
      const goals = goalsRes.success ? goalsRes.value : [];
      const docs = this.db
        .prepare<{ id: string }>(
          isHousehold
            ? 'SELECT id FROM family_documents WHERE household_id = ?;'
            : 'SELECT id FROM family_documents WHERE user_id = ?;'
        )
        .all(scopeId);

      const realEstateCount = holdings.filter((h) => h.assetClassId === 'real_estate').length;
      const investmentCount = holdings.length - realEstateCount;
      const linkedHomeLoans = liabilities.filter((l) => Boolean(l.linkedAssetId)).length;
      const linkedGoalHoldings = goals.reduce((acc, g) => acc + (g.linkedHoldings?.length || 0), 0);

      return ok({
        investment_portfolio: investmentCount,
        real_estate: realEstateCount,
        loans_liabilities: liabilities.length,
        transactions: transactions.length,
        financial_goals: goals.length,
        documents_vault: docs.length,
        cas_import_history: 0,
        linked_home_loans: linkedHomeLoans,
        linked_goal_holdings: linkedGoalHoldings,
      });
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
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

      const scopeId = params.householdId || params.userId || '';
      const userId = params.userId || scopeId;
      const householdId = params.householdId || scopeId;
      const isHousehold = Boolean(
        params.householdId &&
          this.db
            .prepare<{ id: string }>('SELECT id FROM households WHERE id = ?;')
            .get(params.householdId)
      );

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
      this.db.exec('BEGIN IMMEDIATE TRANSACTION;');

      try {
        if (cats.has('financial_goals')) {
          const goalsRes = await (isHousehold
            ? this.goalAdapter.listGoalsByHousehold(scopeId)
            : this.goalAdapter.listGoalsByUser(scopeId));
          if (goalsRes.success) {
            for (const g of goalsRes.value) {
              for (const lh of g.linkedHoldings || []) {
                this.db
                  .prepare('DELETE FROM goal_holdings WHERE goal_id = ? AND holding_id = ?;')
                  .run(g.id, lh.holdingId);
              }
              this.db
                .prepare('DELETE FROM financial_goals WHERE id = ?;')
                .run(g.id, userId, householdId);
              deletedCounts.financial_goals++;
            }
          }
        }

        if (cats.has('loans_liabilities')) {
          const liabilitiesRes = await (isHousehold
            ? this.liabilityAdapter.listLiabilitiesByHousehold(scopeId)
            : this.liabilityAdapter.listLiabilitiesByUser(scopeId));
          if (liabilitiesRes.success) {
            for (const l of liabilitiesRes.value) {
              this.db
                .prepare('DELETE FROM liability_parties WHERE liability_id = ?;')
                .run(l.id);
              this.db
                .prepare('DELETE FROM liabilities WHERE id = ?;')
                .run(l.id, userId, householdId);
              deletedCounts.loans_liabilities++;
            }
          }
        }

        if (cats.has('transactions')) {
          const txRes = await (isHousehold
            ? this.transactionAdapter.listByHousehold(scopeId)
            : this.transactionAdapter.listByUser(scopeId));
          if (txRes.success) {
            for (const t of txRes.value) {
              this.db
                .prepare('DELETE FROM transactions WHERE id = ?;')
                .run(t.id, userId, householdId);
              deletedCounts.transactions++;
            }
          }
        }

        if (cats.has('real_estate') || cats.has('investment_portfolio')) {
          const holdingsRes = await (isHousehold
            ? this.holdingAdapter.listDetailsByHousehold(scopeId)
            : this.holdingAdapter.listDetailsByUser(scopeId));
          if (holdingsRes.success) {
            for (const h of holdingsRes.value) {
              const isRealEstate = h.assetClassId === 'real_estate';
              if ((isRealEstate && cats.has('real_estate')) || (!isRealEstate && cats.has('investment_portfolio'))) {
                this.db
                  .prepare('DELETE FROM holding_owners WHERE holding_id = ?;')
                  .run(h.holdingId);
                this.db
                  .prepare('DELETE FROM holdings WHERE id = ?;')
                  .run(h.holdingId, userId, householdId);
                if (isRealEstate) {
                  deletedCounts.real_estate++;
                } else {
                  deletedCounts.investment_portfolio++;
                }
              }
            }
          }
        }

        if (cats.has('documents_vault')) {
          const docs = this.db
            .prepare<{ id: string }>(
              isHousehold
                ? 'SELECT id FROM family_documents WHERE household_id = ?;'
                : 'SELECT id FROM family_documents WHERE user_id = ?;'
            )
            .all(scopeId);
          for (const d of docs) {
            this.db
              .prepare('DELETE FROM family_documents WHERE id = ?;')
              .run(d.id, userId, householdId);
            deletedCounts.documents_vault++;
          }
        }

        const auditLogId = generateId('hal');
        this.db
          .prepare(
            `INSERT INTO household_audit_logs (
               id, household_id, actor_user_id, target_user_id, target_family_member_id, action, metadata_json
             ) VALUES (?, ?, ?, ?, ?, ?, ?);`
          )
          .run(
            auditLogId,
            householdId,
            userId,
            null,
            null,
            'household_financial_data_reset',
            JSON.stringify({
              categories: params.categories,
              deletedCounts,
              executedAt: new Date().toISOString(),
            })
          );

        this.db.exec('COMMIT;');
        return ok({
          auditLogId,
          deletedCounts,
        });
      } catch (innerErr) {
        this.db.exec('ROLLBACK;');
        throw innerErr;
      }
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async deleteHousehold(params: {
    readonly householdId: string;
    readonly userId?: string;
  }): Promise<Result<HouseholdDeletionResult>> {
    try {
      const householdId = params.householdId;
      const userId = params.userId || 'usr-local-vault';

      const hhRow = this.db
        .prepare<{ id: string; name: string }>('SELECT id, name FROM households WHERE id = ?;')
        .get(householdId);
      if (!hhRow) {
        return err(new Error('Household not found.'));
      }

      const resetRes = await this.resetHouseholdFinancialData({
        householdId,
        userId,
        categories: [
          'investment_portfolio',
          'real_estate',
          'loans_liabilities',
          'transactions',
          'financial_goals',
          'documents_vault',
          'cas_import_history',
        ],
      });
      if (!resetRes.success) return resetRes;

      this.db.exec('BEGIN IMMEDIATE TRANSACTION;');
      try {
        const members = this.db
          .prepare<{ id: string }>('SELECT id FROM family_members WHERE household_id = ?;')
          .all(householdId);
        for (const m of members) {
          this.db.prepare('DELETE FROM family_members WHERE id = ?;').run(m.id);
        }

        const accounts = this.db
          .prepare<{ id: string }>('SELECT id FROM portfolio_accounts WHERE household_id = ?;')
          .all(householdId);
        for (const a of accounts) {
          this.db.prepare('DELETE FROM portfolio_accounts WHERE id = ?;').run(a.id);
        }

        this.db
          .prepare('DELETE FROM household_members WHERE household_id = ?;')
          .run(householdId);
        this.db.prepare('DELETE FROM households WHERE id = ?;').run(householdId);

        const auditLogId = generateId('hal');
        this.db
          .prepare(
            `INSERT INTO household_audit_logs (
               id, household_id, actor_user_id, target_user_id, target_family_member_id, action, metadata_json
             ) VALUES (?, ?, ?, ?, ?, ?, ?);`
          )
          .run(
            auditLogId,
            householdId,
            userId,
            null,
            null,
            'household_deleted',
            JSON.stringify({
              householdName: hhRow.name,
              deletedAt: new Date().toISOString(),
            })
          );

        this.db.exec('COMMIT;');
        return ok({
          deletedHouseholdId: householdId,
          deletedHouseholdName: hhRow.name,
          auditLogId,
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
