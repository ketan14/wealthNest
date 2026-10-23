import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  UserPreferences,
  DEFAULT_USER_PREFERENCES,
  Money,
  UserId,
} from '@wealthnest/domain';
import { useAuth } from '../supabase/auth-context';
import { userAdapter } from '../supabase/user.adapter';

interface PreferencesContextType {
  preferences: UserPreferences;
  displayName: string;
  email: string;
  isLoading: boolean;
  updatePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  formatAmount: (cents: number | bigint, options?: { compact?: boolean }) => string;
  resetPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType>({
  preferences: DEFAULT_USER_PREFERENCES,
  displayName: 'WealthNest Investor',
  email: 'investor@wealthnest.in',
  isLoading: false,
  updatePreferences: async () => {},
  updateDisplayName: async () => {},
  formatAmount: () => '',
  resetPreferences: async () => {},
});

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = (user?.id || 'demo-user-001') as UserId;

  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [displayName, setDisplayName] = useState<string>('WealthNest Investor');
  const [email, setEmail] = useState<string>('investor@wealthnest.in');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load preferences from adapter on mount or user change
  useEffect(() => {
    let mounted = true;
    userAdapter.getById(userId).then((res) => {
      if (!mounted) return;
      if (res.success && res.value) {
        if (res.value.preferences) {
          setPreferences(res.value.preferences);
        }
        if (res.value.displayName) {
          setDisplayName(res.value.displayName);
        }
        if (res.value.email) {
          setEmail(res.value.email);
        }
      } else if (user) {
        setEmail(user.email || 'investor@wealthnest.in');
        setDisplayName(user.user_metadata?.full_name || 'WealthNest Investor');
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [userId, user]);

  const updatePreferencesHandler = async (partial: Partial<UserPreferences>) => {
    const updated = { ...preferences, ...partial };
    setPreferences(updated);
    await userAdapter.updatePreferences(userId, partial);
  };

  const updateDisplayNameHandler = async (name: string) => {
    setDisplayName(name);
    await userAdapter.save({
      id: userId,
      email,
      displayName: name,
      defaultCurrency: preferences.defaultCurrency,
      preferences,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const resetPreferencesHandler = async () => {
    setPreferences(DEFAULT_USER_PREFERENCES);
    await userAdapter.updatePreferences(userId, DEFAULT_USER_PREFERENCES);
  };

  const formatAmount = useMemo(() => {
    return (cents: number | bigint, options?: { compact?: boolean }): string => {
      const money = Money.fromCents(cents, preferences.defaultCurrency);
      if (options?.compact) {
        if (preferences.defaultCurrency === 'INR') {
          return money.formatIndianCompact();
        }
        return money.format(preferences.numberFormat);
      }
      return money.format(preferences.numberFormat);
    };
  }, [preferences.defaultCurrency, preferences.numberFormat]);

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        displayName,
        email,
        isLoading,
        updatePreferences: updatePreferencesHandler,
        updateDisplayName: updateDisplayNameHandler,
        formatAmount,
        resetPreferences: resetPreferencesHandler,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
