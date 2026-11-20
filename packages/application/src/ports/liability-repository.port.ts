import { Result } from '@wealthnest/shared';
import {
  LoanType,
  InterestType,
  LiabilityStatus,
  AssetLiabilityLinkType,
  LiabilityPartyShareInput,
  RecordVisibility,
} from '@wealthnest/domain';

export interface LiabilityDto {
  readonly id: string;
  readonly householdId?: string;
  readonly userId: string;
  readonly visibility?: RecordVisibility;
  readonly createdBy?: string;
  readonly name: string;
  readonly loanType: LoanType;
  readonly lender: string;
  readonly accountNumber?: string;
  readonly originalPrincipalCents: bigint;
  readonly currentBalanceCents: bigint;
  readonly interestRate: number;
  readonly interestType: InterestType;
  readonly tenureMonths?: number;
  readonly emiAmountCents: bigint;
  readonly currency: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly status: LiabilityStatus;
  readonly linkedAssetId?: string;
  readonly linkedAssetName?: string;
  readonly memberId?: string;
  readonly coBorrowerMemberIds?: readonly string[];
  readonly parties?: readonly LiabilityPartyShareInput[];
  readonly notes?: string;
  readonly lastBalanceDate?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LiabilityBalanceDto {
  readonly id: string;
  readonly householdId?: string;
  readonly liabilityId: string;
  readonly userId: string;
  readonly balanceCents: bigint;
  readonly asOfDate: string;
  readonly source: string;
  readonly notes?: string;
  readonly createdAt: string;
}

export interface AssetValuationDto {
  readonly id: string;
  readonly householdId?: string;
  readonly assetId: string;
  readonly userId: string;
  readonly valuationCents: bigint;
  readonly currency: string;
  readonly asOfDate: string;
  readonly source: string;
  readonly notes?: string;
  readonly createdAt: string;
}

export interface AssetLiabilityLinkDto {
  readonly id: string;
  readonly householdId?: string;
  readonly userId: string;
  readonly assetId: string;
  readonly liabilityId: string;
  readonly linkType: AssetLiabilityLinkType;
  readonly ownershipSharePercentage: number;
  readonly createdAt: string;
}

export interface CreateLiabilityParams {
  readonly userId: string;
  readonly householdId?: string;
  readonly visibility?: RecordVisibility;
  readonly name: string;
  readonly loanType: LoanType;
  readonly lender: string;
  readonly accountNumber?: string;
  readonly originalPrincipalCents: bigint;
  readonly initialBalanceCents?: bigint;
  readonly interestRate: number;
  readonly interestType?: InterestType;
  readonly tenureMonths?: number;
  readonly emiAmountCents?: bigint;
  readonly currency?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly status?: LiabilityStatus;
  readonly linkedAssetId?: string;
  readonly memberId?: string;
  readonly coBorrowerMemberIds?: readonly string[];
  readonly parties?: readonly LiabilityPartyShareInput[];
  readonly restrictedGranteeUserIds?: readonly string[];
  readonly notes?: string;
}

export interface UpdateLiabilityParams {
  readonly id: string;
  readonly userId: string;
  readonly householdId?: string;
  readonly visibility?: RecordVisibility;
  readonly name?: string;
  readonly loanType?: LoanType;
  readonly lender?: string;
  readonly accountNumber?: string;
  readonly originalPrincipalCents?: bigint;
  readonly currentBalanceCents?: bigint;
  readonly interestRate?: number;
  readonly interestType?: InterestType;
  readonly tenureMonths?: number;
  readonly emiAmountCents?: bigint;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly status?: LiabilityStatus;
  readonly linkedAssetId?: string | null;
  readonly memberId?: string;
  readonly coBorrowerMemberIds?: readonly string[];
  readonly parties?: readonly LiabilityPartyShareInput[];
  readonly notes?: string;
}

export interface RecordLiabilityBalanceParams {
  readonly liabilityId: string;
  readonly userId: string;
  readonly householdId?: string;
  readonly balanceCents: bigint;
  readonly asOfDate: string;
  readonly source?: string;
  readonly notes?: string;
}

export interface RecordAssetValuationParams {
  readonly assetId: string;
  readonly userId: string;
  readonly householdId?: string;
  readonly valuationCents: bigint;
  readonly currency?: string;
  readonly asOfDate: string;
  readonly source?: string;
  readonly notes?: string;
}

export interface LiabilityRepositoryPort {
  listLiabilitiesByUser(scopeId: string): Promise<Result<readonly LiabilityDto[]>>;
  listLiabilitiesByHousehold?(householdId: string): Promise<Result<readonly LiabilityDto[]>>;
  getLiabilityById(id: string, scopeId: string): Promise<Result<LiabilityDto | null>>;
  createLiability(params: CreateLiabilityParams): Promise<Result<LiabilityDto>>;
  updateLiability(params: UpdateLiabilityParams): Promise<Result<LiabilityDto>>;
  deleteLiability(id: string, scopeId: string): Promise<Result<void>>;
  setLiabilityParties?(
    liabilityId: string,
    parties: readonly LiabilityPartyShareInput[]
  ): Promise<Result<void>>;

  recordLiabilityBalance(
    params: RecordLiabilityBalanceParams
  ): Promise<Result<LiabilityBalanceDto>>;
  recordEmiPaymentAtomic?(params: {
    readonly liabilityId: string;
    readonly paymentDate: string;
    readonly totalAmountCents: bigint;
    readonly principalCents: bigint;
    readonly interestCents: bigint;
    readonly extraPaymentCents?: bigint;
    readonly newBalanceCents?: bigint;
    readonly notes?: string;
  }): Promise<Result<{
    readonly success: boolean;
    readonly paymentId: string;
    readonly balanceId: string;
    readonly remainingBalanceCents: bigint;
    readonly status: string;
  }>>;
  listLiabilityBalances(
    liabilityId: string,
    scopeId: string
  ): Promise<Result<readonly LiabilityBalanceDto[]>>;

  recordAssetValuation(params: RecordAssetValuationParams): Promise<Result<AssetValuationDto>>;
  listAssetValuations(
    assetId: string,
    scopeId: string
  ): Promise<Result<readonly AssetValuationDto[]>>;

  listAssetLiabilityLinks(scopeId: string): Promise<Result<readonly AssetLiabilityLinkDto[]>>;
  linkAssetLiability(params: {
    userId: string;
    householdId?: string;
    assetId: string;
    liabilityId: string;
    linkType?: AssetLiabilityLinkType;
    ownershipSharePercentage?: number;
  }): Promise<Result<void>>;
  unlinkAssetLiability(scopeId: string, assetId: string, liabilityId: string): Promise<Result<void>>;
}
