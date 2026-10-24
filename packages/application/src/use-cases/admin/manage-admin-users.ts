import { Result, ok, err } from '@wealthnest/shared';
import {
  AdminUserSummary,
  AdminUserDetail,
  AdminPaginationParams,
  PaginatedResult,
  PlatformRole,
  UserAccessStatus,
  canModifyUserStatus,
  validateStatusChange,
  sanitizeAuditMetadata,
} from '@wealthnest/domain';
import { AdminRepositoryPort } from '../../ports/admin-repository.port.js';
import { AdminAuditLogPort } from '../../ports/admin-audit-log.port.js';

export interface AdminActorContext {
  userId: string;
  role: PlatformRole;
  displayName: string;
  ipAddress?: string;
}

export class ListAdminUsersUseCase {
  constructor(private readonly adminRepo: AdminRepositoryPort) {}

  async execute(
    actor: AdminActorContext,
    params: AdminPaginationParams
  ): Promise<Result<PaginatedResult<AdminUserSummary>>> {
    try {
      if (!actor.role) {
        return err(new Error('Access Denied: Missing platform administrative role'));
      }
      const result = await this.adminRepo.listUsers(params);
      return ok(result);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export class GetAdminUserDetailUseCase {
  constructor(private readonly adminRepo: AdminRepositoryPort) {}

  async execute(actor: AdminActorContext, targetUserId: string): Promise<Result<AdminUserDetail>> {
    try {
      if (!actor.role) {
        return err(new Error('Access Denied: Missing platform administrative role'));
      }
      const detail = await this.adminRepo.getUserDetail(targetUserId);
      return ok(detail);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export interface ChangeUserStatusCommand {
  targetUserId: string;
  targetEmail: string;
  newStatus: UserAccessStatus;
  reasonCode?: string;
  reasonDetails?: string;
}

export class ChangeUserStatusUseCase {
  constructor(
    private readonly adminRepo: AdminRepositoryPort,
    private readonly auditRepo: AdminAuditLogPort
  ) {}

  async execute(actor: AdminActorContext, command: ChangeUserStatusCommand): Promise<Result<void>> {
    try {
      if (!canModifyUserStatus(actor.role)) {
        await this.auditRepo.recordLog({
          actorUserId: actor.userId,
          actorName: actor.displayName,
          targetUserId: command.targetUserId,
          targetName: command.targetEmail,
          action: 'USER_STATUS_CHANGE',
          outcome: 'denied',
          reasonCode: 'INSUFFICIENT_PERMISSIONS',
          ipAddress: actor.ipAddress,
          safeMetadata: sanitizeAuditMetadata({
            attemptedStatus: command.newStatus,
            actorRole: actor.role,
          }),
        });
        return err(new Error('Access Denied: Insufficient platform permissions to change user status'));
      }

      const validation = validateStatusChange(
        actor.userId,
        command.targetUserId,
        command.newStatus,
        command.reasonCode
      );

      if (!validation.allowed) {
        await this.auditRepo.recordLog({
          actorUserId: actor.userId,
          actorName: actor.displayName,
          targetUserId: command.targetUserId,
          targetName: command.targetEmail,
          action: 'USER_STATUS_CHANGE',
          outcome: 'denied',
          reasonCode: 'INVARIANT_VIOLATION',
          ipAddress: actor.ipAddress,
          safeMetadata: sanitizeAuditMetadata({
            invariantReason: validation.reason,
            attemptedStatus: command.newStatus,
          }),
        });
        return err(new Error(validation.reason || 'Status change rejected by invariant policy'));
      }

      await this.adminRepo.setUserStatus(
        command.targetUserId,
        command.newStatus,
        command.reasonCode,
        command.reasonDetails
      );

      await this.auditRepo.recordLog({
        actorUserId: actor.userId,
        actorName: actor.displayName,
        targetUserId: command.targetUserId,
        targetName: command.targetEmail,
        action: 'USER_STATUS_CHANGE',
        outcome: 'success',
        reasonCode: command.reasonCode,
        ipAddress: actor.ipAddress,
        safeMetadata: sanitizeAuditMetadata({
          newStatus: command.newStatus,
          reasonDetails: command.reasonDetails,
        }),
      });

      return ok(undefined);
    } catch (error) {
      const errObj = error instanceof Error ? error : new Error(String(error));
      await this.auditRepo.recordLog({
        actorUserId: actor.userId,
        actorName: actor.displayName,
        targetUserId: command.targetUserId,
        targetName: command.targetEmail,
        action: 'USER_STATUS_CHANGE',
        outcome: 'failure',
        reasonCode: 'SYSTEM_ERROR',
        ipAddress: actor.ipAddress,
        safeMetadata: sanitizeAuditMetadata({ error: errObj.message }),
      });
      return err(errObj);
    }
  }
}

export interface InviteUserCommand {
  email: string;
  displayName: string;
  initialRole?: PlatformRole;
}

export class InviteUserUseCase {
  constructor(
    private readonly adminRepo: AdminRepositoryPort,
    private readonly auditRepo: AdminAuditLogPort
  ) {}

  async execute(
    actor: AdminActorContext,
    command: InviteUserCommand
  ): Promise<Result<{ userId: string }>> {
    try {
      if (actor.role !== 'super_admin' && actor.role !== 'support_admin') {
        return err(new Error('Access Denied: Insufficient platform permissions to invite users'));
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(command.email)) {
        return err(new Error('Invalid email address provided for invitation'));
      }

      const { userId } = await this.adminRepo.inviteUser(
        command.email,
        command.displayName,
        command.initialRole
      );

      await this.auditRepo.recordLog({
        actorUserId: actor.userId,
        actorName: actor.displayName,
        targetUserId: userId,
        targetName: command.displayName || command.email,
        action: 'USER_INVITED',
        outcome: 'success',
        reasonCode: 'ONBOARDING_INVITATION',
        ipAddress: actor.ipAddress,
        safeMetadata: sanitizeAuditMetadata({
          email: command.email,
          assignedRole: command.initialRole,
        }),
      });

      return ok({ userId });
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export class RequestUserPasswordResetUseCase {
  constructor(
    private readonly adminRepo: AdminRepositoryPort,
    private readonly auditRepo: AdminAuditLogPort
  ) {}

  async execute(
    actor: AdminActorContext,
    targetUserId: string,
    targetEmail: string
  ): Promise<Result<{ success: boolean }>> {
    try {
      if (!canModifyUserStatus(actor.role)) {
        return err(new Error('Access Denied: Insufficient permissions to request password reset'));
      }

      const res = await this.adminRepo.requestPasswordReset(targetUserId);

      await this.auditRepo.recordLog({
        actorUserId: actor.userId,
        actorName: actor.displayName,
        targetUserId,
        targetName: targetEmail,
        action: 'PASSWORD_RESET_REQUESTED',
        outcome: 'success',
        reasonCode: 'ADMINISTRATIVE_RESET_TRIGGER',
        ipAddress: actor.ipAddress,
        safeMetadata: sanitizeAuditMetadata({ recoveryEmailSent: res.recoveryEmailSent }),
      });

      return ok({ success: res.success });
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
