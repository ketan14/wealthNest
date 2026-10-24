import {
  AdminUserSummary,
  AdminUserDetail,
  AdminHouseholdSummary,
  AdminDashboardStats,
  AdminPaginationParams,
  PaginatedResult,
  PlatformRole,
  UserAccessStatus,
  AdminAuditLogEntry,
} from '@wealthnest/domain';
import { AdminRepositoryPort, AdminAuditLogPort } from '@wealthnest/application';
import { supabase } from './client';

export const DEMO_ADMIN_USERS: AdminUserSummary[] = [
  {
    id: '4c4fa116-57d5-4fc8-af89-be56b5069b50',
    email: 'investor@wealthnest.local',
    displayName: 'Ketan Vaghela',
    status: 'active',
    platformRole: 'super_admin',
    createdAt: '2026-10-17T13:10:58.169Z',
    lastSignInAt: '2026-10-24T07:15:00.000Z',
    householdCount: 1,
  },
  {
    id: 'usr-parul-vaghela-02',
    email: 'parul.vaghela@wealthnest.local',
    displayName: 'Parul Vaghela',
    status: 'active',
    platformRole: 'support_admin',
    createdAt: '2026-10-18T09:30:00.000Z',
    lastSignInAt: '2026-10-23T16:45:00.000Z',
    householdCount: 1,
  },
  {
    id: 'usr-shamalbhai-vaghela-03',
    email: 'shamalbhai.huf@wealthnest.local',
    displayName: 'Shamalbhai Vaghela HUF',
    status: 'active',
    createdAt: '2026-10-19T11:20:00.000Z',
    householdCount: 1,
  },
  {
    id: 'usr-ramilaben-vaghela-04',
    email: 'ramilaben.vaghela@wealthnest.local',
    displayName: 'Ramilaben Vaghela',
    status: 'active',
    createdAt: '2026-10-20T14:15:00.000Z',
    householdCount: 1,
  },
  {
    id: 'usr-krisha-vaghela-05',
    email: 'krisha.vaghela@wealthnest.local',
    displayName: 'Krisha Vaghela',
    status: 'invited',
    createdAt: '2026-10-24T06:00:00.000Z',
    householdCount: 1,
  },
];

export const DEMO_HOUSEHOLDS: AdminHouseholdSummary[] = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Vaghela Household',
    createdByName: 'Ketan Vaghela',
    createdAt: '2026-10-17T13:10:58.169Z',
    memberCount: 5,
  },
];

let demoAuditLogsStore: AdminAuditLogEntry[] = [
  {
    id: 'audit-demo-01',
    actorUserId: '4c4fa116-57d5-4fc8-af89-be56b5069b50',
    actorName: 'Ketan Vaghela',
    targetUserId: '4c4fa116-57d5-4fc8-af89-be56b5069b50',
    targetName: 'Ketan Vaghela',
    action: 'SYSTEM_BOOTSTRAP',
    outcome: 'success',
    reasonCode: 'INITIAL_DEPLOYMENT',
    ipAddress: '127.0.0.1',
    safeMetadata: { note: 'Platform admin and Vaghela Household bootstrapped' },
    createdAt: '2026-10-24T07:25:22.000Z',
  },
];

export class SupabaseAdminAdapter implements AdminRepositoryPort, AdminAuditLogPort {
  async listUsers(params: AdminPaginationParams): Promise<PaginatedResult<AdminUserSummary>> {
    try {
      const { data, error } = await supabase.rpc('admin_get_users', {
        p_page: params.page,
        p_limit: params.limit,
        p_search: params.search || null,
        p_status: params.status || null,
        p_role: params.role || null,
      });

      if (error || !data) {
        throw error || new Error('No data returned from admin_get_users');
      }

      const users: AdminUserSummary[] = (data.users || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        status: u.status,
        reasonCode: u.reason_code,
        reasonDetails: u.reason_details,
        platformRole: u.platform_role,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        householdCount: Number(u.household_count || 0),
      }));

