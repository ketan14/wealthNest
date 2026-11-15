import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import {
  HouseholdRole,
  HouseholdSummary,
  canHouseholdRoleEditFinancials,
  canHouseholdRoleManageAdminsOrTransfer,
  canHouseholdRoleManageMembers,
} from '@wealthnest/domain';
import { isOk } from '@wealthnest/shared';
import { useAuth } from './auth-context';
import { useRepositories } from '../persistence/repository-context';
import { toValidUuidOrNull } from './uuid-utils';
import { clearCachedDefaultHousehold } from './household-scope';

const ACTIVE_HOUSEHOLD_STORAGE_PREFIX = 'wealthnest_active_household_';

export const DEMO_HOUSEHOLD_SUMMARY: HouseholdSummary = {
  id: 'demo-household-vaghela',
  name: 'Vaghela Family Household',
  role: 'primary_owner',
  status: 'active',
  isDefault: true,
  memberCount: 5,
};

interface HouseholdContextType {
  households: readonly HouseholdSummary[];
  activeHousehold: HouseholdSummary | null;
  activeHouseholdId: string | undefined;
  householdRole: HouseholdRole | undefined;
  isLoading: boolean;
  error: string | null;
  canEditFinancials: boolean;
  canManageMembers: boolean;
  canManageAdminsOrTransfer: boolean;
  switchHousehold: (householdId: string) => void;
  refreshHouseholds: (preferredHouseholdId?: string) => Promise<void>;
  createHousehold: (name: string) => Promise<HouseholdSummary | null>;
  renameHousehold: (householdId: string, name: string) => Promise<boolean>;
}

const HouseholdContext = createContext<HouseholdContextType>({
  households: [DEMO_HOUSEHOLD_SUMMARY],
  activeHousehold: DEMO_HOUSEHOLD_SUMMARY,
  activeHouseholdId: DEMO_HOUSEHOLD_SUMMARY.id,
  householdRole: 'primary_owner',
  isLoading: false,
  error: null,
  canEditFinancials: true,
  canManageMembers: true,
  canManageAdminsOrTransfer: true,
  switchHousehold: () => {},
  refreshHouseholds: async () => {},
  createHousehold: async () => null,
  renameHousehold: async () => false,
});

function readStoredHouseholdId(userId: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(`${ACTIVE_HOUSEHOLD_STORAGE_PREFIX}${userId}`);
  } catch {
    return null;
  }
}

function writeStoredHouseholdId(userId: string, householdId: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`${ACTIVE_HOUSEHOLD_STORAGE_PREFIX}${userId}`, householdId);
  } catch {
    // ignore storage errors
  }
}

