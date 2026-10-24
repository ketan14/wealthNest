import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOk, isErr } from '@wealthnest/shared';
import {
  SupportSession,
  SupportUserSummary,
  SupportHoldingItem,
  SupportLiabilityItem,
  SupportGoalItem,
  SupportTransactionItem,
} from '@wealthnest/domain';
import { SupportSessionPort } from '../ports/support-session.port.js';
import { AdminAuditLogPort } from '../ports/admin-audit-log.port.js';
import { AdminActorContext } from '../use-cases/admin/manage-admin-users.js';
import {
  StartSupportSessionUseCase,
  EndSupportSessionUseCase,
  GetSupportUserDataUseCase,
} from '../use-cases/admin/manage-support-session.js';

describe('Support Session Application Use Cases', () => {
  let mockSupportPort: SupportSessionPort;
  let mockAuditRepo: AdminAuditLogPort;

  const superAdminActor: AdminActorContext = {
    userId: 'admin-ketan-vaghela',
    role: 'super_admin',
    displayName: 'Ketan Vaghela',
    ipAddress: '127.0.0.1',
  };

  const supportAdminActor: AdminActorContext = {
    userId: 'support-admin-parul',
    role: 'support_admin',
    displayName: 'Parul Vaghela',
    ipAddress: '127.0.0.1',
  };

  const auditorActor: AdminActorContext = {
    userId: 'auditor-ramilaben',
    role: 'auditor',
    displayName: 'Ramilaben Vaghela',
    ipAddress: '127.0.0.1',
  };

  const targetUserId = 'user-shamalbhai-vaghela';
  const targetName = 'Shamalbhai Vaghela HUF';

  const sampleSession: SupportSession = {
    id: 'sess-1234-5678-90ab',
    adminUserId: superAdminActor.userId,
    targetUserId,
    targetName,
    targetEmail: 'shamalbhai.vaghela@wealthnest.local',
    reason: 'Investigating Section 112A capital gains report issue',
    status: 'active',
    createdAt: '2026-10-24T10:00:00Z',
    expiresAt: '2026-10-24T10:15:00Z',
    ttlMinutes: 15,
  };

  beforeEach(() => {
    mockSupportPort = {
      startSession: vi.fn().mockResolvedValue(sampleSession),
      endSession: vi.fn().mockResolvedValue({ success: true, status: 'ended' }),
      getSupportSummary: vi.fn().mockResolvedValue({
        userId: targetUserId,
        profile: {
          id: targetUserId,
          email: 'shamalbhai.vaghela@wealthnest.local',
          displayName: targetName,
          defaultCurrency: 'INR',
        },
        holdingsCount: 5,
        totalInvestmentPaise: 50000000,
        totalCurrentValuePaise: 65000000,
        liabilitiesCount: 0,
        totalDebtPaise: 0,
        netWorthPaise: 65000000,
        goalsCount: 2,
        transactionsCount: 12,
      } as SupportUserSummary),
      getSupportPortfolio: vi.fn().mockResolvedValue([
        {
          id: 'hold-1',
          symbol: 'HDFCBANK',
          assetClass: 'equity',
          quantity: 100,
          averagePricePaise: 150000,
          currentNavOrPricePaise: 165000,
          investedValuePaise: 15000000,
          currentValuePaise: 16500000,
          unrealizedGainPaise: 1500000,
          source: 'manual',
          asOfDate: '2026-10-24',
        },
      ] as SupportHoldingItem[]),
      getSupportLiabilities: vi.fn().mockResolvedValue([] as SupportLiabilityItem[]),
      getSupportGoals: vi.fn().mockResolvedValue([
        {
          id: 'goal-1',
          name: "Krisha's Higher Education",
          category: 'education',
          targetAmountPaise: 250000000,
          currentAmountPaise: 80000000,
          targetDate: '2037-06-01',
          status: 'active',
        },
      ] as SupportGoalItem[]),
      getSupportTransactions: vi.fn().mockResolvedValue([
        {
          id: 'tx-1',
          type: 'BUY',
          symbol: 'HDFCBANK',
          amountPaise: 15000000,
          units: 100,
          pricePaise: 150000,
          transactionDate: '2026-09-01',
        },
      ] as SupportTransactionItem[]),
    };

    mockAuditRepo = {
      recordLog: vi.fn().mockResolvedValue('audit-log-id'),
      listLogs: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10, totalPages: 0 }),
    };
  });

  describe('StartSupportSessionUseCase', () => {
    it('successfully initiates support session for super_admin and records audit log', async () => {
      const useCase = new StartSupportSessionUseCase(mockSupportPort, mockAuditRepo);
      const res = await useCase.execute(superAdminActor, {
        targetUserId,
        targetName,
        reason: 'Investigating Section 112A capital gains report issue',
      });

      expect(isOk(res)).toBe(true);
      if (isOk(res)) {
        expect(res.value.id).toBe(sampleSession.id);
        expect(res.value.status).toBe('active');
        expect(res.value.ttlMinutes).toBe(15);
      }

      expect(mockSupportPort.startSession).toHaveBeenCalledWith(
        superAdminActor.userId,
        targetUserId,
        'Investigating Section 112A capital gains report issue'
      );
      expect(mockAuditRepo.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SUPPORT_SESSION_STARTED',
          outcome: 'success',
          actorUserId: superAdminActor.userId,
          targetUserId,
        })
      );
    });

    it('successfully initiates support session for support_admin', async () => {
      const useCase = new StartSupportSessionUseCase(mockSupportPort, mockAuditRepo);
      const res = await useCase.execute(supportAdminActor, {
        targetUserId,
        targetName,
        reason: 'Verifying portfolio sync discrepancy reported on Slack',
      });

      expect(isOk(res)).toBe(true);
      expect(mockSupportPort.startSession).toHaveBeenCalled();
    });

    it('denies initiation for auditor role and records denial audit log', async () => {
      const useCase = new StartSupportSessionUseCase(mockSupportPort, mockAuditRepo);
      const res = await useCase.execute(auditorActor, {
        targetUserId,
        targetName,
        reason: 'Attempting to inspect user portfolio as auditor',
      });

      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.message).toContain('Insufficient platform permissions');
      }

      expect(mockSupportPort.startSession).not.toHaveBeenCalled();
      expect(mockAuditRepo.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SUPPORT_SESSION_STARTED',
          outcome: 'denied',
          reasonCode: 'INSUFFICIENT_PERMISSIONS',
        })
      );
    });

    it('rejects self-impersonation when adminId equals targetUserId', async () => {
      const useCase = new StartSupportSessionUseCase(mockSupportPort, mockAuditRepo);
      const res = await useCase.execute(superAdminActor, {
        targetUserId: superAdminActor.userId,
        targetName: superAdminActor.displayName,
        reason: 'Attempting self support view session',
      });

      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.message).toContain('cannot initiate a support view session for your own administrator account');
      }

      expect(mockSupportPort.startSession).not.toHaveBeenCalled();
      expect(mockAuditRepo.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SUPPORT_SESSION_STARTED',
          outcome: 'denied',
          reasonCode: 'INVARIANT_VIOLATION',
        })
      );
    });

    it('rejects reason shorter than 8 characters', async () => {
      const useCase = new StartSupportSessionUseCase(mockSupportPort, mockAuditRepo);
      const res = await useCase.execute(superAdminActor, {
        targetUserId,
        targetName,
        reason: 'short',
      });

      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.message).toContain('minimum 8 characters');
      }
      expect(mockSupportPort.startSession).not.toHaveBeenCalled();
    });
  });

  describe('EndSupportSessionUseCase', () => {
    it('successfully ends support session and logs audit entry', async () => {
      const useCase = new EndSupportSessionUseCase(mockSupportPort, mockAuditRepo);
      const res = await useCase.execute(superAdminActor, {
        sessionId: sampleSession.id,
        targetUserId,
        targetName,
      });

      expect(isOk(res)).toBe(true);
      expect(mockSupportPort.endSession).toHaveBeenCalledWith(sampleSession.id);
      expect(mockAuditRepo.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SUPPORT_SESSION_ENDED',
          outcome: 'success',
          safeMetadata: expect.objectContaining({
            sessionId: sampleSession.id,
          }),
        })
      );
    });
  });

  describe('GetSupportUserDataUseCase', () => {
    it('aggregates portfolio, summary, liabilities, goals, and transactions bundle', async () => {
      const useCase = new GetSupportUserDataUseCase(mockSupportPort);
      const res = await useCase.execute(sampleSession.id);

      expect(isOk(res)).toBe(true);
      if (isOk(res)) {
        expect(res.value.summary.holdingsCount).toBe(5);
        expect(res.value.portfolio).toHaveLength(1);
        expect(res.value.portfolio[0].symbol).toBe('HDFCBANK');
        expect(res.value.goals).toHaveLength(1);
        expect(res.value.goals[0].name).toBe("Krisha's Higher Education");
        expect(res.value.transactions).toHaveLength(1);
      }

      expect(mockSupportPort.getSupportSummary).toHaveBeenCalledWith(sampleSession.id);
      expect(mockSupportPort.getSupportPortfolio).toHaveBeenCalledWith(sampleSession.id);
      expect(mockSupportPort.getSupportLiabilities).toHaveBeenCalledWith(sampleSession.id);
      expect(mockSupportPort.getSupportGoals).toHaveBeenCalledWith(sampleSession.id);
      expect(mockSupportPort.getSupportTransactions).toHaveBeenCalledWith(sampleSession.id, 50);
    });
  });
});
