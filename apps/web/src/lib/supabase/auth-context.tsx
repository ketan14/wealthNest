import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { QueryClientContext } from '@tanstack/react-query';
import { supabase } from './client';
import { connectionManager } from '../services/connection-manager';


interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isPasswordRecovery: false,
  clearPasswordRecovery: () => {},
  signOut: async () => {},
});

/**
 * Provides Supabase Auth session state, password recovery tracking, and cache-clearing sign-out.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useContext(QueryClientContext);
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  useEffect(() => {
    const syncUserTransition = (nextUser: User | null) => {
      const nextUserId = nextUser?.id ?? null;
      if (lastUserIdRef.current !== null && lastUserIdRef.current !== nextUserId) {
        queryClientRef.current?.clear();
      }
      lastUserIdRef.current = nextUserId;
    };

    let activeAuthSub: { unsubscribe: () => void } | null = null;
    let isDisposed = false;

    const bindActiveClientAuth = () => {
      activeAuthSub?.unsubscribe();
      activeAuthSub = null;

      // Initial session retrieval for the active SupabaseClient
      supabase.auth
        .getSession()
        .then(({ data: { session: activeSession } }) => {
          if (isDisposed) return;
          if (activeSession?.user) {
            syncUserTransition(activeSession.user);
            setSession(activeSession);
            setUser(activeSession.user);
          } else {
            syncUserTransition(null);
            setSession(null);
            setUser(null);
          }
          setIsLoading(false);
        })
        .catch(() => {
          if (isDisposed) return;
          syncUserTransition(null);
          setSession(null);
          setUser(null);
          setIsLoading(false);
        });

      // Listen for auth state changes on the active SupabaseClient
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (isDisposed) return;
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
        } else {
          syncUserTransition(null);
          setSession(null);
          setUser(null);
        }
        setIsLoading(false);
      });

      activeAuthSub = subscription;
    };

    bindActiveClientAuth();

    // Re-bind auth listeners if ConnectionManager switches endpoints (e.g. LoginPage switcher)
    const unsubConfig = connectionManager.subscribeConfig(() => {
      bindActiveClientAuth();
    });

    return () => {
      isDisposed = true;
      activeAuthSub?.unsubscribe();
      unsubConfig();
    };
  }, []);

  const signOut = async () => {
    setIsPasswordRecovery(false);
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore network failure when signing out
    }
    queryClientRef.current?.clear();
    lastUserIdRef.current = null;
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isPasswordRecovery,
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
