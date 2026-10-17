import { Result } from '@wealthnest/shared';
import { UserId, UserProfile } from '@wealthnest/domain';

export interface UserRepositoryPort {
  getById(id: UserId): Promise<Result<UserProfile | null>>;
  save(user: UserProfile): Promise<Result<void>>;
}
