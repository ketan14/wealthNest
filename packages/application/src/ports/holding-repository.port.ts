import { Result } from '@wealthnest/shared';
import type { HoldingOwnerShareInput, RecordVisibility } from '@wealthnest/domain';

export interface HoldingDetailDto {
  readonly holdingId: string;
  readonly assetId: string;
  readonly householdId?: string;
  readonly visibility?: RecordVisibility;
  readonly createdBy?: string;
  readonly name: string;
  readonly ticker?: string;
  readonly isin?: string;
  readonly assetClassId: string;
  readonly assetClassName: string;
  readonly assetClassColor: string;
  readonly quantity: number;
  readonly unitCostCents: number;
  readonly currentValueCents: number;
  readonly currency: string;
  readonly updatedAt: string;
  readonly dematAccountId?: string;
  readonly folioNumber?: string;
  readonly amcName?: string;
  readonly schemePlan?: string;
  readonly costBasisVerified?: boolean;
  readonly memberId?: string;
  readonly accountId?: string;
  readonly owners?: readonly HoldingOwnerShareInput[];
}

export interface CreateHoldingParams {
  readonly userId: string;
  readonly householdId?: string;
  readonly visibility?: RecordVisibility;
  readonly name: string;
  readonly ticker?: string;
  readonly isin?: string;
  readonly assetClassId: string;
  readonly currency: string;
  readonly quantity: number;
  readonly unitCostCents: number;
  readonly currentValueCents: number;
  readonly dematAccountId?: string;
  readonly folioNumber?: string;
  readonly amcName?: string;
  readonly schemePlan?: string;
  readonly costBasisVerified?: boolean;
  readonly memberId?: string;
  readonly accountId?: string;
  readonly ownerShares?: readonly HoldingOwnerShareInput[];
  readonly restrictedGranteeUserIds?: readonly string[];
}

export interface UpdateHoldingValuesParams {
  readonly holdingId: string;
  readonly userId: string;
  readonly householdId?: string;
  readonly visibility?: RecordVisibility;
  readonly quantity: number;
  readonly unitCostCents: number;
  readonly currentValueCents: number;
  readonly ownerShares?: readonly HoldingOwnerShareInput[];
}

export interface HoldingRepositoryPort {
  listDetailsByUser(scopeId: string): Promise<Result<HoldingDetailDto[]>>;
  listDetailsByHousehold?(householdId: string): Promise<Result<HoldingDetailDto[]>>;
  createHoldingWithAsset(params: CreateHoldingParams): Promise<Result<HoldingDetailDto>>;
  deleteHolding(holdingId: string, scopeId: string): Promise<Result<void>>;
  updateHoldingValues?(params: UpdateHoldingValuesParams): Promise<Result<void>>;
  setHoldingOwners?(
    holdingId: string,
    owners: readonly HoldingOwnerShareInput[]
  ): Promise<Result<void>>;
}
