import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  SupportSession,
  calculateRemainingSeconds,
  formatRemainingSessionTime,
  SUPPORT_SESSION_WARNING_THRESHOLD_SECONDS,
} from '@wealthnest/domain';
import {
  StartSupportSessionUseCase,
  EndSupportSessionUseCase,
  GetSupportUserDataUseCase,
  SupportUserDataBundle,
} from '@wealthnest/application';
import { isOk } from '@wealthnest/shared';
import { useAdmin } from './admin-context';
import { supportSessionAdapter } from '../supabase/support-session.adapter';
import { adminAuditLogAdapter } from '../supabase/admin.adapter';

interface SupportSessionContextType {
  isSupportModeActive: boolean;
  activeSession: SupportSession | null;
  targetUser: { id: string; displayName: string; email: string } | null;
  remainingSeconds: number;
  formattedTimeRemaining: string;
  isExpiringSoon: boolean;
  supportData: SupportUserDataBundle | null;
  loading: boolean;
  startSupportSession: (
    targetUserId: string,
    targetName: string,
    reason: string
  ) => Promise<{ success: boolean; error?: string }>;
  endSupportSession: () => Promise<void>;
  refreshSupportData: () => Promise<void>;
}

const SupportSessionContext = createContext<SupportSessionContextType>({
  isSupportModeActive: false,
  activeSession: null,
  targetUser: null,
  remainingSeconds: 0,
  formattedTimeRemaining: '00:00',
  isExpiringSoon: false,
  supportData: null,
  loading: false,
  startSupportSession: async () => ({ success: false, error: 'Provider not initialized' }),
  endSupportSession: async () => {},
  refreshSupportData: async () => {},
});

const STORAGE_KEY = 'wealthnest_active_support_session';

export function SupportSessionProvider({ children }: { children: React.ReactNode }) {
  const { adminActor } = useAdmin();
  const [activeSession, setActiveSession] = useState<SupportSession | null>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SupportSession;
        if (calculateRemainingSeconds(parsed.expiresAt) > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore parsing errors
    }
    return null;
  });

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    return activeSession ? calculateRemainingSeconds(activeSession.expiresAt) : 0;
  });

  const [supportData, setSupportData] = useState<SupportUserDataBundle | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Synchronize remaining time on 1-second interval
  useEffect(() => {
    if (!activeSession) {
      setRemainingSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const secondsLeft = calculateRemainingSeconds(activeSession.expiresAt);
      setRemainingSeconds(secondsLeft);

      if (secondsLeft <= 0) {
        clearInterval(interval);
        // Auto-end expired session
        handleAutoExpire(activeSession.id);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  const handleAutoExpire = useCallback(async (sessionId: string) => {
    try {
      await supportSessionAdapter.endSession(sessionId);
    } catch {
      // ignore
    }
    sessionStorage.removeItem(STORAGE_KEY);
    setActiveSession(null);
    setSupportData(null);
    setRemainingSeconds(0);
  }, []);

  const fetchSupportData = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const useCase = new GetSupportUserDataUseCase(supportSessionAdapter);
      const res = await useCase.execute(sessionId);
      if (isOk(res)) {
        setSupportData(res.value);
      }
    } catch (err) {
      console.error('Failed to load support user data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch support data whenever active session starts or is restored
  useEffect(() => {
    if (activeSession && activeSession.status === 'active') {
      fetchSupportData(activeSession.id);
    } else {
      setSupportData(null);
    }
  }, [activeSession, fetchSupportData]);

  const startSupportSession = useCallback(
    async (
      targetUserId: string,
      targetName: string,
      reason: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!adminActor) {
        return { success: false, error: 'Administrator authentication required' };
      }

      setLoading(true);
      try {
        const useCase = new StartSupportSessionUseCase(
          supportSessionAdapter,
          adminAuditLogAdapter
        );

        const result = await useCase.execute(adminActor, {
          targetUserId,
          targetName,
          reason,
        });

        if (isOk(result)) {
          const session = result.value;
          setActiveSession(session);
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
          setRemainingSeconds(calculateRemainingSeconds(session.expiresAt));
          return { success: true };
        } else {
          return { success: false, error: result.error.message };
        }
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to start support session' };
      } finally {
        setLoading(false);
      }
    },
    [adminActor]
  );

  const endSupportSession = useCallback(async () => {
    if (!activeSession) return;

    setLoading(true);
    try {
      if (adminActor) {
        const useCase = new EndSupportSessionUseCase(
          supportSessionAdapter,
          adminAuditLogAdapter
        );
        await useCase.execute(adminActor, {
          sessionId: activeSession.id,
          targetUserId: activeSession.targetUserId,
          targetName: activeSession.targetName,
        });
      } else {
        await supportSessionAdapter.endSession(activeSession.id);
      }
    } catch (err) {
      console.error('Error terminating support session:', err);
    } finally {
      sessionStorage.removeItem(STORAGE_KEY);
      setActiveSession(null);
      setSupportData(null);
      setRemainingSeconds(0);
      setLoading(false);
    }
  }, [activeSession, adminActor]);

  const targetUser = useMemo(() => {
    if (!activeSession) return null;
    return {
      id: activeSession.targetUserId,
      displayName: activeSession.targetName,
      email: activeSession.targetEmail,
    };
  }, [activeSession]);

  const formattedTimeRemaining = useMemo(() => {
    return formatRemainingSessionTime(remainingSeconds);
  }, [remainingSeconds]);

  const isExpiringSoon = useMemo(() => {
    return (
      activeSession !== null &&
      remainingSeconds > 0 &&
      remainingSeconds <= SUPPORT_SESSION_WARNING_THRESHOLD_SECONDS
    );
  }, [activeSession, remainingSeconds]);

  const value = useMemo<SupportSessionContextType>(
    () => ({
      isSupportModeActive: activeSession !== null && remainingSeconds > 0,
      activeSession,
      targetUser,
      remainingSeconds,
      formattedTimeRemaining,
      isExpiringSoon,
      supportData,
      loading,
      startSupportSession,
      endSupportSession,
      refreshSupportData: () => (activeSession ? fetchSupportData(activeSession.id) : Promise.resolve()),
    }),
    [
      activeSession,
      targetUser,
      remainingSeconds,
      formattedTimeRemaining,
      isExpiringSoon,
      supportData,
      loading,
      startSupportSession,
      endSupportSession,
      fetchSupportData,
    ]
  );

  return <SupportSessionContext.Provider value={value}>{children}</SupportSessionContext.Provider>;
}

export function useSupportSession() {
  return useContext(SupportSessionContext);
}
