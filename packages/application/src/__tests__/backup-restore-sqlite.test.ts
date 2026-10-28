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

describe('Phase 9.1: SQLite Atomic Backup & Restore Round-Trip', () => {
  let db: SqliteDatabase;
  let holdingAdapter: SqliteHoldingAdapter;
  let transactionAdapter: SqliteTransactionAdapter;
  let liabilityAdapter: SqliteLiabilityAdapter;
  let goalAdapter: SqliteGoalAdapter;
  let backupAdapter: SqliteBackupAdapter;

  const testUserId = 'usr-ketan-vaghela';

  beforeEach(() => {
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
  });

  it('TC-9.1-04: performs full export -> wipe -> restore with zero data drift', async () => {
    // 1. Seed holdings
    await holdingAdapter.createHoldingWithAsset({
      userId: testUserId,
      name: 'TCS Ltd',
      ticker: 'TCS',
      assetClassId: 'equity',
      currency: 'INR',
      quantity: 50,
      unitCostCents: 350000, // ₹3,500.00
      currentValueCents: 38000000, // ₹3,80,000.00
    });

    // 2. Seed transactions
    await transactionAdapter.createTransaction({
      userId: testUserId,
      type: 'buy',
      amountCents: 17500000, // ₹1,75,000.00
      currency: 'INR',
      quantity: 50,
      notes: 'Initial buy',
    });

    // 3. Seed liabilities
    await liabilityAdapter.createLiability({
      userId: testUserId,
      name: 'Car Loan',
      loanType: 'vehicle_loan',
      lender: 'HDFC Bank',
      originalPrincipalCents: 80000000n, // ₹8,00,000
      initialBalanceCents: 65000000n, // ₹6,50,000
      interestRate: 9.0,
      tenureMonths: 60,
      emiAmountCents: 1660700n,
    });

    // 4. Seed goals
    await goalAdapter.createGoal({
      userId: testUserId,
      name: 'Retirement Corpus',
      category: 'retirement',
      targetAmountCents: 1000000000, // ₹10 Crores
      targetDate: '2045-01-01',
      initialSavedCents: 50000000,
      monthlyContributionCents: 10000000,
    });

    // 5. Export backup
    const exportRes = await backupAdapter.createFullBackup(testUserId);
    expect(exportRes.success).toBe(true);
    if (!exportRes.success) return;

    const backupData = exportRes.value;
    expect(backupData.metrics.totalHoldings).toBe(1);
    expect(backupData.metrics.totalTransactions).toBe(1);
    expect(backupData.metrics.totalLiabilities).toBe(1);
    expect(backupData.metrics.totalGoals).toBe(1);

    // 6. Wipe database tables
    db.prepare('DELETE FROM goal_holdings;').run();
    db.prepare('DELETE FROM financial_goals;').run();
    db.prepare('DELETE FROM liability_balances;').run();
    db.prepare('DELETE FROM liabilities;').run();
    db.prepare('DELETE FROM transactions;').run();
    db.prepare('DELETE FROM holdings;').run();
    db.prepare('DELETE FROM assets;').run();

    // Verify wiped
    const wipedHoldings = await holdingAdapter.listDetailsByUser(testUserId);
    expect(wipedHoldings.success).toBe(true);
    if (!wipedHoldings.success) return;
    expect(wipedHoldings.value).toHaveLength(0);

    // 7. Restore from backup
    const restoreRes = await backupAdapter.restoreFromBackup(testUserId, backupData);
    expect(restoreRes.success).toBe(true);
    if (!restoreRes.success) return;

    expect(restoreRes.value.restoredHoldings).toBe(1);
    expect(restoreRes.value.restoredTransactions).toBe(1);
    expect(restoreRes.value.restoredLiabilities).toBe(1);
    expect(restoreRes.value.restoredGoals).toBe(1);

    // 8. Verify restored state
    const restoredHoldings = await holdingAdapter.listDetailsByUser(testUserId);
    expect(restoredHoldings.success).toBe(true);
    if (!restoredHoldings.success) return;
    expect(restoredHoldings.value).toHaveLength(1);
    expect(restoredHoldings.value[0].name).toBe('TCS Ltd');
    expect(restoredHoldings.value[0].currentValueCents).toBe(38000000);

    const restoredLiabilities = await liabilityAdapter.listLiabilitiesByUser(testUserId);
    expect(restoredLiabilities.success).toBe(true);
    if (!restoredLiabilities.success) return;
    expect(restoredLiabilities.value).toHaveLength(1);
    expect(restoredLiabilities.value[0].currentBalanceCents).toBe(65000000n);

    const restoredGoals = await goalAdapter.listGoalsByUser(testUserId);
    expect(restoredGoals.success).toBe(true);
    if (!restoredGoals.success) return;
    expect(restoredGoals.value).toHaveLength(1);
    expect(restoredGoals.value[0].name).toBe('Retirement Corpus');
  });
});
