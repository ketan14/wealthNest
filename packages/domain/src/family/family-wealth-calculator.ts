import {
  FamilyMember,
  PortfolioAccount,
  MemberWealthDistribution,
  AccountWealthDistribution,
  EntityTaxSummary,
  FamilyPortfolioSummary,
} from './family-types.js';

export interface HoldingFamilyItem {
  readonly id: string;
  readonly memberId?: string;
  readonly accountId?: string;
  readonly currentValuePaise: bigint;
  readonly costBasisPaise: bigint;
  readonly holdingPeriodDays?: number;
  readonly isEquityOrMutualFund?: boolean;
}

// Section 112A maximum annual LTCG exemption: ₹1,25,000 (12,500,000 paise) per legal tax entity
export const SECTION_112A_EXEMPTION_PAISE = 12_500_000n;
export const EQUITY_LTCG_RATE = 0.125; // 12.5%
export const EQUITY_STCG_RATE = 0.20; // 20%

export function calculateFamilyPortfolioSummary(
  members: readonly FamilyMember[],
  accounts: readonly PortfolioAccount[],
  holdings: readonly HoldingFamilyItem[]
): FamilyPortfolioSummary {
  // 1. Calculate total family wealth
  let totalFamilyWealthPaise = 0n;
  for (const h of holdings) {
    if (h.currentValuePaise > 0n) {
      totalFamilyWealthPaise += h.currentValuePaise;
    }
  }

  // 2. Identify default primary member (or create a fallback if empty)
  const primaryMember = members.find((m) => m.isPrimary) || members[0];
  const primaryMemberId = primaryMember?.id || 'default-primary-member';

  // 3. Member wealth distribution
  const memberDistributions: MemberWealthDistribution[] = [];

  for (const member of members) {
    const memberAccounts = accounts.filter((a) => a.memberId === member.id);
    const memberAccountIds = new Set(memberAccounts.map((a) => a.id));

    // Holdings directly assigned to this member OR assigned to an account of this member
    // If holding has no memberId and no accountId, attribute to primary member
    const memberHoldings = holdings.filter((h) => {
      if (h.memberId === member.id) return true;
      if (h.accountId && memberAccountIds.has(h.accountId)) return true;
      if (!h.memberId && !h.accountId && member.id === primaryMemberId) return true;
      return false;
    });

    let memberWealthPaise = 0n;
    for (const mh of memberHoldings) {
      if (mh.currentValuePaise > 0n) {
        memberWealthPaise += mh.currentValuePaise;
      }
    }

    const percentageOfTotal =
      totalFamilyWealthPaise > 0n
        ? Number((memberWealthPaise * 10000n) / totalFamilyWealthPaise) / 100
        : 0;

    memberDistributions.push({
      memberId: member.id,
      memberName: member.name,
      relationship: member.relationship,
      colorHex: member.colorHex,
      isPrimary: member.isPrimary,
      totalWealthPaise: memberWealthPaise,
      percentageOfTotal,
      holdingCount: memberHoldings.length,
      accountCount: memberAccounts.length,
      accounts: memberAccounts,
    });
  }

  // 4. Account wealth distribution
  const accountDistributions: AccountWealthDistribution[] = [];

  for (const acc of accounts) {
    const parentMember = members.find((m) => m.id === acc.memberId);
    const accHoldings = holdings.filter((h) => h.accountId === acc.id);

    let accWealthPaise = 0n;
    for (const ah of accHoldings) {
      if (ah.currentValuePaise > 0n) {
        accWealthPaise += ah.currentValuePaise;
      }
    }

    const percentageOfTotal =
      totalFamilyWealthPaise > 0n
        ? Number((accWealthPaise * 10000n) / totalFamilyWealthPaise) / 100
        : 0;

    accountDistributions.push({
      accountId: acc.id,
      accountName: acc.accountName,
      brokerName: acc.brokerName,
      depository: acc.depository,
      accountType: acc.accountType,
      memberId: acc.memberId,
      memberName: parentMember?.name || 'Unknown',
      totalWealthPaise: accWealthPaise,
      percentageOfTotal,
      holdingCount: accHoldings.length,
    });
  }

  // 5. Multi-Entity Indian Capital Gains Tax Segregation (Section 112A per legal PAN entity)
  const entityTaxSummaries: EntityTaxSummary[] = [];
  let combinedFamilyTaxPaise = 0n;
  let totalGrossLtcgPaise = 0n;
  let totalGrossStcgPaise = 0n;

  for (const member of members) {
    const memberAccounts = accounts.filter((a) => a.memberId === member.id);
    const memberAccountIds = new Set(memberAccounts.map((a) => a.id));

    const memberHoldings = holdings.filter((h) => {
      if (h.memberId === member.id) return true;
      if (h.accountId && memberAccountIds.has(h.accountId)) return true;
      if (!h.memberId && !h.accountId && member.id === primaryMemberId) return true;
      return false;
    });

    let entityGrossLtcgPaise = 0n;
    let entityGrossStcgPaise = 0n;

    for (const h of memberHoldings) {
      const unrealizedPnlPaise = h.currentValuePaise - h.costBasisPaise;
      if (unrealizedPnlPaise > 0n) {
        const isLongTerm = (h.holdingPeriodDays ?? 0) >= 365;
        if (isLongTerm) {
          entityGrossLtcgPaise += unrealizedPnlPaise;
          totalGrossLtcgPaise += unrealizedPnlPaise;
        } else {
          entityGrossStcgPaise += unrealizedPnlPaise;
          totalGrossStcgPaise += unrealizedPnlPaise;
        }
      }
    }

    // Apply Section 112A ₹1.25L exemption specifically to this legal entity
    const exemptionAppliedPaise =
      entityGrossLtcgPaise > SECTION_112A_EXEMPTION_PAISE
        ? SECTION_112A_EXEMPTION_PAISE
        : entityGrossLtcgPaise;

    const taxableLtcgPaise = entityGrossLtcgPaise - exemptionAppliedPaise;
    const estimatedLtcgTaxPaise = BigInt(Math.round(Number(taxableLtcgPaise) * EQUITY_LTCG_RATE));
    const estimatedStcgTaxPaise = BigInt(Math.round(Number(entityGrossStcgPaise) * EQUITY_STCG_RATE));
    const totalEntityTaxPaise = estimatedLtcgTaxPaise + estimatedStcgTaxPaise;

    combinedFamilyTaxPaise += totalEntityTaxPaise;

    entityTaxSummaries.push({
      memberId: member.id,
      entityName: member.name,
      relationship: member.relationship,
      panMasked: member.panMasked,
      grossLtcgPaise: entityGrossLtcgPaise,
      grossStcgPaise: entityGrossStcgPaise,
      section112aExemptionPaise: exemptionAppliedPaise,
      taxableLtcgPaise,
      estimatedLtcgTaxPaise,
      estimatedStcgTaxPaise,
      totalEstimatedTaxPaise: totalEntityTaxPaise,
    });
  }

  // 6. Calculate HUF / Multi-Entity Tax Harvest Benefit:
  // How much tax would the family pay if ALL assets were lumped under a single PAN entity?
  const singleEntityExemptionPaise =
    totalGrossLtcgPaise > SECTION_112A_EXEMPTION_PAISE
      ? SECTION_112A_EXEMPTION_PAISE
      : totalGrossLtcgPaise;
  const singleEntityTaxableLtcgPaise = totalGrossLtcgPaise - singleEntityExemptionPaise;
  const singleEntityLtcgTaxPaise = BigInt(
    Math.round(Number(singleEntityTaxableLtcgPaise) * EQUITY_LTCG_RATE)
  );
  const singleEntityStcgTaxPaise = BigInt(
    Math.round(Number(totalGrossStcgPaise) * EQUITY_STCG_RATE)
  );
  const singleEntityTotalTaxPaise = singleEntityLtcgTaxPaise + singleEntityStcgTaxPaise;

  const hufTaxHarvestBenefitPaise =
    singleEntityTotalTaxPaise > combinedFamilyTaxPaise
      ? singleEntityTotalTaxPaise - combinedFamilyTaxPaise
      : 0n;

  return {
    totalFamilyWealthPaise,
    activeMemberCount: members.length,
    activeAccountCount: accounts.length,
    memberDistributions,
    accountDistributions,
    entityTaxSummaries,
    totalFamilyTaxPaise: combinedFamilyTaxPaise,
    hufTaxHarvestBenefitPaise,
  };
}
