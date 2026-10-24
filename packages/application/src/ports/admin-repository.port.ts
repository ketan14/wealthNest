import {
  AdminUserSummary,
  AdminUserDetail,
  AdminHouseholdSummary,
  AdminDashboardStats,
  AdminPaginationParams,
  PaginatedResult,
  PlatformRole,
  UserAccessStatus,
} from '@wealthnest/domain';

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
  inviteUser(
    email: string,
    displayName: string,
    initialRole?: PlatformRole
  ): Promise<{ userId: string; invitationToken?: string }>;
  requestPasswordReset(targetUserId: string): Promise<{ success: boolean; recoveryEmailSent: boolean }>;
  getDashboardStats(): Promise<AdminDashboardStats>;
  listHouseholds(params: AdminPaginationParams): Promise<PaginatedResult<AdminHouseholdSummary>>;
  getActiveSuperAdminCount(): Promise<number>;
}
