import { describe, it, expect, vi } from 'vitest';
import { ok } from '@wealthnest/shared';
import {
  CreateLiabilityUseCase,
  UpdateLiabilityUseCase,
  GetNetWorthSummaryUseCase,
  RecordLiabilityBalanceUseCase,
  LiabilityRepositoryPort,
  HoldingRepositoryPort,
  LiabilityDto,
} from '../index.js';

describe('Application Layer — Loans & Liabilities Use Cases', () => {
  const mockLiability: LiabilityDto = {
    id: 'lib-1',
    userId: 'user-123',
    name: 'Home Loan SBI',
    loanType: 'home_loan',
    lender: 'State Bank of India',
    originalPrincipalCents: 500000000n, // 50 Lakhs
    currentBalanceCents: 450000000n, // 45 Lakhs
    interestRate: 8.5,
    interestType: 'floating',
    emiAmountCents: 4500000n, // 45k
    currency: 'INR',
    status: 'active',
    linkedAssetId: 'asset-prop-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('CreateLiabilityUseCase creates liability and records initial balance and asset link', async () => {
    const mockRepo: Partial<LiabilityRepositoryPort> = {
      createLiability: vi.fn().mockResolvedValue(ok(mockLiability)),
      recordLiabilityBalance: vi.fn().mockResolvedValue(ok({ id: 'bal-1' })),
      linkAssetLiability: vi.fn().mockResolvedValue(ok(undefined)),
    };

    const useCase = new CreateLiabilityUseCase(mockRepo as LiabilityRepositoryPort);
    const result = await useCase.execute({
      userId: 'user-123',
      name: 'Home Loan SBI',
      loanType: 'home_loan',
      lender: 'State Bank of India',
      originalPrincipalCents: 500000000n,
      interestRate: 8.5,
      linkedAssetId: 'asset-prop-1',
    });

    expect(result.success).toBe(true);
    expect(mockRepo.createLiability).toHaveBeenCalled();
    expect(mockRepo.recordLiabilityBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        liabilityId: 'lib-1',
        balanceCents: 500000000n,
      })
    );
    expect(mockRepo.linkAssetLiability).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'asset-prop-1',
        liabilityId: 'lib-1',
      })
    );
  });

  it('CreateLiabilityUseCase rejects invalid inputs', async () => {
    const mockRepo: Partial<LiabilityRepositoryPort> = {
      createLiability: vi.fn(),
    };

    const useCase = new CreateLiabilityUseCase(mockRepo as LiabilityRepositoryPort);
    const zeroPrincipal = await useCase.execute({
      userId: 'user-123',
      name: 'Bad Loan',
      loanType: 'personal_loan',
      lender: 'Bank',
      originalPrincipalCents: 0n,
      interestRate: 10,
    });
    expect(zeroPrincipal.success).toBe(false);

    const negativeInterest = await useCase.execute({
      userId: 'user-123',
      name: 'Bad Loan',
      loanType: 'personal_loan',
      lender: 'Bank',
      originalPrincipalCents: 100000n,
      interestRate: -5,
    });
    expect(negativeInterest.success).toBe(false);
  });

  it('RecordLiabilityBalanceUseCase validates date and balance', async () => {
    const mockRepo: Partial<LiabilityRepositoryPort> = {
      getLiabilityById: vi.fn().mockResolvedValue(ok(mockLiability)),
      recordLiabilityBalance: vi.fn().mockResolvedValue(ok({ id: 'bal-2' })),
    };

    const useCase = new RecordLiabilityBalanceUseCase(mockRepo as LiabilityRepositoryPort);
    const badDate = await useCase.execute({
      userId: 'user-123',
      liabilityId: 'lib-1',
      balanceCents: 400000000n,
      asOfDate: 'invalid-date',
    });
    expect(badDate.success).toBe(false);

    const valid = await useCase.execute({
      userId: 'user-123',
      liabilityId: 'lib-1',
      balanceCents: 400000000n,
      asOfDate: '2026-10-01',
    });
    expect(valid.success).toBe(true);
    expect(mockRepo.recordLiabilityBalance).toHaveBeenCalled();
  });

  it('GetNetWorthSummaryUseCase computes unified net worth, property equity and LTV', async () => {
    const mockHoldingRepo: Partial<HoldingRepositoryPort> = {
      listDetailsByUser: vi.fn().mockResolvedValue(
        ok([
          {
            holdingId: 'h-1',
            assetId: 'asset-prop-1',
            name: 'Samyak Apartment Vejalpur',
            assetClassId: 'real_estate',
            assetClassName: 'Real Estate & Land',
            assetClassColor: '#f59e0b',
            quantity: 1,
            unitCostCents: 600000000,
            currentValueCents: 800000000, // 80 Lakhs current value
            currency: 'INR',
            updatedAt: '2026-10-01T00:00:00Z',
          },
        ])
      ),
    };

    const mockLiabilityRepo: Partial<LiabilityRepositoryPort> = {
      listLiabilitiesByUser: vi.fn().mockResolvedValue(ok([mockLiability])),
      listAssetLiabilityLinks: vi.fn().mockResolvedValue(
        ok([
          {
            id: 'link-1',
            userId: 'user-123',
            assetId: 'asset-prop-1',
            liabilityId: 'lib-1',
            linkType: 'mortgage',
            ownershipSharePercentage: 100,
            createdAt: '2026-01-01T00:00:00Z',
          },
        ])
      ),
      listAssetValuations: vi.fn().mockResolvedValue(
        ok([
          {
            id: 'val-1',
            assetId: 'asset-prop-1',
            userId: 'user-123',
            valuationCents: 800000000n,
            currency: 'INR',
            asOfDate: '2026-10-01',
            source: 'manual_appraisal',
            createdAt: '2026-10-01T00:00:00Z',
          },
        ])
      ),
      listLiabilityBalances: vi.fn().mockResolvedValue(
        ok([
          {
            id: 'bal-1',
            liabilityId: 'lib-1',
            userId: 'user-123',
            balanceCents: 450000000n, // 45 Lakhs outstanding
            asOfDate: '2026-10-01',
            source: 'manual',
            createdAt: '2026-10-01T00:00:00Z',
          },
        ])
      ),
    };

    const useCase = new GetNetWorthSummaryUseCase(
      mockHoldingRepo as HoldingRepositoryPort,
      mockLiabilityRepo as LiabilityRepositoryPort
    );

    const res = await useCase.execute({ userId: 'user-123', asOfDate: '2026-10-01' });
    expect(res.success).toBe(true);
    if (!res.success) return;

    const summary = res.value;
    // Total Assets = 80 Lakhs
    expect(summary.totalAssets.toDecimal()).toBe(8000000);
    // Total Liabilities = 45 Lakhs
    expect(summary.totalLiabilities.toDecimal()).toBe(4500000);
    // Net Worth = 80L - 45L = 35 Lakhs
    expect(summary.netWorth.toDecimal()).toBe(3500000);
    expect(summary.isSolvent).toBe(true);

    // Property Equity = 80L - 45L = 35 Lakhs
    expect(summary.propertyEquities).toHaveLength(1);
    expect(summary.propertyEquities[0]!.propertyValue.toDecimal()).toBe(8000000);
    expect(summary.propertyEquities[0]!.totalDebt.toDecimal()).toBe(4500000);
    expect(summary.propertyEquities[0]!.equity.toDecimal()).toBe(3500000);
    // LTV = 45 / 80 = 56.25%
    expect(summary.propertyEquities[0]!.ltvRatioPercentage).toBe(56.25);
  });

  it('guarantees strict household/user tenant isolation across liabilities and calculations', async () => {
    const mockHoldingRepo: Partial<HoldingRepositoryPort> = {
      listDetailsByUser: vi.fn().mockImplementation((uid) => {
        if (uid === 'household-a') {
          return Promise.resolve(
            ok([
              {
                holdingId: 'h-a',
                assetId: 'asset-a',
                name: 'Household A Property',
                assetClassId: 'real_estate',
                assetClassName: 'Real Estate & Land',
                assetClassColor: '#f59e0b',
                quantity: 1,
                unitCostCents: 500000000,
                currentValueCents: 500000000,
                currency: 'INR',
                updatedAt: '2026-10-01T00:00:00Z',
              },
            ])
          );
        }
        return Promise.resolve(ok([]));
      }),
    };

    const mockLiabilityRepo: Partial<LiabilityRepositoryPort> = {
      listLiabilitiesByUser: vi.fn().mockImplementation((uid) => {
        if (uid === 'household-a') {
          return Promise.resolve(ok([mockLiability]));
        }
        return Promise.resolve(ok([])); // Household B has no liabilities
      }),
      listAssetLiabilityLinks: vi.fn().mockResolvedValue(ok([])),
      listAssetValuations: vi.fn().mockResolvedValue(ok([])),
      listLiabilityBalances: vi.fn().mockResolvedValue(ok([])),
    };

    const useCase = new GetNetWorthSummaryUseCase(
      mockHoldingRepo as HoldingRepositoryPort,
      mockLiabilityRepo as LiabilityRepositoryPort
    );

    // Household A summary
    const resA = await useCase.execute({ userId: 'household-a' });
    expect(resA.success).toBe(true);
    if (resA.success) {
      expect(resA.value.totalAssets.toDecimal()).toBe(5000000);
      expect(resA.value.totalLiabilities.toDecimal()).toBe(4500000);
    }

    // Household B summary (isolated)
    const resB = await useCase.execute({ userId: 'household-b' });
    expect(resB.success).toBe(true);
    if (resB.success) {
      expect(resB.value.totalAssets.toDecimal()).toBe(0);
      expect(resB.value.totalLiabilities.toDecimal()).toBe(0);
      expect(resB.value.netWorth.toDecimal()).toBe(0);
    }

    expect(mockHoldingRepo.listDetailsByUser).toHaveBeenCalledWith('household-a');
    expect(mockHoldingRepo.listDetailsByUser).toHaveBeenCalledWith('household-b');
  });

  it('UpdateLiabilityUseCase validates and forwards principal, currentBalanceCents (including 0n), and dates', async () => {
    const mockRepo: Partial<LiabilityRepositoryPort> = {
      updateLiability: vi.fn().mockImplementation(async (params) =>
        ok({
          ...mockLiability,
          originalPrincipalCents:
            params.originalPrincipalCents ?? mockLiability.originalPrincipalCents,
          currentBalanceCents: params.currentBalanceCents ?? mockLiability.currentBalanceCents,
          status: params.status ?? mockLiability.status,
          startDate: params.startDate,
        })
      ),
    };

    const useCase = new UpdateLiabilityUseCase(mockRepo as LiabilityRepositoryPort);

    // Valid part-payment update
    const partPayRes = await useCase.execute({
      id: 'lib-1',
      userId: 'user-123',
      originalPrincipalCents: 480000000n,
      currentBalanceCents: 320000000n,
      startDate: '2025-04-01',
    });
    expect(partPayRes.success).toBe(true);
    expect(mockRepo.updateLiability).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'lib-1',
        originalPrincipalCents: 480000000n,
        currentBalanceCents: 320000000n,
        startDate: '2025-04-01',
      })
    );

    // Zero balance (full payoff via Edit) is allowed
    const payoffRes = await useCase.execute({
      id: 'lib-1',
      userId: 'user-123',
      currentBalanceCents: 0n,
      status: 'closed',
    });
    expect(payoffRes.success).toBe(true);

    // Rejects negative outstanding balance or non-positive original principal
    const negBalRes = await useCase.execute({
      id: 'lib-1',
      userId: 'user-123',
      currentBalanceCents: -100n,
    });
    expect(negBalRes.success).toBe(false);

    const zeroOrigRes = await useCase.execute({
      id: 'lib-1',
      userId: 'user-123',
      originalPrincipalCents: 0n,
    });
    expect(zeroOrigRes.success).toBe(false);
  });

  it('GetNetWorthSummaryUseCase live view reflects 0n balances and latest balance ahead of UTC date', async () => {
    const mockHoldingRepo: Partial<HoldingRepositoryPort> = {
      listDetailsByUser: vi.fn().mockResolvedValue(ok([])),
    };
    const mockLiabilityRepo: Partial<LiabilityRepositoryPort> = {
      listLiabilitiesByUser: vi.fn().mockResolvedValue(
        ok([
          { ...mockLiability, id: 'lib-paid', currentBalanceCents: 0n, startDate: '2023-01-01' },
          { ...mockLiability, id: 'lib-tz', currentBalanceCents: 180000000n, startDate: '2023-01-01' },
        ])
      ),
      listAssetLiabilityLinks: vi.fn().mockResolvedValue(ok([])),
      listLiabilityBalances: vi.fn().mockImplementation(async (id: string) => {
        if (id === 'lib-paid') return ok([]);
        return ok([
          {
            id: 'bal-old',
            liabilityId: 'lib-tz',
            userId: 'user-123',
            balanceCents: 420000000n,
            asOfDate: '2025-01-01',
            source: 'manual',
            createdAt: '2025-01-01T00:00:00Z',
          },
          {
            id: 'bal-new',
            liabilityId: 'lib-tz',
            userId: 'user-123',
            balanceCents: 180000000n,
            asOfDate: '2099-12-31',
            source: 'manual',
            createdAt: '2026-11-20T00:00:00Z',
          },
        ]);
      }),
    };

    const nwUc = new GetNetWorthSummaryUseCase(
      mockHoldingRepo as HoldingRepositoryPort,
      mockLiabilityRepo as LiabilityRepositoryPort
    );

    const liveRes = await nwUc.execute({ userId: 'user-123' });
    expect(liveRes.success).toBe(true);
    if (liveRes.success) {
      expect(liveRes.value.totalLiabilities.cents).toBe(180000000n);
    }
  });
});
