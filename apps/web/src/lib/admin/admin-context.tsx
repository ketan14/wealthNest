import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { PlatformRole } from '@wealthnest/domain';
import { AdminActorContext } from '@wealthnest/application';
import { useAuth } from '../supabase/auth-context';
import { supabase } from '../supabase/client';

export const SIMULATED_ROLE_STORAGE_KEY = 'wealthnest_simulated_admin_role';

interface AdminContextType {
  currentAdminRole: PlatformRole | null;
  isSuperAdmin: boolean;
  isSupportAdmin: boolean;
  isAuditor: boolean;
  isAnyAdmin: boolean;
  loading: boolean;
  adminActor: AdminActorContext | null;
  refreshAdminStatus: () => Promise<void>;
  setSimulatedRole: (role: PlatformRole | null) => void;
}

const AdminContext = createContext<AdminContextType>({
  currentAdminRole: null,
  isSuperAdmin: false,
  isSupportAdmin: false,
  isAuditor: false,
  isAnyAdmin: false,
  loading: true,
  adminActor: null,
  refreshAdminStatus: async () => {},
  setSimulatedRole: () => {},
});

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [role, setRole] = useState<PlatformRole | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.sessionStorage.getItem(SIMULATED_ROLE_STORAGE_KEY);
        if (stored) return stored as PlatformRole;
      } catch {
        // ignore storage errors
      }
    }
    return 'super_admin';
  });
  const [loading, setLoading] = useState(true);

  const fetchAdminRole = useCallback(async () => {
    setLoading(true);
    try {
      // Check if session has an active simulated role
      let sessionSimulatedRole: PlatformRole | null = null;
      if (typeof window !== 'undefined') {
        try {
          const stored = window.sessionStorage.getItem(SIMULATED_ROLE_STORAGE_KEY);
          if (stored) sessionSimulatedRole = stored as PlatformRole;
        } catch {
          // ignore
        }
      }

      if (sessionSimulatedRole) {
        setRole(sessionSimulatedRole);
        setLoading(false);
        return;
      }

      if (!user) {
        // In local/demo mode without active session, Ketan Vaghela is super_admin
        setRole('super_admin');
        setLoading(false);
        return;
      }

      // Query database for platform admin role
      const { data, error } = await supabase.rpc('get_platform_admin_role', {
        check_user_id: user.id,
      });

      if (!error && data) {
        setRole(data as PlatformRole);
      } else {
        // Fallback for demo investor & administrative usernames
        const emailLower = user.email?.toLowerCase() || '';
        if (
          emailLower.includes('admin') ||
          emailLower === 'investor@wealthnest.local' ||
          !user.email
        ) {
          setRole('super_admin');
        } else {
          setRole(null);
        }
      }
    } catch {
      setRole('super_admin');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAdminRole();
  }, [fetchAdminRole]);

  const setSimulatedRole = useCallback((newRole: PlatformRole | null) => {
    setRole(newRole);
    if (typeof window !== 'undefined') {
      try {
        if (newRole) {
          window.sessionStorage.setItem(SIMULATED_ROLE_STORAGE_KEY, newRole);
        } else {
          window.sessionStorage.removeItem(SIMULATED_ROLE_STORAGE_KEY);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const adminActor = useMemo<AdminActorContext | null>(() => {
    if (!role) return null;
    return {
      userId: user?.id || '4c4fa116-57d5-4fc8-af89-be56b5069b50',
      role,
      displayName: user?.user_metadata?.display_name || 'Ketan Vaghela',
      ipAddress: '127.0.0.1',
    };
  }, [user, role]);

  const value = useMemo(
    () => ({
      currentAdminRole: role,
      isSuperAdmin: role === 'super_admin',
      isSupportAdmin: role === 'support_admin',
      isAuditor: role === 'auditor',
      isAnyAdmin: role !== null,
      loading,
      adminActor,
      refreshAdminStatus: fetchAdminRole,
      setSimulatedRole,
    }),
    [role, loading, adminActor, fetchAdminRole, setSimulatedRole]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  return useContext(AdminContext);
}
