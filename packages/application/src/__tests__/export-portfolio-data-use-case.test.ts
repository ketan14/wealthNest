import { describe, it, expect, vi } from 'vitest';
import { ok } from '@wealthnest/shared';
import { ExportPortfolioDataUseCase } from '../use-cases/export-portfolio-data.js';
import { UserRepositoryPort } from '../ports/user-repository.port.js';
import { HoldingRepositoryPort } from '../ports/holding-repository.port.js';
import { TransactionRepositoryPort } from '../ports/transaction-repository.port.js';
import { LiabilityRepositoryPort } from '../ports/liability-repository.port.js';
import { GoalRepositoryPort } from '../ports/goal-repository.port.js';
import { DEFAULT_USER_PREFERENCES } from '@wealthnest/domain';

describe('ExportPortfolioDataUseCase', () => {
  const mockUserRepo: UserRepositoryPort = {
    getById: vi.fn().mockResolvedValue(
      ok({
        id: 'user-123',
        email: 'investor@wealthnest.in',
        displayName: 'Aarav Sharma',
        defaultCurrency: 'INR',
        preferences: DEFAULT_USER_PREFERENCES,
        createdAt: '2026-01-01T00:00:00Z',
      })
    ),
    save: vi.fn().mockResolvedValue(ok(undefined)),
    updatePreferences: vi.fn().mockResolvedValue(ok({} as any)),
  };

  const mockHoldingRepo: HoldingRepositoryPort = {
    listDetailsByUser: vi.fn().mockResolvedValue(
      ok([
        {
          holdingId: 'h-1',
          assetId: 'a-1',
          name: 'HDFC Bank Ltd',
          ticker: 'HDFCBANK',
          isin: 'INE040A01034',
          assetClassId: 'equity',
          assetClassName: 'Equities & Mutual Funds',
          assetClassColor: '#3b82f6',
          quantity: 100,
          unitCostCents: 150000, // ₹1,500.00
          currentValueCents: 16500000, // ₹1,65,000.00
          currency: 'INR',
          updatedAt: '2026-01-15T00:00:00Z',
        },
      ])
    ),
    createHoldingWithAsset: vi.fn(),
    deleteHolding: vi.fn(),
  };

  const mockTransactionRepo: TransactionRepositoryPort = {
    listByUser: vi.fn().mockResolvedValue(
      ok([
        {
          id: 'tx-1',
          userId: 'user-123',
          type: 'buy',
          assetName: 'HDFC Bank Ltd',
          amountCents: 15000000, // ₹1,50,000.00
          currency: 'INR',
          transactionDate: '2026-01-10T00:00:00Z',
          createdAt: '2026-01-10T00:00:00Z',
        },
      ])
    ),
    createTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
  };

  const mockLiabilityRepo: LiabilityRepositoryPort = {
    listLiabilitiesByUser: vi.fn().mockResolvedValue(
      ok([
        {
          id: 'loan-1',
          userId: 'user-123',
          name: 'SBI Home Loan',
          loanType: 'home_loan',
          lender: 'State Bank of India',
          originalPrincipalCents: 500000000n, // ₹50,00,000
          currentBalanceCents: 420000000n, // ₹42,00,000
          interestRate: 8.5,
          interestType: 'floating',
          emiAmountCents: 4339100n, // ₹43,391
          currency: 'INR',
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ])
    ),
    getLiabilityById: vi.fn(),
    createLiability: vi.fn(),
    updateLiability: vi.fn(),
    deleteLiability: vi.fn(),
    recordLiabilityBalance: vi.fn(),
    listLiabilityBalances: vi.fn(),
    recordAssetValuation: vi.fn(),
    listAssetValuations: vi.fn(),
    linkAssetLiability: vi.fn(),
    unlinkAssetLiability: vi.fn(),
    listAssetLiabilityLinks: vi.fn(),
  };

  const mockGoalRepo: GoalRepositoryPort = {
    listGoalsByUser: vi.fn().mockResolvedValue(
      ok([
        {
          id: 'goal-1',
          userId: 'user-123',
          name: 'Early Retirement Corpus',
          category: 'retirement',
          targetAmountCents: 5000000000, // ₹5,00,00,000 (5 Cr)
          targetDate: '2040-12-31',
          initialSavedCents: 50000000,
          monthlyContributionCents: 10000000,
          expectedReturnRate: 12.0,
          inflationRate: 6.0,
          priority: 'high',
          currency: 'INR',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          linkedHoldings: [],
        },
      ])
    ),
    createGoal: vi.fn(),
    updateGoal: vi.fn(),
    deleteGoal: vi.fn(),
    linkHoldingToGoal: vi.fn(),
    unlinkHoldingFromGoal: vi.fn(),
  };

  it('exports full portfolio backup JSON and structured CSV reports', async () => {
    const useCase = new ExportPortfolioDataUseCase(
      mockUserRepo,
      mockHoldingRepo,
      mockTransactionRepo,
      mockLiabilityRepo,
      mockGoalRepo
    );

    const result = await useCase.execute('user-123');

    expect(result.success).toBe(true);
    if (!result.success) return;

    const data = result.value;
    expect(data.backupJson.schema).toBe('wealthnest-portfolio-v1');
    expect(data.backupJson.version).toBe('1.0.0');
    expect(data.backupJson.user.email).toBe('investor@wealthnest.in');

    // Metrics checks
    expect(data.backupJson.metrics.totalHoldings).toBe(1);
    expect(data.backupJson.metrics.totalTransactions).toBe(1);
    expect(data.backupJson.metrics.totalLiabilities).toBe(1);
    expect(data.backupJson.metrics.totalGoals).toBe(1);
    expect(data.backupJson.metrics.totalAssetsCents).toBe(16500000);
    expect(data.backupJson.metrics.totalLiabilitiesCents).toBe(420000000);
    expect(data.backupJson.metrics.netWorthCents).toBe(16500000 - 420000000);

    // CSV tests
    expect(data.holdingsCsv).toContain('Holding ID,Asset Name,Ticker');
    expect(data.holdingsCsv).toContain('HDFC Bank Ltd');
    expect(data.holdingsCsv).toContain('165000.00');

    expect(data.transactionsCsv).toContain('Transaction ID,Date,Type');
    expect(data.transactionsCsv).toContain('buy');
    expect(data.transactionsCsv).toContain('150000.00');

    expect(data.liabilitiesCsv).toContain('Liability ID,Loan Name,Loan Type');
    expect(data.liabilitiesCsv).toContain('SBI Home Loan');
    expect(data.liabilitiesCsv).toContain('4200000.00');

    expect(data.goalsCsv).toContain('Goal ID,Goal Name,Category');
    expect(data.goalsCsv).toContain('Early Retirement Corpus');
    expect(data.goalsCsv).toContain('50000000.00');

    expect(data.summaryFilename).toMatch(/wealthnest_portfolio_backup_\d{4}-\d{2}-\d{2}\.json/);
  });
});
