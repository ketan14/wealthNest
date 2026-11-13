import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { QueryClientContext } from '@tanstack/react-query';
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

const isTestEnv = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';

export function isOfflineLocalActive(): boolean {
  // Offline local-vault mode is restricted to the Tauri desktop/mobile runtime (or tests).
  // Web browser sessions must authenticate against Supabase Auth.
  if (!isTauri() && !isTestEnv) {
    return false;
  }

  try {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(OFFLINE_MODE_STORAGE_KEY);
      if (stored !== null) {
        return stored === 'true';
      }
    }
  } catch {
    // ignore storage errors
  }

  // In test environment, keep Tauri defaulting to SQLite
  if (isTestEnv && isTauri()) {
    return true;
  }

  // In Tauri runtime: If a remote Supabase QA URL is bundled and not explicitly offline,
  // default to remote cloud authentication. Otherwise fallback to local SQLite offline mode.
  if (isTauri()) {
    const hasRemoteSupabase =
      typeof import.meta !== 'undefined' &&
      Boolean(import.meta.env?.VITE_SUPABASE_URL) &&
      import.meta.env?.VITE_APP_ENV !== 'offline';
    return !hasRemoteSupabase;
  }

  return false;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isOfflineUser: boolean;
  isPasswordRecovery: boolean;
  enableOfflineUser: () => void;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isOfflineUser: false,
  isPasswordRecovery: false,
  enableOfflineUser: () => {},
  clearPasswordRecovery: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useContext(QueryClientContext);
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const initialOffline = isOfflineLocalActive();
  const [user, setUser] = useState<User | null>(() =>
    initialOffline ? DEFAULT_OFFLINE_USER : null
  );
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(!initialOffline);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const lastUserIdRef = useRef<string | null>(initialOffline ? LOCAL_VAULT_USER_ID : null);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  useEffect(() => {
    const offlineDefault = isOfflineLocalActive();

    const syncUserTransition = (nextUser: User | null) => {
      const nextUserId = nextUser?.id ?? null;
      if (lastUserIdRef.current !== null && lastUserIdRef.current !== nextUserId) {
        queryClientRef.current?.clear();
      }
      lastUserIdRef.current = nextUserId;
    };

    // Initial session retrieval
    supabase.auth
      .getSession()
      .then(({ data: { session: activeSession } }) => {
        if (activeSession?.user) {
          syncUserTransition(activeSession.user);
          setSession(activeSession);
          setUser(activeSession.user);
        } else if (offlineDefault) {
          syncUserTransition(DEFAULT_OFFLINE_USER);
          setSession(null);
          setUser(DEFAULT_OFFLINE_USER);
        } else {
          syncUserTransition(null);
          setSession(null);
          setUser(null);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (offlineDefault) {
          syncUserTransition(DEFAULT_OFFLINE_USER);
          setUser(DEFAULT_OFFLINE_USER);
        }
        setIsLoading(false);
      });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
        queryClientRef.current?.clear();
      } else if (event === 'USER_UPDATED') {
        setIsPasswordRecovery(false);
      }

      if (nextSession?.user) {
        syncUserTransition(nextSession.user);
        setSession(nextSession);
        setUser(nextSession.user);
      } else if (isOfflineLocalActive()) {
        syncUserTransition(DEFAULT_OFFLINE_USER);
        setSession(null);
        setUser(DEFAULT_OFFLINE_USER);
      } else {
        syncUserTransition(null);
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
    if (!isTauri() && !isTestEnv) {
      return;
    }
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(OFFLINE_MODE_STORAGE_KEY, 'true');
      }
    } catch {
      // ignore
    }
    if (lastUserIdRef.current !== null && lastUserIdRef.current !== LOCAL_VAULT_USER_ID) {
      queryClientRef.current?.clear();
    }
    lastUserIdRef.current = LOCAL_VAULT_USER_ID;
    setSession(null);
    setUser(DEFAULT_OFFLINE_USER);
  }, []);

  const signOut = async () => {
    setIsPasswordRecovery(false);
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
    queryClientRef.current?.clear();
    if (isTauri() && isOfflineLocalActive()) {
      lastUserIdRef.current = LOCAL_VAULT_USER_ID;
      setSession(null);
      setUser(DEFAULT_OFFLINE_USER);
    } else {
      lastUserIdRef.current = null;
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
        isPasswordRecovery,
        enableOfflineUser,
        clearPasswordRecovery,
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
