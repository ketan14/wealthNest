import { Result, ok, err, isOk } from '@wealthnest/shared';
import {
  UserId,
  UserProfile,
  UserPreferences,
  DEFAULT_USER_PREFERENCES,
} from '@wealthnest/domain';
import { UserRepositoryPort } from '../ports/user-repository.port.js';

export class ManageUserSettingsUseCase {
  constructor(private readonly userRepo: UserRepositoryPort) {}

  async getUserProfile(userId: string): Promise<Result<UserProfile>> {
    try {
      const res = await this.userRepo.getById(userId as UserId);
      if (isOk(res) && res.value) {
        return ok(res.value);
      }

      // Default fallback profile for demo / initial state
      const fallback: UserProfile = {
        id: userId as UserId,
        email: 'user@wealthnest.local',
        displayName: 'WealthNest User',
        defaultCurrency: 'INR',
        preferences: DEFAULT_USER_PREFERENCES,
        createdAt: new Date().toISOString(),
      };
      return ok(fallback);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to retrieve user profile'));
    }
  }

  async updateDisplayName(userId: string, displayName: string): Promise<Result<UserProfile>> {
    try {
      const profileRes = await this.getUserProfile(userId);
      if (!isOk(profileRes)) return profileRes;

      const updated: UserProfile = {
        ...profileRes.value,
        displayName: displayName.trim(),
        updatedAt: new Date().toISOString(),
      };

      const saveRes = await this.userRepo.save(updated);
      if (!isOk(saveRes)) return err(saveRes.error);

      return ok(updated);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to update display name'));
    }
  }

  async updatePreferences(
    userId: string,
    partialPrefs: Partial<UserPreferences>
  ): Promise<Result<UserProfile>> {
    try {
      const profileRes = await this.getUserProfile(userId);
      if (!isOk(profileRes)) return profileRes;

      const current = profileRes.value;
      const mergedPrefs: UserPreferences = {
        ...(current.preferences || DEFAULT_USER_PREFERENCES),
        ...partialPrefs,
      };

      const updated: UserProfile = {
        ...current,
        defaultCurrency: mergedPrefs.defaultCurrency,
        preferences: mergedPrefs,
        updatedAt: new Date().toISOString(),
      };

      const saveRes = await this.userRepo.updatePreferences(userId as UserId, partialPrefs);
      if (!isOk(saveRes)) {
        // Still attempt save via general save
        await this.userRepo.save(updated);
      }

      return ok(updated);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to update preferences'));
    }
  }
}
