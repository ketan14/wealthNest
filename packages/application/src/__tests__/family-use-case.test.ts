import { describe, it, expect, vi } from 'vitest';
import { ok, isOk } from '@wealthnest/shared';
import {
  GetFamilyPortfolioSummaryUseCase,
  ManageFamilyMembersUseCase,
  ManagePortfolioAccountsUseCase,
} from '../use-cases/manage-family.js';
import {
  FamilyRepositoryPort,
  FamilyMemberDto,
  PortfolioAccountDto,
} from '../ports/family-repository.port.js';
import { HoldingRepositoryPort, HoldingDetailDto } from '../ports/holding-repository.port.js';

describe('Manage Family & Demat Accounts Use Cases', () => {
  const mockMembers: FamilyMemberDto[] = [
    {
      id: 'mem-1',
      userId: 'user-1',
      name: 'Ketan Vaghela',
      relationship: 'self',
      colorHex: '#3b82f6',
      isPrimary: true,
    },
    {
      id: 'mem-2',
      userId: 'user-1',
      name: 'Shamalbhai Vaghela HUF',
      relationship: 'huf',
      colorHex: '#8b5cf6',
      isPrimary: false,
    },
  ];

  const mockAccounts: PortfolioAccountDto[] = [
    {
      id: 'acc-1',
      userId: 'user-1',
      memberId: 'mem-1',
      accountName: 'Zerodha Kite',
      brokerName: 'Zerodha',
      depository: 'CDSL',
      accountType: 'demat',
    },
    {
      id: 'acc-2',
      userId: 'user-1',
      memberId: 'mem-2',
      accountName: 'ICICI Direct HUF',
      brokerName: 'ICICI Direct',
      depository: 'NSDL',
      accountType: 'demat',
    },
  ];

  const mockHoldings: HoldingDetailDto[] = [
    {
      holdingId: 'h-1',
      assetId: 'a-1',
      name: 'Reliance Industries',
      assetClassId: 'equity',
      assetClassName: 'Equities',
      assetClassColor: '#3b82f6',
      quantity: 10,
      unitCostCents: 250000,
      currentValueCents: 3000000, // ₹30,000
      currency: 'INR',
      updatedAt: new Date().toISOString(),
      memberId: 'mem-1',
      accountId: 'acc-1',
    },
    {
      holdingId: 'h-2',
      assetId: 'a-2',
      name: 'Parag Parikh Flexi Cap',
      assetClassId: 'mutual_fund',
      assetClassName: 'Mutual Funds',
      assetClassColor: '#06b6d4',
      quantity: 100,
      unitCostCents: 6000,
      currentValueCents: 800000, // ₹8,000
      currency: 'INR',
      updatedAt: new Date().toISOString(),
      memberId: 'mem-2',
      accountId: 'acc-2',
    },
  ];

  const createMockFamilyRepo = (): FamilyRepositoryPort => ({
    getMembers: vi.fn().mockResolvedValue(ok(mockMembers)),
    getMemberById: vi.fn().mockResolvedValue(ok(mockMembers[0])),
    saveMember: vi.fn().mockResolvedValue(ok(undefined)),
    deleteMember: vi.fn().mockResolvedValue(ok(undefined)),
    getAccounts: vi.fn().mockResolvedValue(ok(mockAccounts)),
    getAccountById: vi.fn().mockResolvedValue(ok(mockAccounts[0])),
    saveAccount: vi.fn().mockResolvedValue(ok(undefined)),
    deleteAccount: vi.fn().mockResolvedValue(ok(undefined)),
  });

  const createMockHoldingRepo = (): HoldingRepositoryPort => ({
    listDetailsByUser: vi.fn().mockResolvedValue(ok(mockHoldings)),
    createHoldingWithAsset: vi.fn().mockResolvedValue(ok(mockHoldings[0])),
    deleteHolding: vi.fn().mockResolvedValue(ok(undefined)),
  });

  it('GetFamilyPortfolioSummaryUseCase generates family breakdown and accounts', async () => {
    const familyRepo = createMockFamilyRepo();
    const holdingRepo = createMockHoldingRepo();
    const useCase = new GetFamilyPortfolioSummaryUseCase(familyRepo, holdingRepo);

    const result = await useCase.execute('user-1');

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    expect(result.value.activeMemberCount).toBe(2);
    expect(result.value.activeAccountCount).toBe(2);
    expect(result.value.totalFamilyWealthPaise).toBe(3800000n);
    expect(result.value.memberDistributions.length).toBe(2);
    expect(result.value.accountDistributions.length).toBe(2);
  });

  it('ManageFamilyMembersUseCase creates and validates family member', async () => {
    const familyRepo = createMockFamilyRepo();
    const useCase = new ManageFamilyMembersUseCase(familyRepo);

    const result = await useCase.createMember({
      userId: 'user-1',
      name: 'Parul Vaghela',
      relationship: 'spouse',
      panMasked: 'BGTYU1234K',
      colorHex: '#ec4899',
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.name).toBe('Parul Vaghela');
    expect(result.value.relationship).toBe('spouse');
    expect(familyRepo.saveMember).toHaveBeenCalledTimes(1);
  });

  it('ManagePortfolioAccountsUseCase creates and validates Demat account', async () => {
    const familyRepo = createMockFamilyRepo();
    const useCase = new ManagePortfolioAccountsUseCase(familyRepo);

    const result = await useCase.createAccount({
      userId: 'user-1',
      memberId: 'mem-1',
      accountName: 'Groww Demat',
      brokerName: 'Groww',
      depository: 'CDSL',
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.accountName).toBe('Groww Demat');
    expect(result.value.brokerName).toBe('Groww');
    expect(familyRepo.saveAccount).toHaveBeenCalledTimes(1);
  });
});
