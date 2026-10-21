import { Result } from '@wealthnest/shared';
import {
  LoanType,
  InterestType,
  LiabilityStatus,
  AssetLiabilityLinkType,
} from '@wealthnest/domain';

export interface LiabilityDto {
  readonly id: string;
  readonly userId: string;
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
  readonly notes?: string;
  readonly lastBalanceDate?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LiabilityBalanceDto {
  readonly id: string;
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
  readonly userId: string;
  readonly assetId: string;
  readonly liabilityId: string;
  readonly linkType: AssetLiabilityLinkType;
  readonly ownershipSharePercentage: number;
  readonly createdAt: string;
}

export interface CreateLiabilityParams {
  readonly userId: string;
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
  readonly notes?: string;
}

export interface UpdateLiabilityParams {
  readonly id: string;
  readonly userId: string;
  readonly name?: string;
  readonly loanType?: LoanType;
  readonly lender?: string;
  readonly accountNumber?: string;
  readonly interestRate?: number;
  readonly interestType?: InterestType;
  readonly tenureMonths?: number;
  readonly emiAmountCents?: bigint;
  readonly status?: LiabilityStatus;
  readonly linkedAssetId?: string | null;
  readonly notes?: string;
}

export interface RecordLiabilityBalanceParams {
  readonly liabilityId: string;
  readonly userId: string;
  readonly balanceCents: bigint;
  readonly asOfDate: string;
  readonly source?: string;
  readonly notes?: string;
}

export interface RecordAssetValuationParams {
  readonly assetId: string;
  readonly userId: string;
  readonly valuationCents: bigint;
  readonly currency?: string;
  readonly asOfDate: string;
  readonly source?: string;
  readonly notes?: string;
}

export interface LiabilityRepositoryPort {
  listLiabilitiesByUser(userId: string): Promise<Result<readonly LiabilityDto[]>>;
  getLiabilityById(id: string, userId: string): Promise<Result<LiabilityDto | null>>;
  createLiability(params: CreateLiabilityParams): Promise<Result<LiabilityDto>>;
  updateLiability(params: UpdateLiabilityParams): Promise<Result<LiabilityDto>>;
  deleteLiability(id: string, userId: string): Promise<Result<void>>;

  recordLiabilityBalance(
    params: RecordLiabilityBalanceParams
  ): Promise<Result<LiabilityBalanceDto>>;
  listLiabilityBalances(
    liabilityId: string,
    userId: string
  ): Promise<Result<readonly LiabilityBalanceDto[]>>;

  recordAssetValuation(params: RecordAssetValuationParams): Promise<Result<AssetValuationDto>>;
  listAssetValuations(
    assetId: string,
    userId: string
  ): Promise<Result<readonly AssetValuationDto[]>>;

  listAssetLiabilityLinks(userId: string): Promise<Result<readonly AssetLiabilityLinkDto[]>>;
  linkAssetLiability(params: {
    userId: string;
    assetId: string;
    liabilityId: string;
    linkType?: AssetLiabilityLinkType;
    ownershipSharePercentage?: number;
  }): Promise<Result<void>>;
  unlinkAssetLiability(userId: string, assetId: string, liabilityId: string): Promise<Result<void>>;
}
