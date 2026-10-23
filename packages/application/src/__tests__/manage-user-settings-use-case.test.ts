import { describe, it, expect, vi } from 'vitest';
import { ok, err } from '@wealthnest/shared';
import { ManageUserSettingsUseCase } from '../use-cases/manage-user-settings.js';
import { UserRepositoryPort } from '../ports/user-repository.port.js';
import { DEFAULT_USER_PREFERENCES } from '@wealthnest/domain';

describe('ManageUserSettingsUseCase', () => {
  it('retrieves user profile with defaults when user is found or fallback applies', async () => {
    const mockRepo: UserRepositoryPort = {
      getById: vi.fn().mockResolvedValue(
        ok({
          id: 'u-1',
          email: 'aarav@example.com',
          displayName: 'Aarav Sharma',
          defaultCurrency: 'INR',
          preferences: DEFAULT_USER_PREFERENCES,
          createdAt: '2026-01-01T00:00:00Z',
        })
      ),
      save: vi.fn(),
      updatePreferences: vi.fn(),
    };

    const useCase = new ManageUserSettingsUseCase(mockRepo);
    const result = await useCase.getUserProfile('u-1');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.displayName).toBe('Aarav Sharma');
    expect(result.value.preferences?.numberFormat).toBe('en-IN');
  });

  it('updates display name successfully', async () => {
    let savedProfile: any = null;
    const mockRepo: UserRepositoryPort = {
      getById: vi.fn().mockResolvedValue(
        ok({
          id: 'u-1',
          email: 'aarav@example.com',
          displayName: 'Aarav Sharma',
          defaultCurrency: 'INR',
          createdAt: '2026-01-01T00:00:00Z',
        })
      ),
      save: vi.fn().mockImplementation((profile) => {
        savedProfile = profile;
        return Promise.resolve(ok(undefined));
      }),
      updatePreferences: vi.fn(),
    };

    const useCase = new ManageUserSettingsUseCase(mockRepo);
    const result = await useCase.updateDisplayName('u-1', 'Aarav K. Sharma');

    expect(result.success).toBe(true);
    expect(savedProfile.displayName).toBe('Aarav K. Sharma');
    expect(savedProfile.updatedAt).toBeDefined();
  });

  it('updates user preferences with partial merge', async () => {
    const mockRepo: UserRepositoryPort = {
      getById: vi.fn().mockResolvedValue(
        ok({
          id: 'u-1',
          email: 'aarav@example.com',
          displayName: 'Aarav Sharma',
          defaultCurrency: 'INR',
          preferences: DEFAULT_USER_PREFERENCES,
          createdAt: '2026-01-01T00:00:00Z',
        })
      ),
      save: vi.fn().mockResolvedValue(ok(undefined)),
      updatePreferences: vi.fn().mockResolvedValue(ok({} as any)),
    };

    const useCase = new ManageUserSettingsUseCase(mockRepo);
    const result = await useCase.updatePreferences('u-1', {
      defaultCurrency: 'USD',
      numberFormat: 'en-US',
      taxRegime: 'old',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.defaultCurrency).toBe('USD');
    expect(result.value.preferences?.numberFormat).toBe('en-US');
    expect(result.value.preferences?.taxRegime).toBe('old');
    // Unchanged field remains default
    expect(result.value.preferences?.fiscalYearStart).toBe('04-01');
  });
});
