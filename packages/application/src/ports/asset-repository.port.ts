import { Result } from '@wealthnest/shared';
import { AssetHolding, AssetId, UserId } from '@wealthnest/domain';

export interface AssetRepositoryPort {
  listByUser(userId: UserId): Promise<Result<AssetHolding[]>>;
  getById(id: AssetId): Promise<Result<AssetHolding | null>>;
}
