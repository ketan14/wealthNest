import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOk, isErr } from '@wealthnest/shared';
import {
  AdminUserSummary,
  AdminUserDetail,
  AdminDashboardStats,
  AdminHouseholdSummary,
  PaginatedResult,
} from '@wealthnest/domain';
import { AdminRepositoryPort } from '../ports/admin-repository.port.js';
import { AdminAuditLogPort } from '../ports/admin-audit-log.port.js';
import {
  ListAdminUsersUseCase,
  GetAdminUserDetailUseCase,
  ChangeUserStatusUseCase,
  InviteUserUseCase,
  RequestUserPasswordResetUseCase,
  AdminActorContext,
} from '../use-cases/admin/manage-admin-users.js';
import { ManagePlatformRoleUseCase } from '../use-cases/admin/manage-platform-roles.js';
import {
  GetAdminDashboardStatsUseCase,
  ListAdminHouseholdsUseCase,
  ListAdminAuditLogsUseCase,
} from '../use-cases/admin/get-admin-analytics.js';

describe('Admin Application Layer Use Cases', () => {
  let mockAdminRepo: AdminRepositoryPort;
  let mockAuditRepo: AdminAuditLogPort;

  const superAdminActor: AdminActorContext = {
    userId: 'admin-ketan-vaghela',
    role: 'super_admin',
    displayName: 'Ketan Vaghela',
    ipAddress: '127.0.0.1',
  };

  const supportAdminActor: AdminActorContext = {
    userId: 'support-parul-vaghela',
    role: 'support_admin',
    displayName: 'Parul Vaghela',
    ipAddress: '127.0.0.1',
  };

  const auditorActor: AdminActorContext = {
    userId: 'auditor-ramilaben-vaghela',
    role: 'auditor',
    displayName: 'Ramilaben Vaghela',
    ipAddress: '127.0.0.1',
  };

  const sampleUser: AdminUserSummary = {
    id: 'user-shamalbhai-vaghela',
    email: 'shamalbhai.vaghela@wealthnest.local',
    displayName: 'Shamalbhai Vaghela HUF',
    status: 'active',
    createdAt: '2026-10-01T10:00:00Z',
    householdCount: 1,
  };

  beforeEach(() => {
    mockAdminRepo = {
      listUsers: vi.fn().mockResolvedValue({
        items: [sampleUser],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
      getUserDetail: vi.fn().mockResolvedValue({
        ...sampleUser,
        defaultCurrency: 'INR',
        households: [
          {
            id: 'h-vaghela-01',
            name: 'Vaghela Household',
            householdRole: 'member',
            joinedAt: '2026-10-01T10:00:00Z',
            totalMembers: 4,
          },
        ],
        recentAudits: [],
      } as AdminUserDetail),
      setUserStatus: vi.fn().mockResolvedValue(undefined),
      managePlatformRole: vi.fn().mockResolvedValue(undefined),
      inviteUser: vi.fn().mockResolvedValue({ userId: 'new-user-krisha-vaghela' }),
      requestPasswordReset: vi.fn().mockResolvedValue({ success: true, recoveryEmailSent: true }),
      getDashboardStats: vi.fn().mockResolvedValue({
        totalUsers: 5,
        activeUsers: 4,
        suspendedUsers: 1,
        invitedUsers: 0,
        totalHouseholds: 2,
        totalAuditEvents: 12,
      } as AdminDashboardStats),
      listHouseholds: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'h-vaghela-01',
            name: 'Vaghela Household',
            createdByName: 'Ketan Vaghela',
            createdAt: '2026-10-01T10:00:00Z',
            memberCount: 4,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as PaginatedResult<AdminHouseholdSummary>),
      getActiveSuperAdminCount: vi.fn().mockResolvedValue(2),
    };

    mockAuditRepo = {
      recordLog: vi.fn().mockResolvedValue('audit-log-id-123'),
      listLogs: vi.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 30,
        totalPages: 0,
      }),
    };
  });

  describe('ListAdminUsersUseCase', () => {
    it('returns paginated users when requested by authorized admin', async () => {
      const useCase = new ListAdminUsersUseCase(mockAdminRepo);
      const res = await useCase.execute(superAdminActor, { page: 1, limit: 20 });

      expect(isOk(res)).toBe(true);
      if (isOk(res)) {
        expect(res.value.items).toHaveLength(1);
        expect(res.value.items[0].displayName).toBe('Shamalbhai Vaghela HUF');
      }
    });

    it('rejects unauthenticated or unprivileged actors', async () => {
      const useCase = new ListAdminUsersUseCase(mockAdminRepo);
      const res = await useCase.execute({ ...superAdminActor, role: undefined as any }, { page: 1, limit: 20 });

      expect(isErr(res)).toBe(true);
    });
  });

  describe('GetAdminUserDetailUseCase', () => {
    it('returns user detail without leaking private financial records', async () => {
      const useCase = new GetAdminUserDetailUseCase(mockAdminRepo);
      const res = await useCase.execute(supportAdminActor, sampleUser.id);

      expect(isOk(res)).toBe(true);
      if (isOk(res)) {
        expect(res.value.id).toBe(sampleUser.id);
        expect(res.value.households).toHaveLength(1);
        // Financial fields must not exist
        expect((res.value as any).holdings).toBeUndefined();
        expect((res.value as any).transactions).toBeUndefined();
      }
    });
  });

  describe('ChangeUserStatusUseCase', () => {
    it('prevents self-suspension by an administrator and writes an audit log', async () => {
      const useCase = new ChangeUserStatusUseCase(mockAdminRepo, mockAuditRepo);
      const res = await useCase.execute(superAdminActor, {
        targetUserId: superAdminActor.userId, // Self!
        targetEmail: 'ketan.vaghela@wealthnest.local',
        newStatus: 'suspended',
        reasonCode: 'SECURITY_TEST',
      });

      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.message).toMatch(/cannot suspend or deactivate your own account/i);
      }
      expect(mockAdminRepo.setUserStatus).not.toHaveBeenCalled();
      expect(mockAuditRepo.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'denied',
          reasonCode: 'INVARIANT_VIOLATION',
        })
      );
    });

    it('requires a reason code when suspending an account', async () => {
      const useCase = new ChangeUserStatusUseCase(mockAdminRepo, mockAuditRepo);
      const res = await useCase.execute(superAdminActor, {
        targetUserId: sampleUser.id,
        targetEmail: sampleUser.email,
        newStatus: 'suspended',
        reasonCode: '', // Missing!
      });

      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.message).toMatch(/reason code is required/i);
      }
      expect(mockAdminRepo.setUserStatus).not.toHaveBeenCalled();
    });

    it('successfully suspends user when reason is provided and logs audit', async () => {
      const useCase = new ChangeUserStatusUseCase(mockAdminRepo, mockAuditRepo);
      const res = await useCase.execute(supportAdminActor, {
        targetUserId: sampleUser.id,
        targetEmail: sampleUser.email,
        newStatus: 'suspended',
        reasonCode: 'SUSPICIOUS_LOGIN_ATTEMPTS',
        reasonDetails: 'Multiple failed MFA challenges',
      });

      expect(isOk(res)).toBe(true);
      expect(mockAdminRepo.setUserStatus).toHaveBeenCalledWith(
        sampleUser.id,
        'suspended',
        'SUSPICIOUS_LOGIN_ATTEMPTS',
        'Multiple failed MFA challenges'
      );
      expect(mockAuditRepo.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_STATUS_CHANGE',
          outcome: 'success',
          reasonCode: 'SUSPICIOUS_LOGIN_ATTEMPTS',
        })
      );
    });

    it('denies auditors from changing user statuses', async () => {
      const useCase = new ChangeUserStatusUseCase(mockAdminRepo, mockAuditRepo);
      const res = await useCase.execute(auditorActor, {
        targetUserId: sampleUser.id,
        targetEmail: sampleUser.email,
        newStatus: 'active',
      });

      expect(isErr(res)).toBe(true);
      expect(mockAuditRepo.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'denied', reasonCode: 'INSUFFICIENT_PERMISSIONS' })
      );
    });
  });

  describe('InviteUserUseCase', () => {
    it('validates email syntax and creates onboarding invitation with audit trail', async () => {
      const useCase = new InviteUserUseCase(mockAdminRepo, mockAuditRepo);
      const res = await useCase.execute(superAdminActor, {
        email: 'krisha.vaghela@wealthnest.local',
        displayName: 'Krisha Vaghela',
      });

      expect(isOk(res)).toBe(true);
      expect(mockAdminRepo.inviteUser).toHaveBeenCalledWith(
        'krisha.vaghela@wealthnest.local',
        'Krisha Vaghela',
        undefined
      );
      expect(mockAuditRepo.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_INVITED',
          outcome: 'success',
        })
      );
    });

    it('rejects invalid email formats', async () => {
      const useCase = new InviteUserUseCase(mockAdminRepo, mockAuditRepo);
      const res = await useCase.execute(superAdminActor, {
        email: 'invalid-email-format',
        displayName: 'Invalid User',
      });

      expect(isErr(res)).toBe(true);
    });
  });

  describe('RequestUserPasswordResetUseCase', () => {
    it('requests recovery reset and records administrative audit', async () => {
      const useCase = new RequestUserPasswordResetUseCase(mockAdminRepo, mockAuditRepo);
      const res = await useCase.execute(superAdminActor, sampleUser.id, sampleUser.email);

      expect(isOk(res)).toBe(true);
      expect(mockAdminRepo.requestPasswordReset).toHaveBeenCalledWith(sampleUser.id);
      expect(mockAuditRepo.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_RESET_REQUESTED',
          outcome: 'success',
        })
      );
    });
  });

  describe('ManagePlatformRoleUseCase', () => {
    it('restricts role grants strictly to super_admin', async () => {
      const useCase = new ManagePlatformRoleUseCase(mockAdminRepo, mockAuditRepo);
      const res = await useCase.execute(supportAdminActor, {
        targetUserId: sampleUser.id,
        targetEmail: sampleUser.email,
        role: 'support_admin',
        action: 'grant',
      });

      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.message).toMatch(/Only super_admin can grant or revoke/i);
      }
    });

    it('prevents revoking the last active super_admin', async () => {
      vi.mocked(mockAdminRepo.getActiveSuperAdminCount).mockResolvedValueOnce(1);
      const useCase = new ManagePlatformRoleUseCase(mockAdminRepo, mockAuditRepo);
      const res = await useCase.execute(superAdminActor, {
        targetUserId: superAdminActor.userId,
        targetEmail: 'ketan.vaghela@wealthnest.local',
        role: 'super_admin',
        action: 'revoke',
      });

      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.message).toMatch(/Cannot revoke the last active super_admin/i);
      }
      expect(mockAdminRepo.managePlatformRole).not.toHaveBeenCalled();
    });

    it('successfully grants role when initiated by super_admin', async () => {
      const useCase = new ManagePlatformRoleUseCase(mockAdminRepo, mockAuditRepo);
      const res = await useCase.execute(superAdminActor, {
        targetUserId: sampleUser.id,
        targetEmail: sampleUser.email,
        role: 'support_admin',
        action: 'grant',
      });

      expect(isOk(res)).toBe(true);
      expect(mockAdminRepo.managePlatformRole).toHaveBeenCalledWith(sampleUser.id, 'support_admin', 'grant');
      expect(mockAuditRepo.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ROLE_GRANTED',
          outcome: 'success',
        })
      );
    });
  });

  describe('Admin Analytics & Auditing Use Cases', () => {
    it('GetAdminDashboardStatsUseCase retrieves system stats', async () => {
      const useCase = new GetAdminDashboardStatsUseCase(mockAdminRepo);
      const res = await useCase.execute(superAdminActor);

      expect(isOk(res)).toBe(true);
      if (isOk(res)) {
        expect(res.value.totalUsers).toBe(5);
        expect(res.value.activeUsers).toBe(4);
      }
    });

    it('ListAdminHouseholdsUseCase retrieves paginated households', async () => {
      const useCase = new ListAdminHouseholdsUseCase(mockAdminRepo);
      const res = await useCase.execute(superAdminActor, { page: 1, limit: 20 });

      expect(isOk(res)).toBe(true);
      if (isOk(res)) {
        expect(res.value.items).toHaveLength(1);
        expect(res.value.items[0].name).toBe('Vaghela Household');
      }
    });

    it('ListAdminAuditLogsUseCase retrieves audit trail', async () => {
      const useCase = new ListAdminAuditLogsUseCase(mockAuditRepo);
      const res = await useCase.execute(superAdminActor, { page: 1, limit: 30 });

      expect(isOk(res)).toBe(true);
      expect(mockAuditRepo.listLogs).toHaveBeenCalled();
    });
  });
});
