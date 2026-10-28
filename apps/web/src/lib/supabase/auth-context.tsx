import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './client';
import { isTauri } from '../tauri/tauri-runtime';

export const OFFLINE_MODE_STORAGE_KEY = 'wealthnest_offline_mode';
export const LOCAL_VAULT_USER_ID = 'usr-local-vault';

export const DEFAULT_OFFLINE_USER: User = {
  id: LOCAL_VAULT_USER_ID,
  app_metadata: { provider: 'local_sqlite', providers: ['local_sqlite'] },
  user_metadata: {
    full_name: 'Ketan Vaghela',
    display_name: 'Ketan Vaghela',
    household: 'Vaghela Household',
  },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  email: 'investor@wealthnest.local',
  role: 'authenticated',
};

export function isOfflineLocalActive(): boolean {
  if (isTauri()) return true;
  try {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(OFFLINE_MODE_STORAGE_KEY) === 'true';
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isOfflineUser: boolean;
  enableOfflineUser: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isOfflineUser: false,
  enableOfflineUser: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialOffline = isOfflineLocalActive();
  const [user, setUser] = useState<User | null>(() =>
    initialOffline ? DEFAULT_OFFLINE_USER : null
  );
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(!initialOffline);

  useEffect(() => {
    const offlineDefault = isOfflineLocalActive();

    // Initial session retrieval
    supabase.auth
      .getSession()
      .then(({ data: { session: activeSession } }) => {
        if (activeSession?.user) {
          setSession(activeSession);
          setUser(activeSession.user);
        } else if (offlineDefault) {
          setSession(null);
          setUser(DEFAULT_OFFLINE_USER);
        } else {
          setSession(null);
          setUser(null);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (offlineDefault) {
          setUser(DEFAULT_OFFLINE_USER);
        }
        setIsLoading(false);
      });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession?.user) {
        setSession(nextSession);
        setUser(nextSession.user);
      } else if (isOfflineLocalActive()) {
        setSession(null);
        setUser(DEFAULT_OFFLINE_USER);
      } else {
        setSession(null);
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const enableOfflineUser = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(OFFLINE_MODE_STORAGE_KEY, 'true');
      }
    } catch {
      // ignore
    }
    setSession(null);
    setUser(DEFAULT_OFFLINE_USER);
  }, []);

  const signOut = async () => {
    try {
      if (typeof window !== 'undefined' && !isTauri()) {
        window.localStorage.removeItem(OFFLINE_MODE_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore network failure when signing out offline
    }
    if (isTauri()) {
      setSession(null);
      setUser(DEFAULT_OFFLINE_USER);
    } else {
      setSession(null);
      setUser(null);
    }
  };

  const isOfflineUser = user?.id === LOCAL_VAULT_USER_ID;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isOfflineUser,
        enableOfflineUser,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
