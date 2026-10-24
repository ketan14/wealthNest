import { Result, ok, err } from '@wealthnest/shared';
import {
  AdminDashboardStats,
  AdminHouseholdSummary,
  AdminAuditLogEntry,
  AdminPaginationParams,
  PaginatedResult,
} from '@wealthnest/domain';
import { AdminRepositoryPort } from '../../ports/admin-repository.port.js';
import { AdminAuditLogPort } from '../../ports/admin-audit-log.port.js';
import { AdminActorContext } from './manage-admin-users.js';

export class GetAdminDashboardStatsUseCase {
  constructor(private readonly adminRepo: AdminRepositoryPort) {}

  async execute(actor: AdminActorContext): Promise<Result<AdminDashboardStats>> {
    try {
      if (!actor.role) {
        return err(new Error('Access Denied: Missing platform administrative role'));
      }
      const stats = await this.adminRepo.getDashboardStats();
      return ok(stats);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export class ListAdminHouseholdsUseCase {
  constructor(private readonly adminRepo: AdminRepositoryPort) {}

  async execute(
    actor: AdminActorContext,
    params: AdminPaginationParams
  ): Promise<Result<PaginatedResult<AdminHouseholdSummary>>> {
    try {
      if (!actor.role) {
        return err(new Error('Access Denied: Missing platform administrative role'));
      }
      const result = await this.adminRepo.listHouseholds(params);
      return ok(result);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export class ListAdminAuditLogsUseCase {
  constructor(private readonly auditRepo: AdminAuditLogPort) {}

  async execute(
    actor: AdminActorContext,
    params: AdminPaginationParams & { action?: string; targetUserId?: string }
  ): Promise<Result<PaginatedResult<AdminAuditLogEntry>>> {
    try {
      if (!actor.role) {
        return err(new Error('Access Denied: Missing platform administrative role'));
      }
      const result = await this.auditRepo.listLogs(params);
      return ok(result);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
