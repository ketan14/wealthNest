import { Result } from '@wealthnest/shared';
import { HoldingEntity, HoldingId, UserId } from '@wealthnest/domain';

export interface HoldingRepositoryPort {
  listByUser(userId: UserId): Promise<Result<HoldingEntity[]>>;
  getById(id: HoldingId): Promise<Result<HoldingEntity | null>>;
  save(holding: HoldingEntity): Promise<Result<void>>;
}
