import type { CustomPlanLimits, PlanTier } from '../plans/plan-entitlements.js';

export type PlatformRole = 'super_admin' | 'support_admin' | 'auditor';

export type UserAccessStatus = 'invited' | 'active' | 'suspended' | 'deactivated';

export type AdminAuditOutcome = 'success' | 'failure' | 'denied';

export type AdminAuditAction =
  | 'USER_INVITED'
  | 'USER_STATUS_CHANGE'
  | 'PASSWORD_RESET_REQUESTED'
  | 'ROLE_GRANTED'
  | 'ROLE_REVOKED'
  | 'PLAN_TIER_CHANGED'
  | 'PLAN_UPGRADE_APPROVED'
  | 'PLAN_UPGRADE_REJECTED'
  | 'PLAN_CUSTOM_LIMITS_UPDATED'
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
  planTier?: PlanTier;
  planExpiresAt?: string | null;
  createdAt: string;
  lastSignInAt?: string;
  householdCount: number;
}

export interface AdminHouseholdMembership {
  id: string;
  name: string;
  householdRole: 'primary_owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
  totalMembers: number;
  planTier?: PlanTier;
  customLimits?: CustomPlanLimits | null;
  planExpiresAt?: string | null;
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
  planTier?: PlanTier;
  customLimits?: CustomPlanLimits | null;
  planExpiresAt?: string | null;
}

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  invitedUsers: number;
  totalHouseholds: number;
  totalAuditEvents: number;
  planBreakdown?: {
    free: number;
    pro: number;
    family: number;
  };
  pendingUpgradeRequests?: number;
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
