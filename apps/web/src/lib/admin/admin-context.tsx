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
  const [role, setRole] = useState<PlatformRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAdminRole = useCallback(async () => {
    setLoading(true);
    try {
      if (!user) {
        setRole(null);
        return;
      }

      // Query database for authoritative platform admin role
      const { data, error } = await supabase.rpc('get_platform_admin_role', {
        check_user_id: user.id,
      });

      if (!error && data) {
        setRole(data as PlatformRole);
      } else {
        setRole(null);
      }
    } catch {
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAdminRole();
  }, [fetchAdminRole]);

  const setSimulatedRole = useCallback((_newRole: PlatformRole | null) => {
    // Client-side role simulation is disabled for security; roles are enforced server-side.
  }, []);

  const adminActor = useMemo<AdminActorContext | null>(() => {
    if (!role || !user) return null;
    return {
      userId: user.id,
      role,
      displayName: user.user_metadata?.display_name || user.email || 'Admin',
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
