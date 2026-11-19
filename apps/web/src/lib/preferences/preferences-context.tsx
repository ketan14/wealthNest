import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  UserPreferences,
  DEFAULT_USER_PREFERENCES,
  Money,
  UserId,
  CURRENCIES,
  CurrencyCode,
} from '@wealthnest/domain';
import { useAuth } from '../supabase/auth-context';
import { userAdapter } from '../supabase/user.adapter';

const LEGAL_NAME_STORAGE_PREFIX = 'wealthnest_legal_name_';

function readStoredLegalName(userId: string): string {
  try {
    return window.localStorage.getItem(`${LEGAL_NAME_STORAGE_PREFIX}${userId}`) || '';
  } catch {
    return '';
  }
}

function writeStoredLegalName(userId: string, legalName: string): void {
  try {
    const key = `${LEGAL_NAME_STORAGE_PREFIX}${userId}`;
    if (legalName) {
      window.localStorage.setItem(key, legalName);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore storage errors
  }
}

interface PreferencesContextType {
  preferences: UserPreferences;
  currencyCode: CurrencyCode;
  currencySymbol: string;
  displayName: string;
  legalName: string;
  email: string;
  isLoading: boolean;
  updatePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  updateLegalName: (name: string) => Promise<void>;
  formatAmount: (cents: number | bigint, options?: { compact?: boolean }) => string;
  resetPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType>({
  preferences: DEFAULT_USER_PREFERENCES,
  currencyCode: 'INR',
  currencySymbol: '₹',
  displayName: 'WealthNest Investor',
  legalName: '',
  email: 'investor@wealthnest.in',
  isLoading: false,
  updatePreferences: async () => {},
  updateDisplayName: async () => {},
  updateLegalName: async () => {},
  formatAmount: () => '',
  resetPreferences: async () => {},
});

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = (user?.id || 'demo-user-001') as UserId;

  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [displayName, setDisplayName] = useState<string>('WealthNest Investor');
  const [legalName, setLegalName] = useState<string>(() => readStoredLegalName(userId));
  const [email, setEmail] = useState<string>(user?.email || 'investor@wealthnest.in');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load preferences from adapter on mount or user change
  useEffect(() => {
    let mounted = true;
    const storedLegal = readStoredLegalName(userId);
    const fallbackLegal =
      storedLegal ||
      (typeof user?.user_metadata?.legal_name === 'string' ? user.user_metadata.legal_name : '');
    setLegalName(fallbackLegal);

    userAdapter.getById(userId).then((res) => {
      if (!mounted) return;
      if (res.success && res.value) {
        if (res.value.preferences) {
          setPreferences(res.value.preferences);
        }
        if (res.value.displayName) {
          setDisplayName(res.value.displayName);
        } else if (user?.user_metadata?.full_name) {
          setDisplayName(user.user_metadata.full_name);
        }
        // Unify email: prefer live Supabase Auth session email over fallback DB placeholder
        const profileEmail =
          res.value.email && res.value.email !== 'user@wealthnest.local' ? res.value.email : '';
        setEmail(user?.email || profileEmail || 'investor@wealthnest.in');
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
    const trimmed = name.trim();
    setDisplayName(trimmed);
    await userAdapter.save({
      id: userId,
      email: user?.email || email,
      displayName: trimmed,
      defaultCurrency: preferences.defaultCurrency,
      preferences,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const updateLegalNameHandler = async (name: string) => {
    const trimmed = name.trim();
    setLegalName(trimmed);
    writeStoredLegalName(userId, trimmed);
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
        legalName,
        email,
        isLoading,
        updatePreferences: updatePreferencesHandler,
        updateDisplayName: updateDisplayNameHandler,
        updateLegalName: updateLegalNameHandler,
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
