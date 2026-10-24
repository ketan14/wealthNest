export type PlatformRole = 'super_admin' | 'support_admin' | 'auditor';

export type UserAccessStatus = 'invited' | 'active' | 'suspended' | 'deactivated';

export type AdminAuditOutcome = 'success' | 'failure' | 'denied';

export type AdminAuditAction =
  | 'USER_INVITED'
  | 'USER_STATUS_CHANGE'
  | 'PASSWORD_RESET_REQUESTED'
  | 'ROLE_GRANTED'
  | 'ROLE_REVOKED'
  | 'HOUSEHOLD_CREATED'
  | 'SYSTEM_BOOTSTRAP'
  | 'SECURITY_ALERT';

export interface AdminUserSummary {
  id: string;
  email: string;
  displayName: string;
  status: UserAccessStatus;
  reasonCode?: string;
  reasonDetails?: string;
  platformRole?: PlatformRole;
  createdAt: string;
  lastSignInAt?: string;
  householdCount: number;
}

export interface AdminHouseholdMembership {
  id: string;
  name: string;
  householdRole: 'primary_owner' | 'member' | 'viewer';
  joinedAt: string;
  totalMembers: number;
}

export interface AdminAuditLogEntry {
  id: string;
  actorUserId?: string;
  actorName: string;
  targetUserId?: string;
  targetName: string;
  action: string;
  outcome: AdminAuditOutcome;
  reasonCode?: string;
  ipAddress?: string;
  safeMetadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  defaultCurrency: string;
  statusUpdatedAt?: string;
  roleGrantedAt?: string;
  households: AdminHouseholdMembership[];
  recentAudits: AdminAuditLogEntry[];
}

export interface AdminHouseholdSummary {
  id: string;
  name: string;
  createdByName: string;
  createdAt: string;
  memberCount: number;
}

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  invitedUsers: number;
  totalHouseholds: number;
  totalAuditEvents: number;
}

export interface AdminPaginationParams {
  page: number;
  limit: number;
  search?: string;
  status?: UserAccessStatus;
  role?: PlatformRole;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
