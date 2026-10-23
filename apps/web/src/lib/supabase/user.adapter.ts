import { Result, ok, err } from '@wealthnest/shared';
import {
  UserId,
  UserProfile,
  UserPreferences,
  DEFAULT_USER_PREFERENCES,
} from '@wealthnest/domain';
import { UserRepositoryPort } from '@wealthnest/application';
import { supabase } from './client';

const LOCAL_STORAGE_PREFS_KEY = 'wealthnest_user_preferences';
const LOCAL_STORAGE_PROFILE_KEY = 'wealthnest_user_profile';

export class SupabaseUserAdapter implements UserRepositoryPort {
  async getById(id: UserId): Promise<Result<UserProfile | null>> {
    try {
      // 1. Try local cache first for instant responsiveness
      let localCachedProfile: UserProfile | null = null;
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
        if (stored) {
          localCachedProfile = JSON.parse(stored);
        }
      } catch {
        // ignore localStorage errors in non-browser envs
      }

      // 2. Return local default/cached profile for demo users without making a PostgreSQL query
      if (!id || id.startsWith('demo-')) {
        if (localCachedProfile) return ok(localCachedProfile);
        return ok({
          id,
          email: 'investor@wealthnest.in',
          displayName: 'WealthNest Investor',
          defaultCurrency: 'INR',
          preferences: DEFAULT_USER_PREFERENCES,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // 3. Fetch from Supabase profiles table for authenticated users
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // Fallback to local cache if network/supabase is unreachable
        if (localCachedProfile) return ok(localCachedProfile);
      }

      if (!data) {
        if (localCachedProfile) return ok(localCachedProfile);
        return ok(null);
      }

      // Extract preferences stored in metadata or JSON
      let preferences = DEFAULT_USER_PREFERENCES;
      try {
        const storedPrefs = localStorage.getItem(LOCAL_STORAGE_PREFS_KEY);
        if (storedPrefs) {
          preferences = { ...preferences, ...JSON.parse(storedPrefs) };
        }
      } catch {
        // fallback
      }

      const profile: UserProfile = {
        id: data.id as UserId,
        email: data.email || 'user@wealthnest.local',
        displayName: data.display_name || 'WealthNest Investor',
        defaultCurrency: data.default_currency || preferences.defaultCurrency,
        preferences: {
          ...preferences,
          defaultCurrency: (data.default_currency as any) || preferences.defaultCurrency,
        },
        createdAt: data.created_at || new Date().toISOString(),
        updatedAt: data.updated_at || new Date().toISOString(),
      };

      try {
        localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
      } catch {
        // ignore
      }

      return ok(profile);
    } catch (e: any) {
      return err(new Error(e?.message || 'Error fetching user profile'));
    }
  }

  async save(user: UserProfile): Promise<Result<void>> {
    try {
      try {
        localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(user));
        if (user.preferences) {
          localStorage.setItem(LOCAL_STORAGE_PREFS_KEY, JSON.stringify(user.preferences));
        }
      } catch {
        // ignore
      }

      if (!user.id || user.id.startsWith('demo-')) {
        return ok(undefined);
      }

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        display_name: user.displayName,
        default_currency: user.defaultCurrency,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        // If Supabase is in mock/offline mode, we still consider save succeeded locally
        console.warn('Supabase profile upsert warning (offline mode fallback):', error.message);
      }

      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Error saving user profile'));
    }
  }

  async updatePreferences(
    id: UserId,
    partialPrefs: Partial<UserPreferences>
  ): Promise<Result<UserProfile>> {
    try {
      const existingRes = await this.getById(id);
      const existing = existingRes.success && existingRes.value ? existingRes.value : {
        id,
        email: 'user@wealthnest.local',
        displayName: 'WealthNest Investor',
        defaultCurrency: 'INR',
        preferences: DEFAULT_USER_PREFERENCES,
        createdAt: new Date().toISOString(),
      };

      const updatedPrefs: UserPreferences = {
        ...(existing.preferences || DEFAULT_USER_PREFERENCES),
        ...partialPrefs,
      };

      const updatedProfile: UserProfile = {
        ...existing,
        defaultCurrency: updatedPrefs.defaultCurrency,
        preferences: updatedPrefs,
        updatedAt: new Date().toISOString(),
      };

      await this.save(updatedProfile);
      return ok(updatedProfile);
    } catch (e: any) {
      return err(new Error(e?.message || 'Error updating preferences'));
    }
  }
}

export const userAdapter = new SupabaseUserAdapter();
