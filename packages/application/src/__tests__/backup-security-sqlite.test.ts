import { describe, it, expect, beforeEach } from 'vitest';
import { createTestSqliteDb } from './test-sqlite-helper.js';
import { SqliteDatabase } from '../persistence/sqlite/sqlite-connection.js';
import {
  SqliteHoldingAdapter,
  SqliteTransactionAdapter,
  SqliteLiabilityAdapter,
  SqliteGoalAdapter,
  SqliteBackupAdapter,
} from '../persistence/sqlite/sqlite-repositories.js';
import { PortfolioBackupData } from '../ports/backup.port.js';

describe('Phase 9.1: Malformed Restore & Rollback Safety in SQLite', () => {
  let db: SqliteDatabase;
  let holdingAdapter: SqliteHoldingAdapter;
  let transactionAdapter: SqliteTransactionAdapter;
  let liabilityAdapter: SqliteLiabilityAdapter;
  let goalAdapter: SqliteGoalAdapter;
  let backupAdapter: SqliteBackupAdapter;

  const testUserId = 'usr-ketan-vaghela';

  beforeEach(async () => {
    db = createTestSqliteDb();
    holdingAdapter = new SqliteHoldingAdapter(db);
    transactionAdapter = new SqliteTransactionAdapter(db);
    liabilityAdapter = new SqliteLiabilityAdapter(db);
    goalAdapter = new SqliteGoalAdapter(db);
    backupAdapter = new SqliteBackupAdapter(
      db,
      holdingAdapter,
      transactionAdapter,
      liabilityAdapter,
      goalAdapter
    );

    db.prepare("INSERT INTO profiles (id, display_name) VALUES (?, 'Ketan Vaghela');").run(testUserId);

    // Initial safe portfolio: 100 shares of Infosys at ₹1,500 = ₹1,50,000
    await holdingAdapter.createHoldingWithAsset({
      userId: testUserId,
      name: 'Infosys Ltd',
      ticker: 'INFY',
      assetClassId: 'equity',
      currency: 'INR',
      quantity: 100,
      unitCostCents: 150000,
      currentValueCents: 18000000,
    });
  });

  it('TC-9.1-05: rolls back transaction on constraint violation, leaving pre-existing data intact', async () => {
    // Verify initial state
    const initialHoldings = await holdingAdapter.listDetailsByUser(testUserId);
    expect(initialHoldings.success).toBe(true);
    if (!initialHoldings.success) return;
    expect(initialHoldings.value).toHaveLength(1);
    expect(initialHoldings.value[0].name).toBe('Infosys Ltd');

    // Create a corrupt backup with a liability that violates CHECK constraint (original_principal_paise > 0)
    const corruptBackup: PortfolioBackupData = {
      version: '1.0.0',
      schema: 'wealthnest-portfolio-v1',
      exportedAt: new Date().toISOString(),
      user: {
        id: testUserId,
        email: 'ketan@wealthnest.local',
        defaultCurrency: 'INR',
      },
      holdings: [
        {
          holdingId: 'hld-malformed-new',
          assetId: 'ast-malformed-new',
          name: 'Corrupt Stock Inc',
          assetClassId: 'equity',
          assetClassName: 'Equity',
          assetClassColor: '#10B981',
          quantity: 10,
          unitCostCents: 10000,
          currentValueCents: 10000,
          currency: 'INR',
          updatedAt: new Date().toISOString(),
        },
      ],
      transactions: [],
      liabilities: [
        {
          id: 'lia-corrupt',
          userId: testUserId,
          name: 'Illegal Negative Principal Loan',
          loanType: 'personal_loan',
          lender: 'Bad Bank',
          originalPrincipalCents: -5000000n, // Violates CHECK (original_principal_paise > 0)
          currentBalanceCents: -5000000n,
          interestRate: 12.0,
          interestType: 'fixed',
          emiAmountCents: 0n,
          currency: 'INR',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      goals: [],
      metrics: {
        totalAssetsCents: 10000,
        totalLiabilitiesCents: -5000000,
        netWorthCents: 5010000,
        totalHoldings: 1,
        totalTransactions: 0,
        totalLiabilities: 1,
        totalGoals: 0,
      },
    };

    // Attempt restore — must fail
    const res = await backupAdapter.restoreFromBackup(testUserId, corruptBackup);
    expect(res.success).toBe(false);

    // Verify transaction rollback: Pre-existing Infosys holding remains 100% intact!
    const postRollbackHoldings = await holdingAdapter.listDetailsByUser(testUserId);
    expect(postRollbackHoldings.success).toBe(true);
    if (!postRollbackHoldings.success) return;
    expect(postRollbackHoldings.value).toHaveLength(1);
    expect(postRollbackHoldings.value[0].name).toBe('Infosys Ltd');

    // Confirm that the corrupt holding was NOT committed
    const corruptInDb = db.prepare('SELECT * FROM holdings WHERE id = ?;').get('hld-malformed-new');
    expect(corruptInDb).toBeUndefined();

    // Confirm that no corrupt liability was committed
    const corruptLia = db.prepare('SELECT * FROM liabilities WHERE id = ?;').get('lia-corrupt');
    expect(corruptLia).toBeUndefined();
  });
});
