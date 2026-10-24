import {
  AdminAuditLogEntry,
  AdminPaginationParams,
  PaginatedResult,
} from '@wealthnest/domain';

export interface AdminAuditLogPort {
  recordLog(entry: Omit<AdminAuditLogEntry, 'id' | 'createdAt'>): Promise<string>;
  listLogs(
    params: AdminPaginationParams & { action?: string; targetUserId?: string }
  ): Promise<PaginatedResult<AdminAuditLogEntry>>;
}
