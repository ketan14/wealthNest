import { Result } from '@wealthnest/shared';
import { UserId, UserProfile, UserPreferences } from '@wealthnest/domain';

export interface UserRepositoryPort {
  getById(id: UserId): Promise<Result<UserProfile | null>>;
  save(user: UserProfile): Promise<Result<void>>;
  updatePreferences(id: UserId, preferences: Partial<UserPreferences>): Promise<Result<UserProfile>>;
}
