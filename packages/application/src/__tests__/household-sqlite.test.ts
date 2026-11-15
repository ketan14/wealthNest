import { describe, it, expect } from 'vitest';
import { createTestSqliteDb } from './test-sqlite-helper.js';
import { SqliteHouseholdAdapter } from '../persistence/sqlite/sqlite-household-adapter.js';
import { SqliteFamilyAdapter } from '../persistence/sqlite/sqlite-family-adapter.js';
import { SqliteHoldingAdapter } from '../persistence/sqlite/sqlite-portfolio-adapters.js';
import { SqliteLiabilityAdapter } from '../persistence/sqlite/sqlite-liability-adapter.js';
import { GetNetWorthSummaryUseCase } from '../use-cases/get-net-worth-summary.js';

describe('Phase 18A: SQLite Multi-Household RBAC, Invitations & Joint Ownership', () => {
  it('supports default household creation, invitations linking family members, admin appointment & ownership transfer', async () => {
    const db = createTestSqliteDb();
    const ownerAdapter = new SqliteHouseholdAdapter(db, 'user-ketan', 'ketan@wealthnest.test');
    const spouseAdapter = new SqliteHouseholdAdapter(db, 'user-parul', 'parul@wealthnest.test');
    const familyRepo = new SqliteFamilyAdapter(db);

    const hhIdRes = await ownerAdapter.ensureDefaultHousehold('Ketan');
    expect(hhIdRes.success).toBe(true);
    if (!hhIdRes.success) return;
    const householdId = hhIdRes.value;

    // Create an unlinked spouse family member profile inside Ketan's household
    await familyRepo.saveMember({
      id: 'mem-parul-1',
      userId: 'user-ketan',
      householdId,
      name: 'Parul Vaghela',
      relationship: 'spouse',
      entityType: 'individual',
      email: 'parul@wealthnest.test',
      colorHex: '#ec4899',
      isPrimary: false,
      createdAt: new Date().toISOString(),
    });

    // Invite Parul linked to mem-parul-1
    const invRes = await ownerAdapter.createInvitation({
      householdId,
      invitedEmail: 'parul@wealthnest.test',
      role: 'member',
      familyMemberId: 'mem-parul-1',
    });
    expect(invRes.success).toBe(true);
    if (!invRes.success) return;

    const preview = await spouseAdapter.previewInvitation(invRes.value.inviteToken);
    expect(preview.success).toBe(true);
    if (preview.success) {
      expect(preview.value.valid).toBe(true);
      expect(preview.value.familyMemberName).toBe('Parul Vaghela');
    }

    const accepted = await spouseAdapter.acceptInvitation(invRes.value.inviteToken);
    expect(accepted.success).toBe(true);

    // Verify mem-parul-1 is now linked to user-parul
    const mems = await familyRepo.getMembersByHousehold(householdId);
    expect(mems.success).toBe(true);
    if (mems.success) {
      expect(mems.value.find((m) => m.id === 'mem-parul-1')?.linkedUserId).toBe('user-parul');
    }

    // Appoint Parul as admin, then transfer primary ownership
    const adminRes = await ownerAdapter.appointAdmin(householdId, 'user-parul', true);
    expect(adminRes.success).toBe(true);

    // Parul as admin cannot appoint another admin, only primary owner can transfer ownership
    const parulTransferRes = await spouseAdapter.transferPrimaryOwner(householdId, 'user-ketan');
    expect(parulTransferRes.success).toBe(false);

    const transferRes = await ownerAdapter.transferPrimaryOwner(householdId, 'user-parul');
    expect(transferRes.success).toBe(true);

    const parulHouseholds = await spouseAdapter.listMyHouseholds();
    expect(parulHouseholds.success).toBe(true);
    if (parulHouseholds.success) {
      expect(parulHouseholds.value[0]?.role).toBe('primary_owner');
    }

    const auditLogs = await spouseAdapter.listAuditLogs(householdId, 20);
    expect(auditLogs.success).toBe(true);
    if (auditLogs.success) {
      expect(auditLogs.value.some((l) => l.action === 'primary_owner_transferred')).toBe(true);
    }
  });

  it('persists joint holding owners & liability parties and computes exact BigInt member net worth without cross-household leakage', async () => {
    const db = createTestSqliteDb();
    const householdAdapter = new SqliteHouseholdAdapter(db, 'user-ketan');
    const familyRepo = new SqliteFamilyAdapter(db);
    const holdingRepo = new SqliteHoldingAdapter(db);
    const liabilityRepo = new SqliteLiabilityAdapter(db);

    const hhARes = await householdAdapter.createHousehold('Marital Household');
    const hhBRes = await householdAdapter.createHousehold('Parental Household');
    expect(hhARes.success && hhBRes.success).toBe(true);
    if (!hhARes.success || !hhBRes.success) return;

    const hhA = hhARes.value.id;
    const hhB = hhBRes.value.id;

    await familyRepo.saveMember({
      id: 'mem-a1',
      userId: 'user-ketan',
      householdId: hhA,
      name: 'Ketan Vaghela',
      relationship: 'self',
      colorHex: '#3b82f6',
      isPrimary: true,
      createdAt: new Date().toISOString(),
    });
    await familyRepo.saveMember({
      id: 'mem-a2',
      userId: 'user-ketan',
      householdId: hhA,
      name: 'Parul Vaghela',
      relationship: 'spouse',
      colorHex: '#ec4899',
      isPrimary: false,
      createdAt: new Date().toISOString(),
    });
    await familyRepo.saveMember({
      id: 'mem-b1',
      userId: 'user-ketan',
      householdId: hhB,
      name: 'Father Shinde',
      relationship: 'parent',
      colorHex: '#10b981',
      isPrimary: false,
      createdAt: new Date().toISOString(),
    });

    // Reject invalid 90% holding ownership split
    const invalidRes = await holdingRepo.createHoldingWithAsset({
      userId: 'user-ketan',
      householdId: hhA,
      name: 'Joint Flat Invalid',
      assetClassId: 'real_estate',
      currency: 'INR',
      quantity: 1,
      unitCostCents: 1000000,
      currentValueCents: 1000001,
      ownerShares: [
        { familyMemberId: 'mem-a1', ownershipShare: 60, isPrimaryOwner: true },
        { familyMemberId: 'mem-a2', ownershipShare: 30, isPrimaryOwner: false },
      ],
    });
    expect(invalidRes.success).toBe(false);

    // Valid 60/40 split on odd paise (1000001 paise -> 600001 + 400000 = 1000001)
    const hRes = await holdingRepo.createHoldingWithAsset({
      userId: 'user-ketan',
      householdId: hhA,
      visibility: 'household_shared',
      name: 'Satellite Road Joint Flat',
      assetClassId: 'real_estate',
      currency: 'INR',
      quantity: 1,
      unitCostCents: 1000000,
      currentValueCents: 1000001,
      ownerShares: [
        { familyMemberId: 'mem-a1', ownershipShare: 60, isPrimaryOwner: true },
        { familyMemberId: 'mem-a2', ownershipShare: 40, isPrimaryOwner: false },
      ],
    });
    expect(hRes.success).toBe(true);
    if (hRes.success) {
      expect(hRes.value.owners?.length).toBe(2);
    }

    // Separate holding in hhB should NOT appear in hhA queries
    const hBRes = await holdingRepo.createHoldingWithAsset({
      userId: 'user-ketan',
      householdId: hhB,
      name: 'Pune Plot',
      assetClassId: 'real_estate',
      currency: 'INR',
      quantity: 1,
      unitCostCents: 500000,
      currentValueCents: 500000,
      memberId: 'mem-b1',
    });
    expect(hBRes.success).toBe(true);

    const listA = await holdingRepo.listDetailsByHousehold(hhA);
    expect(listA.success).toBe(true);
    if (listA.success) {
      expect(listA.value).toHaveLength(1);
      expect(listA.value[0]?.name).toBe('Satellite Road Joint Flat');
    }

    // Joint liability (70/30 split across mem-a1 & mem-a2 on 300001 paise -> 210001 + 90000)
    const lRes = await liabilityRepo.createLiability({
      userId: 'user-ketan',
      householdId: hhA,
      name: 'Joint Home Loan',
      loanType: 'home_loan',
      lender: 'SBI',
      originalPrincipalCents: 300001n,
      initialBalanceCents: 300001n,
      interestRate: 8.5,
      parties: [
        { familyMemberId: 'mem-a1', partyRole: 'primary_borrower', liabilityShare: 70 },
        { familyMemberId: 'mem-a2', partyRole: 'co_borrower', liabilityShare: 30 },
      ],
    });
    expect(lRes.success).toBe(true);

    const netWorthUc = new GetNetWorthSummaryUseCase(holdingRepo, liabilityRepo);
    const totalSummary = await netWorthUc.execute({ userId: 'user-ketan', householdId: hhA });
    const a1Summary = await netWorthUc.execute({
      userId: 'user-ketan',
      householdId: hhA,
      memberId: 'mem-a1',
    });
    const a2Summary = await netWorthUc.execute({
      userId: 'user-ketan',
      householdId: hhA,
      memberId: 'mem-a2',
    });

    expect(totalSummary.success && a1Summary.success && a2Summary.success).toBe(true);
    if (totalSummary.success && a1Summary.success && a2Summary.success) {
      expect(totalSummary.value.totalAssets.cents).toBe(1000001n);
      expect(totalSummary.value.totalLiabilities.cents).toBe(300001n);
      // Zero paise drift across owners!
      expect(a1Summary.value.totalAssets.cents + a2Summary.value.totalAssets.cents).toBe(
        totalSummary.value.totalAssets.cents
      );
      expect(a1Summary.value.totalLiabilities.cents + a2Summary.value.totalLiabilities.cents).toBe(
        totalSummary.value.totalLiabilities.cents
      );
    }
  });
});
