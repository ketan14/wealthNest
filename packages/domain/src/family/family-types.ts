export type FamilyRelationship = 'self' | 'spouse' | 'huf' | 'child' | 'parent' | 'other';

export type DepositoryType = 'CDSL' | 'NSDL' | 'CAMS' | 'KFINTECH' | 'RBI' | 'OTHER';

export type AccountType = 'demat' | 'mutual_fund_folio' | 'savings_bank' | 'ppf_epf' | 'nps' | 'other';

export interface FamilyMember {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly relationship: FamilyRelationship;
  readonly panMasked?: string;
  readonly colorHex: string;
  readonly isPrimary: boolean;
  readonly notes?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface PortfolioAccount {
  readonly id: string;
  readonly userId: string;
  readonly memberId: string;
  readonly accountName: string;
  readonly brokerName: string;
  readonly depository: DepositoryType;
  readonly accountNumberMasked?: string;
  readonly accountType: AccountType;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface MemberWealthDistribution {
  readonly memberId: string;
  readonly memberName: string;
  readonly relationship: FamilyRelationship;
  readonly colorHex: string;
  readonly isPrimary: boolean;
  readonly totalWealthPaise: bigint;
  readonly percentageOfTotal: number;
  readonly holdingCount: number;
  readonly accountCount: number;
  readonly accounts: readonly PortfolioAccount[];
}

export interface AccountWealthDistribution {
  readonly accountId: string;
  readonly accountName: string;
  readonly brokerName: string;
  readonly depository: DepositoryType;
  readonly accountType: AccountType;
  readonly memberId: string;
  readonly memberName: string;
  readonly totalWealthPaise: bigint;
  readonly percentageOfTotal: number;
  readonly holdingCount: number;
}

export interface EntityTaxSummary {
  readonly memberId: string;
  readonly entityName: string;
  readonly relationship: FamilyRelationship;
  readonly panMasked?: string;
  readonly grossLtcgPaise: bigint;
  readonly grossStcgPaise: bigint;
  readonly section112aExemptionPaise: bigint; // Max ₹1,25,000 (12500000n paise) per PAN entity
  readonly taxableLtcgPaise: bigint;
  readonly estimatedLtcgTaxPaise: bigint; // 12.5%
  readonly estimatedStcgTaxPaise: bigint; // 20%
  readonly totalEstimatedTaxPaise: bigint;
}

export interface FamilyPortfolioSummary {
  readonly totalFamilyWealthPaise: bigint;
  readonly activeMemberCount: number;
  readonly activeAccountCount: number;
  readonly memberDistributions: readonly MemberWealthDistribution[];
  readonly accountDistributions: readonly AccountWealthDistribution[];
  readonly entityTaxSummaries: readonly EntityTaxSummary[];
  readonly totalFamilyTaxPaise: bigint;
  readonly hufTaxHarvestBenefitPaise: bigint; // Tax saved by having separate HUF PAN exemption
}
