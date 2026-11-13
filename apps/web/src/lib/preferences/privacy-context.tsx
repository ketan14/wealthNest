import React, { createContext, useCallback, useContext, useState } from 'react';

const STORAGE_KEY = 'wealthnest_hide_balances';

interface PrivacyContextValue {
  hideBalances: boolean;
  toggleHideBalances: () => void;
  maskAmount: (formatted: string) => string;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  hideBalances: false,
  toggleHideBalances: () => {},
  maskAmount: (formatted: string) => formatted,
});

/**
 * Provides a persistent Privacy Mode toggle to mask sensitive currency figures in public.
 */
export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hideBalances, setHideBalances] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleHideBalances = useCallback(() => {
    setHideBalances((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const maskAmount = useCallback(
    (formatted: string) => (hideBalances ? '₹ ••••••' : formatted),
    [hideBalances]
  );

  return (
    <PrivacyContext.Provider value={{ hideBalances, toggleHideBalances, maskAmount }}>
      {children}
    </PrivacyContext.Provider>
  );
}

/**
 * Access Privacy Mode state and amount-masking helper.
 */
export function usePrivacy(): PrivacyContextValue {
  return useContext(PrivacyContext);
}

