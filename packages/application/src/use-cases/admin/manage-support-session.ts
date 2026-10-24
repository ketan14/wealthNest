import { Result, ok, err } from '@wealthnest/shared';
import {
  SupportSession,
  SupportUserSummary,
  SupportHoldingItem,
  SupportLiabilityItem,
  SupportGoalItem,
  SupportTransactionItem,
  canInitiateSupportSession,
  validateSupportSessionRequest,
  sanitizeAuditMetadata,
} from '@wealthnest/domain';
import { SupportSessionPort } from '../../ports/support-session.port.js';
import { AdminAuditLogPort } from '../../ports/admin-audit-log.port.js';
import { AdminActorContext } from './manage-admin-users.js';

export interface StartSupportSessionCommand {
  targetUserId: string;
  targetName: string;
  reason: string;
}

export class StartSupportSessionUseCase {
  constructor(
    private readonly supportPort: SupportSessionPort,
    private readonly auditRepo: AdminAuditLogPort
  ) {}

  async execute(
    actor: AdminActorContext,
    command: StartSupportSessionCommand
  ): Promise<Result<SupportSession>> {
    try {
      if (!canInitiateSupportSession(actor.role)) {
        await this.auditRepo.recordLog({
          actorUserId: actor.userId,
          actorName: actor.displayName,
          targetUserId: command.targetUserId,
          targetName: command.targetName,
          action: 'SUPPORT_SESSION_STARTED',
          outcome: 'denied',
          reasonCode: 'INSUFFICIENT_PERMISSIONS',
          ipAddress: actor.ipAddress,
          safeMetadata: sanitizeAuditMetadata({
            actorRole: actor.role,
            reason: command.reason,
          }),
        });
        return err(new Error('Access Denied: Insufficient platform permissions to initiate support session'));
      }

      const validation = validateSupportSessionRequest(
        actor.userId,
        command.targetUserId,
        command.reason
      );

      if (!validation.allowed) {
        await this.auditRepo.recordLog({
          actorUserId: actor.userId,
          actorName: actor.displayName,
          targetUserId: command.targetUserId,
          targetName: command.targetName,
          action: 'SUPPORT_SESSION_STARTED',
          outcome: 'denied',
          reasonCode: 'INVARIANT_VIOLATION',
          ipAddress: actor.ipAddress,
          safeMetadata: sanitizeAuditMetadata({
            invariantReason: validation.reason,
            reason: command.reason,
          }),
        });
        return err(new Error(validation.reason || 'Support session rejected by invariant policy'));
      }

      const session = await this.supportPort.startSession(
        actor.userId,
        command.targetUserId,
        command.reason
      );

      await this.auditRepo.recordLog({
        actorUserId: actor.userId,
        actorName: actor.displayName,
        targetUserId: command.targetUserId,
        targetName: command.targetName,
        action: 'SUPPORT_SESSION_STARTED',
        outcome: 'success',
        reasonCode: 'TROUBLESHOOTING_SUPPORT_VIEW',
        ipAddress: actor.ipAddress,
        safeMetadata: sanitizeAuditMetadata({
          sessionId: session.id,
          reason: command.reason,
          ttlMinutes: session.ttlMinutes,
          expiresAt: session.expiresAt,
        }),
      });

      return ok(session);
    } catch (error) {
      const errObj = error instanceof Error ? error : new Error(String(error));
      await this.auditRepo.recordLog({
        actorUserId: actor.userId,
        actorName: actor.displayName,
        targetUserId: command.targetUserId,
        targetName: command.targetName,
        action: 'SUPPORT_SESSION_STARTED',
        outcome: 'failure',
        reasonCode: 'SYSTEM_ERROR',
        ipAddress: actor.ipAddress,
        safeMetadata: sanitizeAuditMetadata({ error: errObj.message }),
      });
      return err(errObj);
    }
  }
}

export interface EndSupportSessionCommand {
  sessionId: string;
  targetUserId?: string;
  targetName?: string;
}

export class EndSupportSessionUseCase {
  constructor(
    private readonly supportPort: SupportSessionPort,
    private readonly auditRepo: AdminAuditLogPort
  ) {}

  async execute(
    actor: AdminActorContext,
    command: EndSupportSessionCommand
  ): Promise<Result<void>> {
    try {
      await this.supportPort.endSession(command.sessionId);

      await this.auditRepo.recordLog({
        actorUserId: actor.userId,
        actorName: actor.displayName,
        targetUserId: command.targetUserId,
        targetName: command.targetName || 'User Account',
        action: 'SUPPORT_SESSION_ENDED',
        outcome: 'success',
        reasonCode: 'MANUAL_SUPPORT_SESSION_TERMINATION',
        ipAddress: actor.ipAddress,
        safeMetadata: sanitizeAuditMetadata({
          sessionId: command.sessionId,
        }),
      });

      return ok(undefined);
    } catch (error) {
      const errObj = error instanceof Error ? error : new Error(String(error));
      await this.auditRepo.recordLog({
        actorUserId: actor.userId,
        actorName: actor.displayName,
        targetUserId: command.targetUserId,
        targetName: command.targetName || 'User Account',
        action: 'SUPPORT_SESSION_ENDED',
        outcome: 'failure',
        reasonCode: 'SYSTEM_ERROR',
        ipAddress: actor.ipAddress,
        safeMetadata: sanitizeAuditMetadata({
          sessionId: command.sessionId,
          error: errObj.message,
        }),
      });
      return err(errObj);
    }
  }
}

export interface SupportUserDataBundle {
  summary: SupportUserSummary;
  portfolio: SupportHoldingItem[];
  liabilities: SupportLiabilityItem[];
  goals: SupportGoalItem[];
  transactions: SupportTransactionItem[];
}

export class GetSupportUserDataUseCase {
  constructor(private readonly supportPort: SupportSessionPort) {}

  async execute(sessionId: string): Promise<Result<SupportUserDataBundle>> {
    try {
      const [summary, portfolio, liabilities, goals, transactions] = await Promise.all([
        this.supportPort.getSupportSummary(sessionId),
        this.supportPort.getSupportPortfolio(sessionId),
        this.supportPort.getSupportLiabilities(sessionId),
        this.supportPort.getSupportGoals(sessionId),
        this.supportPort.getSupportTransactions(sessionId, 50),
      ]);

      return ok({
        summary,
        portfolio,
        liabilities,
        goals,
        transactions,
      });
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
