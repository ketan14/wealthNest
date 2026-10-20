import { Result } from '@wealthnest/shared';

export interface HoldingDetailDto {
  readonly holdingId: string;
  readonly assetId: string;
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
}

export interface CreateHoldingParams {
  readonly userId: string;
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
}

export interface HoldingRepositoryPort {
  listDetailsByUser(userId: string): Promise<Result<HoldingDetailDto[]>>;
  createHoldingWithAsset(params: CreateHoldingParams): Promise<Result<HoldingDetailDto>>;
  deleteHolding(holdingId: string, userId: string): Promise<Result<void>>;
}
