import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { UserPreferences, DEFAULT_USER_PREFERENCES, Money, UserId, CURRENCIES, CurrencyCode } from '@wealthnest/domain';
import { useAuth } from '../supabase/auth-context';
import { userAdapter } from '../supabase/user.adapter';

interface PreferencesContextType {
  preferences: UserPreferences;
  currencyCode: CurrencyCode;
  currencySymbol: string;
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
  currencyCode: 'INR',
  currencySymbol: '₹',
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
    const previous = preferences;
    setPreferences({ ...preferences, ...partial });
    const res = await userAdapter.updatePreferences(userId, partial);
    if (!res.success) {
      // Don't pretend a change was saved when it wasn't: roll back so a refresh matches the UI
      console.error('Failed to save preferences:', res.error.message);
      setPreferences(previous);
    }
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

  const currencyCode = preferences.defaultCurrency || 'INR';
  const currencySymbol = CURRENCIES[currencyCode]?.symbol || '₹';

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        currencyCode,
        currencySymbol,
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
