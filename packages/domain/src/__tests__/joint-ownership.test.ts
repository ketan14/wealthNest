import { describe, it, expect } from 'vitest';
import {
  allocateBigIntByShares,
  validateOwnershipShares,
  buildEqualOwnershipShares,
  calculateFamilyPortfolioSummary,
  calculateMemberLiabilitySharePaise,
  isRecordVisibleToHouseholdUser,
  FamilyMember,
  PortfolioAccount,
} from '../index.js';

describe('Joint Ownership & Household Visibility Domain Rules', () => {
  it('validates ownership shares sum strictly to 100% and rejects duplicates or invalid bounds', () => {
    expect(
      validateOwnershipShares([
        { familyMemberId: 'mem-1', sharePercentage: 60, isPrimary: true },
        { familyMemberId: 'mem-2', sharePercentage: 40 },
      ]).valid
    ).toBe(true);

    expect(
      validateOwnershipShares([
        { familyMemberId: 'mem-1', sharePercentage: 33.3333, isPrimary: true },
        { familyMemberId: 'mem-2', sharePercentage: 33.3333 },
        { familyMemberId: 'mem-3', sharePercentage: 33.3334 },
      ]).valid
    ).toBe(true);

    expect(
      validateOwnershipShares([
        { familyMemberId: 'mem-1', sharePercentage: 50 },
        { familyMemberId: 'mem-2', sharePercentage: 40 },
      ]).valid
    ).toBe(false);

    expect(
      validateOwnershipShares([
        { familyMemberId: 'mem-1', sharePercentage: 50 },
        { familyMemberId: 'mem-1', sharePercentage: 50 },
      ]).valid
    ).toBe(false);
  });

  it('allocates BigInt paise exactly with largest-remainder rounding and zero paise drift', () => {
    const split = allocateBigIntByShares(100_000_001n, [
      { familyMemberId: 'mem-1', sharePercentage: 60, isPrimary: true },
      { familyMemberId: 'mem-2', sharePercentage: 40 },
    ]);

    expect(split.map((s) => s.allocatedCents)).toEqual([60_000_001n, 40_000_000n]);
    expect(split.reduce((sum, s) => sum + s.allocatedCents, 0n)).toBe(100_000_001n);

    const equal3 = allocateBigIntByShares(100n, [
      { familyMemberId: 'a', sharePercentage: 33.3333, isPrimary: true },
      { familyMemberId: 'b', sharePercentage: 33.3333 },
      { familyMemberId: 'c', sharePercentage: 33.3334 },
    ]);
    expect(equal3.reduce((sum, s) => sum + s.allocatedCents, 0n)).toBe(100n);
  });

  it('generates equal split percentages summing strictly to 100', () => {
    const shares = buildEqualOwnershipShares(['m1', 'm2', 'm3']);
    expect(shares).toEqual([33.34, 33.33, 33.33]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('splits joint holdings across co-owners in calculateFamilyPortfolioSummary without double counting', () => {
    const members: FamilyMember[] = [
      {
        id: 'mem-1',
        householdId: 'hh-1',
        userId: 'u-1',
        name: 'Ketan',
        relationship: 'self',
        colorHex: '#3b82f6',
        isPrimary: true,
      },
      {
        id: 'mem-2',
        householdId: 'hh-1',
        userId: 'u-1',
        name: 'Parul',
        relationship: 'spouse',
        colorHex: '#ec4899',
        isPrimary: false,
      },
    ];
    const accounts: PortfolioAccount[] = [];

    const summary = calculateFamilyPortfolioSummary(members, accounts, [
      {
        id: 'h-joint-flat',
        currentValuePaise: 100_000_001n,
        costBasisPaise: 60_000_001n, // ₹4,00,000 LTCG gain
        holdingPeriodDays: 900,
        owners: [
          { familyMemberId: 'mem-1', ownershipShare: 60, isPrimaryOwner: true },
          { familyMemberId: 'mem-2', ownershipShare: 40, isPrimaryOwner: false },
        ],
      },
    ]);

    expect(summary.totalFamilyWealthPaise).toBe(100_000_001n);
    const ketan = summary.memberDistributions.find((m) => m.memberId === 'mem-1')!;
    const parul = summary.memberDistributions.find((m) => m.memberId === 'mem-2')!;
    expect(ketan.totalWealthPaise + parul.totalWealthPaise).toBe(100_000_001n);
    expect(ketan.totalWealthPaise).toBe(60_000_001n);
    expect(parul.totalWealthPaise).toBe(40_000_000n);
  });

  it('computes member liability exposure from co-borrower splits without double counting', () => {
    const parties = [
      { familyMemberId: 'mem-1', partyRole: 'primary_borrower' as const, liabilityShare: 70 },
      { familyMemberId: 'mem-2', partyRole: 'co_borrower' as const, liabilityShare: 30 },
    ];
    const m1 = calculateMemberLiabilitySharePaise({
      outstandingBalanceCents: 50_000_001n,
      memberId: 'mem-1',
      parties,
    });
    const m2 = calculateMemberLiabilitySharePaise({
      outstandingBalanceCents: 50_000_001n,
      memberId: 'mem-2',
      parties,
    });
    expect(m1 + m2).toBe(50_000_001n);
  });

  it('evaluates owner_only and restricted record visibility independently of admin role', () => {
    expect(
      isRecordVisibleToHouseholdUser({
        visibility: 'owner_only',
        viewerUserId: 'owner-user',
        creatorUserId: 'spouse-user',
        ownerLinkedUserIds: ['spouse-user'],
      })
    ).toBe(false);

    expect(
      isRecordVisibleToHouseholdUser({
        visibility: 'restricted',
        viewerUserId: 'invited-viewer',
        creatorUserId: 'spouse-user',
        ownerLinkedUserIds: ['spouse-user'],
        explicitGrantUserIds: ['invited-viewer'],
      })
    ).toBe(true);
  });
});