function isInviteFlowActive(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname.startsWith('/invite') ||
    new URLSearchParams(window.location.search).has('invite')
  );
}

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { householdRepo, mode } = useRepositories();
  const queryClient = useContext(QueryClientContext);
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const userId = user?.id || 'demo-user-001';
  const [households, setHouseholds] = useState<readonly HouseholdSummary[]>(() =>
    !user?.id || user.id.startsWith('demo-') ? [DEMO_HOUSEHOLD_SUMMARY] : []
  );
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | undefined>(() =>
    !user?.id || user.id.startsWith('demo-') ? DEMO_HOUSEHOLD_SUMMARY.id : undefined
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const selectValidHousehold = useCallback(
    (list: readonly HouseholdSummary[], preferredId?: string) => {
      if (list.length === 0) {
        setActiveHouseholdId(undefined);
        return;
      }

      const storedId = readStoredHouseholdId(userId);
      const candidate =
        (preferredId && list.find((h) => h.id === preferredId)) ||
        (storedId && list.find((h) => h.id === storedId)) ||
        list.find((h) => h.isDefault) ||
        list[0];

      if (candidate) {
        setActiveHouseholdId((prev) => {
          if (prev && prev !== candidate.id) {
            queryClientRef.current?.clear();
          }
          return candidate.id;
        });
        writeStoredHouseholdId(userId, candidate.id);
      }
    },
    [userId]
  );

  const refreshHouseholds = useCallback(
    async (preferredHouseholdId?: string) => {
      if (authLoading) return;

      const isDemoOrUnauth = !user?.id || user.id.startsWith('demo-');
      if (isDemoOrUnauth && mode === 'supabase') {
        setHouseholds([DEMO_HOUSEHOLD_SUMMARY]);
        setActiveHouseholdId(DEMO_HOUSEHOLD_SUMMARY.id);
        setError(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        clearCachedDefaultHousehold();

        const res = await householdRepo.listMyHouseholds();
        if (!isOk(res)) {
          setError(res.error.message);
          setIsLoading(false);
          return;
        }

        let list = res.value;
        const hasValidUserUuid = Boolean(toValidUuidOrNull(user?.id));
        if (list.length === 0 && (mode === 'sqlite' || (hasValidUserUuid && !isInviteFlowActive()))) {
          const ensured = await householdRepo.ensureDefaultHousehold(
            (user?.user_metadata?.display_name as string | undefined) || undefined
          );
          if (isOk(ensured)) {
            const refetch = await householdRepo.listMyHouseholds();
            if (isOk(refetch)) {
              list = refetch.value;
            }
          }
        }

        setHouseholds(list);
        selectValidHousehold(list, preferredHouseholdId);
      } catch (e: any) {
        setError(e?.message || 'Failed to load households');
      } finally {
        setIsLoading(false);
      }
    },
    [authLoading, householdRepo, mode, selectValidHousehold, user?.id, user?.user_metadata?.display_name]
  );

  useEffect(() => {
    refreshHouseholds();
  }, [refreshHouseholds]);

  const switchHousehold = useCallback(
    (householdId: string) => {
      const target = households.find((h) => h.id === householdId);
      if (!target) return;
      if (activeHouseholdId !== householdId) {
        queryClientRef.current?.clear();
        setActiveHouseholdId(householdId);
      }
      writeStoredHouseholdId(userId, householdId);
    },
    [activeHouseholdId, households, userId]
  );

  const createHousehold = useCallback(
    async (name: string): Promise<HouseholdSummary | null> => {
      if (!user?.id || user.id.startsWith('demo-')) {
        if (mode === 'supabase') {
          const created: HouseholdSummary = {
            id: `demo-household-${Date.now()}`,
            name: name.trim(),
            role: 'primary_owner',
            status: 'active',
            memberCount: 1,
          };
          const nextList = [...households, created];
          setHouseholds(nextList);
          setActiveHouseholdId(created.id);
          return created;
        }
      }

      const res = await householdRepo.createHousehold(
        name,
        (user?.user_metadata?.display_name as string | undefined) || undefined
      );
      if (!isOk(res)) {
        setError(res.error.message);
        return null;
      }

      await refreshHouseholds(res.value.id);
      return res.value;
    },
    [householdRepo, households, mode, refreshHouseholds, user?.id, user?.user_metadata?.display_name]
  );

  const renameHousehold = useCallback(
    async (householdId: string, name: string): Promise<boolean> => {
      if (!user?.id || user.id.startsWith('demo-')) {
        if (mode === 'supabase') {
          setHouseholds((prev) =>
            prev.map((h) => (h.id === householdId ? { ...h, name: name.trim() } : h))
          );
          return true;
        }
      }

      const res = await householdRepo.renameHousehold(householdId, name);
      if (!isOk(res)) {
        setError(res.error.message);
        return false;
      }

      await refreshHouseholds(householdId);
      return true;
    },
    [householdRepo, mode, refreshHouseholds, user?.id]
  );

  const activeHousehold = useMemo(
    () => households.find((h) => h.id === activeHouseholdId) || households[0] || null,
    [activeHouseholdId, households]
  );

  const householdRole = activeHousehold?.role;
  const canEditFinancials = canHouseholdRoleEditFinancials(householdRole);
  const canManageMembers = canHouseholdRoleManageMembers(householdRole);
  const canManageAdminsOrTransfer = canHouseholdRoleManageAdminsOrTransfer(householdRole);

  const value = useMemo<HouseholdContextType>(
    () => ({
      households,
      activeHousehold,
      activeHouseholdId: activeHousehold?.id,
      householdRole,
      isLoading,
      error,
      canEditFinancials,
      canManageMembers,
      canManageAdminsOrTransfer,
      switchHousehold,
      refreshHouseholds,
      createHousehold,
      renameHousehold,
    }),
    [
      activeHousehold,
      canEditFinancials,
      canManageAdminsOrTransfer,
      canManageMembers,
      createHousehold,
      error,
      householdRole,
      households,
      isLoading,
      refreshHouseholds,
      renameHousehold,
      switchHousehold,
    ]
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold(): HouseholdContextType {
  return useContext(HouseholdContext);
}
