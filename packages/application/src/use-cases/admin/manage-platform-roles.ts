import { Result, ok, err } from '@wealthnest/shared';
import {
  PlatformRole,
  canManagePlatformRole,
  validateRoleRevocation,
  sanitizeAuditMetadata,
} from '@wealthnest/domain';
import { AdminRepositoryPort } from '../../ports/admin-repository.port.js';
import { AdminAuditLogPort } from '../../ports/admin-audit-log.port.js';
import { AdminActorContext } from './manage-admin-users.js';

export interface ManagePlatformRoleCommand {
  targetUserId: string;
  targetEmail: string;
  role: PlatformRole;
  action: 'grant' | 'revoke';
}

export class ManagePlatformRoleUseCase {
  constructor(
    private readonly adminRepo: AdminRepositoryPort,
    private readonly auditRepo: AdminAuditLogPort
  ) {}

  async execute(
    actor: AdminActorContext,
    command: ManagePlatformRoleCommand
  ): Promise<Result<void>> {
    try {
      if (!canManagePlatformRole(actor.role)) {
        await this.auditRepo.recordLog({
          actorUserId: actor.userId,
          actorName: actor.displayName,
          targetUserId: command.targetUserId,
          targetName: command.targetEmail,
          action: command.action === 'grant' ? 'ROLE_GRANTED' : 'ROLE_REVOKED',
          outcome: 'denied',
          reasonCode: 'INSUFFICIENT_PERMISSIONS',
          ipAddress: actor.ipAddress,
          safeMetadata: sanitizeAuditMetadata({
            attemptedRole: command.role,
            actorRole: actor.role,
          }),
        });
        return err(new Error('Access Denied: Only super_admin can grant or revoke platform roles'));
      }

      if (command.action === 'revoke') {
        const activeSuperAdminCount = await this.adminRepo.getActiveSuperAdminCount();
        const validation = validateRoleRevocation(command.role, activeSuperAdminCount);

        if (!validation.allowed) {
          await this.auditRepo.recordLog({
            actorUserId: actor.userId,
            actorName: actor.displayName,
            targetUserId: command.targetUserId,
            targetName: command.targetEmail,
            action: 'ROLE_REVOKED',
            outcome: 'denied',
            reasonCode: 'INVARIANT_VIOLATION',
            ipAddress: actor.ipAddress,
            safeMetadata: sanitizeAuditMetadata({
              invariantReason: validation.reason,
              targetRole: command.role,
            }),
          });
          return err(new Error(validation.reason || 'Role revocation denied by invariant'));
        }
      }

      await this.adminRepo.managePlatformRole(command.targetUserId, command.role, command.action);

      await this.auditRepo.recordLog({
        actorUserId: actor.userId,
        actorName: actor.displayName,
        targetUserId: command.targetUserId,
        targetName: command.targetEmail,
        action: command.action === 'grant' ? 'ROLE_GRANTED' : 'ROLE_REVOKED',
        outcome: 'success',
        reasonCode: 'PLATFORM_RBAC_MANAGEMENT',
        ipAddress: actor.ipAddress,
        safeMetadata: sanitizeAuditMetadata({
          role: command.role,
          action: command.action,
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
        action: command.action === 'grant' ? 'ROLE_GRANTED' : 'ROLE_REVOKED',
        outcome: 'failure',
        reasonCode: 'SYSTEM_ERROR',
        ipAddress: actor.ipAddress,
        safeMetadata: sanitizeAuditMetadata({ error: errObj.message }),
      });
      return err(errObj);
    }
  }
}
