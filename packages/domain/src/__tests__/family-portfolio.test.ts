import { describe, it, expect } from 'vitest';
import {
  calculateFamilyPortfolioSummary,
  SECTION_112A_EXEMPTION_PAISE,
} from '../family/family-wealth-calculator.js';
import { FamilyMember, PortfolioAccount } from '../family/family-types.js';

describe('Family Portfolio Domain Calculator', () => {
  const mockMembers: FamilyMember[] = [
    {
      id: 'mem-1',
      userId: 'user-1',
      name: 'Ketan Vaghela',
      relationship: 'self',
      panMasked: 'ABCDE****F',
      colorHex: '#3b82f6',
      isPrimary: true,
    },
    {
      id: 'mem-2',
      userId: 'user-1',
      name: 'Parul Vaghela',
      relationship: 'spouse',
      panMasked: 'BGTYU****K',
      colorHex: '#ec4899',
      isPrimary: false,
    },
    {
      id: 'mem-3',
      userId: 'user-1',
      name: 'Shamalbhai Vaghela HUF',
      relationship: 'huf',
      panMasked: 'AAACH****H',
      colorHex: '#8b5cf6',
      isPrimary: false,
    },
  ];

  const mockAccounts: PortfolioAccount[] = [
    {
      id: 'acc-1',
      userId: 'user-1',
      memberId: 'mem-1',
      accountName: 'Zerodha Kite',
      brokerName: 'Zerodha',
      depository: 'CDSL',
      accountNumberMasked: '1208****1234',
      accountType: 'demat',
    },
    {
      id: 'acc-2',
      userId: 'user-1',
      memberId: 'mem-2',
      accountName: 'Groww Direct',
      brokerName: 'Groww',
      depository: 'CDSL',
      accountNumberMasked: '1208****5678',
      accountType: 'demat',
    },
    {
      id: 'acc-3',
      userId: 'user-1',
      memberId: 'mem-3',
      accountName: 'ICICI Direct HUF',
      brokerName: 'ICICI Direct',
      depository: 'NSDL',
      accountNumberMasked: 'IN30****9999',
      accountType: 'demat',
    },
  ];

  it('correctly aggregates wealth by family member and Demat account', () => {
    const holdings = [
      // Self: ₹6,00,000 (60,000,000 paise)
      {
        id: 'h-1',
        memberId: 'mem-1',
        accountId: 'acc-1',
        currentValuePaise: 60_000_000n,
        costBasisPaise: 40_000_000n,
        holdingPeriodDays: 400,
      },
      // Spouse: ₹3,00,000 (30,000,000 paise)
      {
        id: 'h-2',
        memberId: 'mem-2',
        accountId: 'acc-2',
        currentValuePaise: 30_000_000n,
        costBasisPaise: 20_000_000n,
        holdingPeriodDays: 500,
      },
      // HUF: ₹1,00,000 (10,000,000 paise)
      {
        id: 'h-3',
        memberId: 'mem-3',
        accountId: 'acc-3',
        currentValuePaise: 10_000_000n,
        costBasisPaise: 5_000_000n,
        holdingPeriodDays: 450,
      },
    ];

    const summary = calculateFamilyPortfolioSummary(mockMembers, mockAccounts, holdings);

    expect(summary.totalFamilyWealthPaise).toBe(100_000_000n); // Total ₹10,00,000
    expect(summary.activeMemberCount).toBe(3);
    expect(summary.activeAccountCount).toBe(3);

    const selfDist = summary.memberDistributions.find((m) => m.memberId === 'mem-1');
    expect(selfDist?.percentageOfTotal).toBe(60); // 60%
    expect(selfDist?.totalWealthPaise).toBe(60_000_000n);

    const spouseDist = summary.memberDistributions.find((m) => m.memberId === 'mem-2');
    expect(spouseDist?.percentageOfTotal).toBe(30); // 30%

    const hufDist = summary.memberDistributions.find((m) => m.memberId === 'mem-3');
    expect(hufDist?.percentageOfTotal).toBe(10); // 10%
  });

  it('proves HUF Multi-Entity Tax Harvest Benefit with independent ₹1.25L Section 112A exemptions', () => {
    // Scenario:
    // Self has ₹1,25,000 LTCG gain
    // HUF has ₹1,25,000 LTCG gain
    // Total gain = ₹2,50,000
    //
    // Under separate entities:
    // Self gets ₹1.25L exemption -> Taxable = 0 -> Tax = 0
    // HUF gets ₹1.25L exemption -> Taxable = 0 -> Tax = 0
    // Combined Family Tax = 0!
    //
    // If lumped under single PAN entity:
    // Total gain = ₹2,50,000
    // Single exemption = ₹1,25,000
    // Taxable LTCG = ₹1,25,000 @ 12.5% = ₹15,625!
    //
    // HUF Tax Benefit = ₹15,625 (1,562,500 paise)
    const holdings = [
      {
        id: 'h-1',
        memberId: 'mem-1',
        currentValuePaise: 22_500_000n,
        costBasisPaise: 10_000_000n, // Gain: 12,500,000 paise (₹1,25,000)
        holdingPeriodDays: 400, // Long Term
      },
      {
        id: 'h-2',
        memberId: 'mem-3', // HUF
        currentValuePaise: 22_500_000n,
        costBasisPaise: 10_000_000n, // Gain: 12,500,000 paise (₹1,25,000)
        holdingPeriodDays: 500, // Long Term
      },
    ];

    const summary = calculateFamilyPortfolioSummary(mockMembers, mockAccounts, holdings);

    expect(summary.totalFamilyTaxPaise).toBe(0n); // Both fully covered under their respective ₹1.25L exemptions!
    expect(summary.hufTaxHarvestBenefitPaise).toBe(1_562_500n); // ₹15,625 tax saved!
  });

  it('attributes untagged holdings to primary member by default', () => {
    const holdings = [
      {
        id: 'h-untagged',
        currentValuePaise: 50_000_000n,
        costBasisPaise: 40_000_000n,
        holdingPeriodDays: 100,
      },
    ];

    const summary = calculateFamilyPortfolioSummary(mockMembers, mockAccounts, holdings);

    const primaryDist = summary.memberDistributions.find((m) => m.isPrimary);
    expect(primaryDist?.totalWealthPaise).toBe(50_000_000n);
    expect(primaryDist?.holdingCount).toBe(1);
  });
});
