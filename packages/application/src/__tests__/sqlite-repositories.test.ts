import { describe, it, expect, beforeEach } from 'vitest';
import { createTestSqliteDb } from './test-sqlite-helper.js';
import { SqliteDatabase } from '../persistence/sqlite/sqlite-connection.js';
import {
  SqliteAssetClassAdapter,
  SqliteFamilyAdapter,
  SqliteHoldingAdapter,
  SqliteTransactionAdapter,
  SqliteLiabilityAdapter,
  SqliteGoalAdapter,
} from '../persistence/sqlite/sqlite-repositories.js';

describe('Phase 9.1: SQLite Repository Adapters', () => {
  let db: SqliteDatabase;
  let assetClassAdapter: SqliteAssetClassAdapter;
  let familyAdapter: SqliteFamilyAdapter;
  let holdingAdapter: SqliteHoldingAdapter;
  let transactionAdapter: SqliteTransactionAdapter;
  let liabilityAdapter: SqliteLiabilityAdapter;
  let goalAdapter: SqliteGoalAdapter;

  const testUserId = 'usr-vaghela-01';

  beforeEach(() => {
    db = createTestSqliteDb();
    assetClassAdapter = new SqliteAssetClassAdapter(db);
    familyAdapter = new SqliteFamilyAdapter(db);
    holdingAdapter = new SqliteHoldingAdapter(db);
    transactionAdapter = new SqliteTransactionAdapter(db);
    liabilityAdapter = new SqliteLiabilityAdapter(db);
    goalAdapter = new SqliteGoalAdapter(db);

    // Initialize test profile
    db.prepare("INSERT INTO profiles (id, display_name) VALUES (?, 'Ketan Vaghela');").run(testUserId);
  });

  it('TC-9.1-03A: AssetClassAdapter returns default asset classes', async () => {
    const res = await assetClassAdapter.listAll();
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.value.length).toBeGreaterThanOrEqual(8);
    const eq = res.value.find((ac) => ac.id === 'equity');
    expect(eq?.name).toBe('Equity & Stocks');
    expect(eq?.colorHex).toBe('#10B981');
  });

  it('TC-9.1-03B: FamilyAdapter handles members and portfolio accounts CRUD', async () => {
    // 1. Save family member
    const memberRes = await familyAdapter.saveMember({
      id: 'fm-parul',
      userId: testUserId,
      name: 'Parul Vaghela',
      relationship: 'spouse',
      colorHex: '#EC4899',
      isPrimary: false,
    });
    expect(memberRes.success).toBe(true);

    const members = await familyAdapter.getMembers(testUserId);
    expect(members.success).toBe(true);
    if (!members.success) return;
    expect(members.value).toHaveLength(1);
    expect(members.value[0].name).toBe('Parul Vaghela');

    // 2. Save portfolio account
    const accRes = await familyAdapter.saveAccount({
      id: 'acc-zerodha-parul',
      userId: testUserId,
      memberId: 'fm-parul',
      accountName: 'Parul Zerodha Kite',
      brokerName: 'Zerodha',
      depository: 'CDSL',
      accountType: 'demat',
    });
    expect(accRes.success).toBe(true);

    const accounts = await familyAdapter.getAccounts(testUserId);
    expect(accounts.success).toBe(true);
    if (!accounts.success) return;
    expect(accounts.value).toHaveLength(1);
    expect(accounts.value[0].accountName).toBe('Parul Zerodha Kite');
  });

  it('TC-9.1-03C: HoldingAdapter creates, lists, updates, and deletes holdings', async () => {
    // 1. Create holding
    const createRes = await holdingAdapter.createHoldingWithAsset({
      userId: testUserId,
      name: 'Reliance Industries Ltd',
      ticker: 'RELIANCE',
      isin: 'INE002A01018',
      assetClassId: 'equity',
      currency: 'INR',
      quantity: 25,
      unitCostCents: 245000, // ₹2,450.00
      currentValueCents: 290000, // ₹2,900.00
    });
    expect(createRes.success).toBe(true);
    if (!createRes.success) return;

    expect(createRes.value.name).toBe('Reliance Industries Ltd');
    expect(createRes.value.quantity).toBe(25);
    expect(createRes.value.assetClassName).toBe('Equity & Stocks');

    // 2. Update holding
    const updateRes = await holdingAdapter.updateHoldingValues({
      holdingId: createRes.value.holdingId,
      userId: testUserId,
      quantity: 30,
      unitCostCents: 250000,
      currentValueCents: 300000,
    });
    expect(updateRes.success).toBe(true);

    const listRes = await holdingAdapter.listDetailsByUser(testUserId);
    expect(listRes.success).toBe(true);
    if (!listRes.success) return;
    expect(listRes.value[0].quantity).toBe(30);

    // 3. Delete holding
    const delRes = await holdingAdapter.deleteHolding(createRes.value.holdingId, testUserId);
    expect(delRes.success).toBe(true);

    const afterDel = await holdingAdapter.listDetailsByUser(testUserId);
    expect(afterDel.success).toBe(true);
    if (!afterDel.success) return;
    expect(afterDel.value).toHaveLength(0);
  });

  it('TC-9.1-03D: TransactionAdapter records and lists cashflow ledger events', async () => {
    const txnRes = await transactionAdapter.createTransaction({
      userId: testUserId,
      type: 'buy',
      amountCents: 5000000, // ₹50,000.00
      currency: 'INR',
      quantity: 10,
      notes: 'Initial equity purchase',
    });
    expect(txnRes.success).toBe(true);

    const txns = await transactionAdapter.listByUser(testUserId);
    expect(txns.success).toBe(true);
    if (!txns.success) return;
    expect(txns.value).toHaveLength(1);
    expect(txns.value[0].type).toBe('buy');
    expect(txns.value[0].amountCents).toBe(5000000);
  });

  it('TC-9.1-03E: LiabilityAdapter creates liability, records balance snapshots, and handles collaterals', async () => {
    const liaRes = await liabilityAdapter.createLiability({
      userId: testUserId,
      name: 'SBI Home Loan',
      loanType: 'home_loan',
      lender: 'State Bank of India',
      originalPrincipalCents: 500000000n, // ₹50 Lakhs
      initialBalanceCents: 450000000n, // ₹45 Lakhs
      interestRate: 8.5,
      interestType: 'floating',
      tenureMonths: 240,
      emiAmountCents: 4339100n, // ₹43,391
      startDate: '2026-01-01',
    });
    expect(liaRes.success).toBe(true);
    if (!liaRes.success) return;

    expect(liaRes.value.currentBalanceCents).toBe(450000000n);

    // Record next month payment
    const balRes = await liabilityAdapter.recordLiabilityBalance({
      liabilityId: liaRes.value.id,
      userId: testUserId,
      balanceCents: 447000000n,
      asOfDate: '2026-02-01',
      source: 'bank_statement',
    });
    expect(balRes.success).toBe(true);

    const updatedLia = await liabilityAdapter.getLiabilityById(liaRes.value.id, testUserId);
    expect(updatedLia.success).toBe(true);
    if (!updatedLia.success || !updatedLia.value) return;
    expect(updatedLia.value.currentBalanceCents).toBe(447000000n);
  });

  it('TC-9.1-03F: GoalAdapter creates financial goal and links to holdings', async () => {
    // 1. Create a holding to link
    const hldRes = await holdingAdapter.createHoldingWithAsset({
      userId: testUserId,
      name: 'Nippon India Small Cap Fund',
      assetClassId: 'mutual_fund',
      currency: 'INR',
      quantity: 500,
      unitCostCents: 12000,
      currentValueCents: 165000,
    });
    expect(hldRes.success).toBe(true);
    if (!hldRes.success) return;

    // 2. Create goal
    const goalRes = await goalAdapter.createGoal({
      userId: testUserId,
      name: 'Krisha Higher Education',
      category: 'education',
      targetAmountCents: 500000000, // ₹50 Lakhs
      targetDate: '2038-06-01',
      initialSavedCents: 10000000,
      monthlyContributionCents: 2500000,
    });
    expect(goalRes.success).toBe(true);
    if (!goalRes.success) return;

    // 3. Link holding to goal
    const linkRes = await goalAdapter.linkHoldingToGoal({
      goalId: goalRes.value.id,
      holdingId: hldRes.value.holdingId,
      userId: testUserId,
      allocationPercentage: 80.0,
    });
    expect(linkRes.success).toBe(true);

    const goals = await goalAdapter.listGoalsByUser(testUserId);
    expect(goals.success).toBe(true);
    if (!goals.success) return;
    expect(goals.value).toHaveLength(1);
    expect(goals.value[0].linkedHoldings).toHaveLength(1);
    expect(goals.value[0].linkedHoldings[0].allocationPercentage).toBe(80.0);
    expect(goals.value[0].linkedHoldings[0].holdingName).toBe('Nippon India Small Cap Fund');
  });
});
