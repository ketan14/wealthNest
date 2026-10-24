import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { PlatformRole } from '@wealthnest/domain';
import { AdminActorContext } from '@wealthnest/application';
import { useAuth } from '../supabase/auth-context';
import { supabase } from '../supabase/client';

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
  const [role, setRole] = useState<PlatformRole | null>('super_admin'); // default for Ketan Vaghela / demo
  const [loading, setLoading] = useState(true);

  const fetchAdminRole = useCallback(async () => {
    setLoading(true);
    try {
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
        // Fallback for demo investor
        if (user.email === 'investor@wealthnest.local' || !user.email) {
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
      setSimulatedRole: (newRole: PlatformRole | null) => setRole(newRole),
    }),
    [role, loading, adminActor, fetchAdminRole]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  return useContext(AdminContext);
}