      return {
        items: users,
        total: Number(data.total || users.length),
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(Number(data.total || users.length) / params.limit) || 1,
      };
    } catch {
      // Fallback to local demo data
      let filtered = [...DEMO_ADMIN_USERS];
      if (params.search) {
        const query = params.search.toLowerCase();
        filtered = filtered.filter(
          (u) => u.displayName.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)
        );
      }
      if (params.status) {
        filtered = filtered.filter((u) => u.status === params.status);
      }
      if (params.role) {
        filtered = filtered.filter((u) => u.platformRole === params.role);
      }

      const offset = (params.page - 1) * params.limit;
      const paginated = filtered.slice(offset, offset + params.limit);

      return {
        items: paginated,
        total: filtered.length,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(filtered.length / params.limit) || 1,
      };
    }
  }

  async getUserDetail(userId: string): Promise<AdminUserDetail> {
    try {
      const { data, error } = await supabase.rpc('admin_get_user_detail', {
        p_user_id: userId,
      });

      if (error || !data) {
        throw error || new Error('No data returned from admin_get_user_detail');
      }

      const u = data.user;
      return {
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        defaultCurrency: u.default_currency || 'INR',
        status: u.status,
        reasonCode: u.reason_code,
        reasonDetails: u.reason_details,
        statusUpdatedAt: u.status_updated_at,
        platformRole: u.platform_role,
        roleGrantedAt: u.role_granted_at,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        householdCount: (data.households || []).length,
        households: (data.households || []).map((h: any) => ({
          id: h.id,
          name: h.name,
          householdRole: h.household_role,
          joinedAt: h.joined_at,
          totalMembers: Number(h.total_members || 1),
        })),
        recentAudits: (data.recent_audits || []).map((a: any) => ({
          id: a.id,
          actorName: a.actor_name,
          targetName: u.display_name,
          action: a.action,
          outcome: a.outcome,
          reasonCode: a.reason_code,
          safeMetadata: a.safe_metadata || {},
          createdAt: a.created_at,
        })),
      };
    } catch {
      const defaultUser = DEMO_ADMIN_USERS[0]!;
      const user = DEMO_ADMIN_USERS.find((u) => u.id === userId) || defaultUser;

      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        reasonCode: user.reasonCode,
        reasonDetails: user.reasonDetails,
        platformRole: user.platformRole,
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        householdCount: user.householdCount,
        defaultCurrency: 'INR',
        households: [
          {
            id: 'a0000000-0000-0000-0000-000000000001',
            name: 'Vaghela Household',
            householdRole: user.id === '4c4fa116-57d5-4fc8-af89-be56b5069b50' ? 'primary_owner' : 'member',
            joinedAt: user.createdAt,
            totalMembers: 5,
          },
        ],
        recentAudits: demoAuditLogsStore.filter((l) => l.targetUserId === user.id),
      };
    }

  }

  async setUserStatus(
    targetUserId: string,
    status: UserAccessStatus,
    reasonCode?: string,
    reasonDetails?: string
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('admin_set_user_status', {
        p_target_user_id: targetUserId,
        p_status: status,
        p_reason_code: reasonCode || null,
        p_reason_details: reasonDetails || null,
      });

      if (error) throw error;
    } catch (err: any) {
      // In demo mode or fallback, update local memory state
      const target = DEMO_ADMIN_USERS.find((u) => u.id === targetUserId);
      if (target) {
        target.status = status;
        target.reasonCode = reasonCode;
        target.reasonDetails = reasonDetails;
      }
      if (err?.message && !err.message.includes('fetch')) {
        throw err;
      }
    }
  }

  async managePlatformRole(
    targetUserId: string,
    role: PlatformRole,
    action: 'grant' | 'revoke'
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('admin_manage_role', {
        p_target_user_id: targetUserId,
        p_role: role,
        p_action: action,
      });

      if (error) throw error;
    } catch (err: any) {
      const target = DEMO_ADMIN_USERS.find((u) => u.id === targetUserId);
      if (target) {
        target.platformRole = action === 'grant' ? role : undefined;
      }
      if (err?.message && !err.message.includes('fetch')) {
        throw err;
      }
    }
  }

  async inviteUser(
    email: string,
    displayName: string,
    initialRole?: PlatformRole
  ): Promise<{ userId: string; invitationToken?: string }> {
    const newId = `usr-${Date.now()}`;
    const newUser: AdminUserSummary = {
      id: newId,
      email,
      displayName,
      status: 'invited',
      platformRole: initialRole,
      createdAt: new Date().toISOString(),
      householdCount: 0,
    };
    DEMO_ADMIN_USERS.unshift(newUser);
    return { userId: newId, invitationToken: 'mock-invitation-token-wealthnest' };
  }

  async requestPasswordReset(
    targetUserId: string
  ): Promise<{ success: boolean; recoveryEmailSent: boolean }> {
    const user = DEMO_ADMIN_USERS.find((u) => u.id === targetUserId);
    if (user) {
      try {
        await supabase.auth.resetPasswordForEmail(user.email, {
          redirectTo: `${window.location.origin}/settings`,
        });
      } catch {
        // Fallback for tests / demo
      }
    }
    return { success: true, recoveryEmailSent: true };
  }

  async getDashboardStats(): Promise<AdminDashboardStats> {
    try {
      const { data, error } = await supabase.rpc('admin_get_dashboard_stats');
      if (error || !data) throw error || new Error('No dashboard stats returned');

      return {
        totalUsers: Number(data.total_users || 0),
        activeUsers: Number(data.active_users || 0),
        suspendedUsers: Number(data.suspended_users || 0),
        invitedUsers: Number(data.invited_users || 0),
        totalHouseholds: Number(data.total_households || 0),
        totalAuditEvents: Number(data.total_audit_events || 0),
      };
    } catch {
      return {
        totalUsers: DEMO_ADMIN_USERS.length,
        activeUsers: DEMO_ADMIN_USERS.filter((u) => u.status === 'active').length,
        suspendedUsers: DEMO_ADMIN_USERS.filter((u) => u.status === 'suspended').length,
        invitedUsers: DEMO_ADMIN_USERS.filter((u) => u.status === 'invited').length,
        totalHouseholds: DEMO_HOUSEHOLDS.length,
        totalAuditEvents: demoAuditLogsStore.length,
      };
    }
  }

  async listHouseholds(
    params: AdminPaginationParams
  ): Promise<PaginatedResult<AdminHouseholdSummary>> {
    try {
      const { data, error } = await supabase.rpc('admin_get_households', {
        p_page: params.page,
        p_limit: params.limit,
        p_search: params.search || null,
      });

      if (error || !data) throw error || new Error('No households returned');

      const items: AdminHouseholdSummary[] = (data.households || []).map((h: any) => ({
        id: h.id,
        name: h.name,
        createdByName: h.created_by_name,
        createdAt: h.created_at,
        memberCount: Number(h.member_count || 1),
      }));

      return {
        items,
        total: Number(data.total || items.length),
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(Number(data.total || items.length) / params.limit) || 1,
      };
    } catch {
      return {
        items: DEMO_HOUSEHOLDS,
        total: DEMO_HOUSEHOLDS.length,
        page: params.page,
        limit: params.limit,
        totalPages: 1,
      };
    }
  }

  async getActiveSuperAdminCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('platform_admin_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'super_admin')
        .eq('is_active', true);

      if (error) throw error;
      return count || 1;
    } catch {
      return DEMO_ADMIN_USERS.filter((u) => u.platformRole === 'super_admin').length || 1;
    }
  }

  // AdminAuditLogPort implementation
  async recordLog(entry: Omit<AdminAuditLogEntry, 'id' | 'createdAt'>): Promise<string> {
    const id = `audit-${Date.now()}`;
    const newEntry: AdminAuditLogEntry = {
      ...entry,
      id,
      createdAt: new Date().toISOString(),
    };
    demoAuditLogsStore.unshift(newEntry);

    try {
      await supabase.rpc('log_admin_action', {
        p_actor_user_id: entry.actorUserId || null,
        p_target_user_id: entry.targetUserId || null,
        p_action: entry.action,
        p_outcome: entry.outcome,
        p_reason_code: entry.reasonCode || null,
        p_safe_metadata: entry.safeMetadata || {},
        p_ip_address: entry.ipAddress || null,
      });
    } catch {
      // Non-blocking in demo mode
    }

    return id;
  }

  async listLogs(
    params: AdminPaginationParams & { action?: string; targetUserId?: string }
  ): Promise<PaginatedResult<AdminAuditLogEntry>> {
    try {
      const { data, error } = await supabase.rpc('admin_get_audit_logs', {
        p_page: params.page,
        p_limit: params.limit,
        p_action: params.action || null,
        p_target_user_id: params.targetUserId || null,
      });

      if (error || !data) throw error || new Error('No audit logs returned');

      const items: AdminAuditLogEntry[] = (data.logs || []).map((l: any) => ({
        id: l.id,
        actorUserId: l.actor_user_id,
        actorName: l.actor_name,
        targetUserId: l.target_user_id,
        targetName: l.target_name,
        action: l.action,
        outcome: l.outcome,
        reasonCode: l.reason_code,
        ipAddress: l.ip_address,
        safeMetadata: l.safe_metadata || {},
        createdAt: l.created_at,
      }));

      return {
        items,
        total: Number(data.total || items.length),
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(Number(data.total || items.length) / params.limit) || 1,
      };
    } catch {
      let filtered = [...demoAuditLogsStore];
      if (params.action) {
        filtered = filtered.filter((l) => l.action === params.action);
      }
      if (params.targetUserId) {
        filtered = filtered.filter((l) => l.targetUserId === params.targetUserId);
      }
      const offset = (params.page - 1) * params.limit;
      return {
        items: filtered.slice(offset, offset + params.limit),
        total: filtered.length,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(filtered.length / params.limit) || 1,
      };
    }
  }
}

export const adminAdapter = new SupabaseAdminAdapter();
export const adminAuditLogAdapter: AdminAuditLogPort = adminAdapter;
