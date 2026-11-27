import {
  AdminUserSummary,
  AdminUserDetail,
  AdminHouseholdSummary,
  AdminDashboardStats,
  AdminPaginationParams,
  PaginatedResult,
  PlatformRole,
  PlanTier,
  CustomPlanLimits,
  PlanUpgradeRequest,
  PlanUpgradeRequestStatus,
  UserAccessStatus,
} from '@wealthnest/domain';

export interface AdminPlanUpdateOptions {
  readonly customLimits?: CustomPlanLimits | null;
  readonly planExpiresAt?: string | null;
}

export interface AdminRepositoryPort {
  listUsers(params: AdminPaginationParams): Promise<PaginatedResult<AdminUserSummary>>;
  getUserDetail(userId: string): Promise<AdminUserDetail>;
  setUserStatus(
    targetUserId: string,
    status: UserAccessStatus,
    reasonCode?: string,
    reasonDetails?: string
  ): Promise<void>;
  managePlatformRole(
    targetUserId: string,
    role: PlatformRole,
    action: 'grant' | 'revoke'
  ): Promise<void>;
  setUserPlan(
    targetUserId: string,
    planTier: PlanTier,
    reasonDetails?: string,
    options?: AdminPlanUpdateOptions
  ): Promise<{
    userId: string;
    previousPlan: PlanTier;
    newPlan: PlanTier;
    householdsUpdated: number;
    customLimits?: CustomPlanLimits | null;
    planExpiresAt?: string | null;
  }>;
  setHouseholdPlan(
    householdId: string,
    planTier: PlanTier,
    reasonDetails?: string,
    options?: AdminPlanUpdateOptions
  ): Promise<{
    householdId: string;
    previousPlan: PlanTier;
    newPlan: PlanTier;
    customLimits?: CustomPlanLimits | null;
    planExpiresAt?: string | null;
  }>;
  listUpgradeRequests(status?: PlanUpgradeRequestStatus): Promise<PlanUpgradeRequest[]>;
  reviewUpgradeRequest(
    requestId: string,
    decision: 'approved' | 'rejected',
    adminNotes?: string
  ): Promise<PlanUpgradeRequest>;
  inviteUser(
    email: string,
    displayName: string,
    initialRole?: PlatformRole
  ): Promise<{ userId: string; invitationToken?: string }>;
  requestPasswordReset(
    targetUserId: string
  ): Promise<{ success: boolean; recoveryEmailSent: boolean }>;
  getDashboardStats(): Promise<AdminDashboardStats>;
  listHouseholds(params: AdminPaginationParams): Promise<PaginatedResult<AdminHouseholdSummary>>;
  getActiveSuperAdminCount(): Promise<number>;
}
