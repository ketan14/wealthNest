import { Result, ok, err } from '@wealthnest/shared';
import {
  HouseholdSummary,
  HouseholdAccessMember,
  HouseholdInvitation,
  HouseholdInvitationPreview,
  HouseholdAuditLogEntry,
  HouseholdRole,
  HouseholdMembershipStatus,
  FamilyMemberAccessGrant,
  RestrictedRecordGrant,
  RestrictedRecordTargetType,
} from '@wealthnest/domain';
import {
  HouseholdRepositoryPort,
  CreateHouseholdInvitationParams,
  CreatedHouseholdInvitationResult,
  AcceptHouseholdInvitationResult,
  SetFamilyMemberAccessParams,
  SetRestrictedRecordGrantParams,
} from '@wealthnest/application';
import { supabase } from './client';
import { toValidUuidOrNull } from './uuid-utils';
import { fromPgRestrictedRecordType, toPgRestrictedRecordType } from './household-scope';

export class SupabaseHouseholdAdapter implements HouseholdRepositoryPort {
  async listMyHouseholds(): Promise<Result<readonly HouseholdSummary[]>> {
    try {
      const { data, error } = await supabase.rpc('get_my_households');
      if (error) {
        return err(new Error(error.message));
      }

      const rows = Array.isArray(data) ? data : [];
      const summaries: HouseholdSummary[] = rows.map((row: any, index: number) => ({
        id: String(row.id),
        name: String(row.name || 'My Household'),
        role: row.household_role as HouseholdRole,
        status: (row.status || 'active') as HouseholdMembershipStatus,
        isDefault: index === 0,
        memberCount: Number(row.active_member_count ?? 1),
        createdAt: row.joined_at ? String(row.joined_at) : undefined,
      }));

      return ok(summaries);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to fetch households'));
    }
  }

  async ensureDefaultHousehold(displayName?: string): Promise<Result<string>> {
    try {
      const { data, error } = await supabase.rpc('ensure_user_default_household', {
        p_display_name: displayName ?? null,
      });

      if (error || typeof data !== 'string') {
        return err(new Error(error?.message || 'Failed to ensure default household'));
      }

      return ok(data);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to ensure default household'));
    }
  }

  async createHousehold(name: string, displayName?: string): Promise<Result<HouseholdSummary>> {
    try {
      const { data, error } = await supabase.rpc('create_household_with_self', {
        p_name: name,
        p_display_name: displayName ?? null,
      });

      if (error || !data) {
        return err(new Error(error?.message || 'Failed to create household'));
      }

      return ok({
        id: String(data.id),
        name: String(data.name || name),
        role: (data.household_role || 'primary_owner') as HouseholdRole,
        status: 'active',
        isDefault: false,
        memberCount: 1,
        createdAt: new Date().toISOString(),
      });
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to create household'));
    }
  }

  async renameHousehold(householdId: string, name: string): Promise<Result<void>> {
    try {
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        return err(new Error('Household name must be at least 2 characters'));
      }

      const { error } = await supabase
        .from('households')
        .update({ name: trimmed, updated_at: new Date().toISOString() })
        .eq('id', householdId);

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to rename household'));
    }
  }

  async listAccessMembers(householdId: string): Promise<Result<readonly HouseholdAccessMember[]>> {
    try {
      const { data, error } = await supabase.rpc('get_household_access_members', {
        p_household_id: householdId,
      });

      if (error) {
        return err(new Error(error.message));
      }

      const rows = Array.isArray(data) ? data : [];
      const members: HouseholdAccessMember[] = rows.map((row: any) => ({
        id: String(row.id),
        householdId: String(row.household_id || householdId),
        userId: String(row.user_id),
        displayName: row.display_name ? String(row.display_name) : undefined,
        email: row.email ? String(row.email) : undefined,
        householdRole: row.household_role as HouseholdRole,
        status: (row.status || 'active') as HouseholdMembershipStatus,
        joinedAt: String(row.joined_at || new Date().toISOString()),
        linkedFamilyMemberId: row.linked_family_member_id
          ? String(row.linked_family_member_id)
          : undefined,
        linkedFamilyMemberName: row.linked_family_member_name
          ? String(row.linked_family_member_name)
          : undefined,
      }));

      return ok(members);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to list household access members'));
    }
  }

  async appointAdmin(
    householdId: string,
    targetUserId: string,
    grant: boolean
  ): Promise<Result<void>> {
    try {
      const { error } = await supabase.rpc('appoint_household_admin', {
        p_household_id: householdId,
        p_target_user_id: targetUserId,
        p_grant: grant,
      });

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to update admin role'));
    }
  }

  async setMemberRole(
    householdId: string,
    targetUserId: string,
    role: Exclude<HouseholdRole, 'primary_owner'>
  ): Promise<Result<void>> {
    try {
      const { error } = await supabase.rpc('set_household_member_role', {
        p_household_id: householdId,
        p_target_user_id: targetUserId,
        p_role: role,
      });

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to update member role'));
    }
  }

  async transferPrimaryOwner(householdId: string, newOwnerUserId: string): Promise<Result<void>> {
    try {
      const { error } = await supabase.rpc('transfer_household_primary_owner', {
        p_household_id: householdId,
        p_new_owner_user_id: newOwnerUserId,
      });

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to transfer primary ownership'));
    }
  }

  async revokeOrRestoreMember(
    householdId: string,
    targetUserId: string,
    status: HouseholdMembershipStatus
  ): Promise<Result<void>> {
    try {
      const { error } = await supabase.rpc('revoke_or_restore_household_member', {
        p_household_id: householdId,
        p_target_user_id: targetUserId,
        p_status: status,
      });

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to update membership status'));
    }
  }

  async createInvitation(
    params: CreateHouseholdInvitationParams
  ): Promise<Result<CreatedHouseholdInvitationResult>> {
    try {
      const { data, error } = await supabase.rpc('create_household_invitation', {
        p_household_id: params.householdId,
        p_invited_email: params.invitedEmail,
        p_role: params.role,
        p_family_member_id: toValidUuidOrNull(params.familyMemberId),
        p_expires_in_hours: params.expiresInHours ?? 168,
      });

      if (error || !data) {
        return err(new Error(error?.message || 'Failed to create household invitation'));
      }

      return ok({
        invitationId: String(data.invitation_id),
        householdId: String(data.household_id || params.householdId),
        familyMemberId: data.family_member_id ? String(data.family_member_id) : undefined,
        invitedEmail: String(data.invited_email || params.invitedEmail),
        role: (data.role || params.role) as Exclude<HouseholdRole, 'primary_owner'>,
        expiresAt: String(data.expires_at),
        inviteToken: String(data.invite_token),
      });
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to create household invitation'));
    }
  }

  async listInvitations(householdId: string): Promise<Result<readonly HouseholdInvitation[]>> {
    try {
      const { data, error } = await supabase.rpc('list_household_invitations', {
        p_household_id: householdId,
      });

      if (error) {
        return err(new Error(error.message));
      }

      const rows = Array.isArray(data) ? data : [];
      const invitations: HouseholdInvitation[] = rows.map((row: any) => ({
        id: String(row.id),
        householdId: String(row.household_id || householdId),
        familyMemberId: row.family_member_id ? String(row.family_member_id) : undefined,
        familyMemberName: row.family_member_name ? String(row.family_member_name) : undefined,
        invitedEmail: String(row.invited_email),
        householdRole: row.role as Exclude<HouseholdRole, 'primary_owner'>,
        status: row.status as HouseholdInvitation['status'],
        expiresAt: String(row.expires_at),
        acceptedAt: row.accepted_at ? String(row.accepted_at) : undefined,
        revokedAt: row.revoked_at ? String(row.revoked_at) : undefined,
        createdAt: String(row.created_at),
      }));

      return ok(invitations);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to list household invitations'));
    }
  }

  async revokeInvitation(invitationId: string): Promise<Result<void>> {
    try {
      const { error } = await supabase.rpc('revoke_household_invitation', {
        p_invitation_id: invitationId,
      });

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to revoke household invitation'));
    }
  }

  async previewInvitation(token: string): Promise<Result<HouseholdInvitationPreview>> {
    try {
      const { data, error } = await supabase.rpc('preview_household_invitation', {
        p_token: token,
      });

      if (error || !data) {
        return err(new Error(error?.message || 'Failed to preview invitation'));
      }

      return ok({
        valid: Boolean(data.valid),
        reason: data.reason ? String(data.reason) : undefined,
        householdName: data.household_name ? String(data.household_name) : undefined,
        familyMemberName: data.family_member_name ? String(data.family_member_name) : undefined,
        invitedEmail: data.masked_email ? String(data.masked_email) : undefined,
        householdRole: data.role
          ? (String(data.role) as Exclude<HouseholdRole, 'primary_owner'>)
          : undefined,
        expiresAt: data.expires_at ? String(data.expires_at) : undefined,
      });
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to preview invitation'));
    }
  }

  async acceptInvitation(token: string): Promise<Result<AcceptHouseholdInvitationResult>> {
    try {
      const { data, error } = await supabase.rpc('accept_household_invitation', {
        p_token: token,
      });

      if (error || !data) {
        return err(new Error(error?.message || 'Failed to accept household invitation'));
      }

      return ok({
        householdId: String(data.household_id),
        householdRole: data.household_role as HouseholdRole,
        familyMemberId: data.family_member_id ? String(data.family_member_id) : undefined,
      });
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to accept household invitation'));
    }
  }

  async unlinkFamilyMemberAccount(
    householdId: string,
    familyMemberId: string
  ): Promise<Result<void>> {
    try {
      const { error } = await supabase.rpc('unlink_family_member_account', {
        p_household_id: householdId,
        p_family_member_id: familyMemberId,
      });

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to unlink family member login'));
    }
  }

  async listFamilyMemberAccess(
    householdId: string,
    familyMemberId?: string
  ): Promise<Result<readonly FamilyMemberAccessGrant[]>> {
    try {
      let query = supabase
        .from('family_member_access')
        .select('*')
        .eq('household_id', householdId);

      if (familyMemberId) {
        query = query.eq('family_member_id', familyMemberId);
      }

      const { data, error } = await query.order('created_at', { ascending: true });
      if (error) {
        return err(new Error(error.message));
      }

      const grants: FamilyMemberAccessGrant[] = (data || []).map((row: any) => ({
        id: row.id,
        householdId: row.household_id,
        familyMemberId: row.family_member_id,
        userId: row.user_id,
        canView: true,
        canManage: row.permission === 'manage',
        grantedByUserId: row.granted_by ?? undefined,
        createdAt: row.created_at ?? undefined,
      }));

      return ok(grants);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to list family member access grants'));
    }
  }

  async upsertFamilyMemberAccess(params: SetFamilyMemberAccessParams): Promise<Result<void>> {
    try {
      if (!params.canView && !params.canManage) {
        const { error } = await supabase
          .from('family_member_access')
          .delete()
          .eq('family_member_id', params.familyMemberId)
          .eq('user_id', params.userId);
        if (error) {
          return err(new Error(error.message));
        }
        return ok(undefined);
      }

      const { error } = await supabase.from('family_member_access').upsert(
        {
          household_id: params.householdId,
          family_member_id: params.familyMemberId,
          user_id: params.userId,
          permission: params.canManage ? 'manage' : 'view',
        },
        { onConflict: 'family_member_id,user_id' }
      );

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to update family member access grant'));
    }
  }

  async removeFamilyMemberAccess(id: string): Promise<Result<void>> {
    try {
      const { error } = await supabase.from('family_member_access').delete().eq('id', id);
      if (error) {
        return err(new Error(error.message));
      }
      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to remove family member access grant'));
    }
  }

  async listRestrictedRecordGrants(
    householdId: string,
    recordType?: RestrictedRecordTargetType,
    recordId?: string
  ): Promise<Result<readonly RestrictedRecordGrant[]>> {
    try {
      let query = supabase
        .from('restricted_record_grants')
        .select('*')
        .eq('household_id', householdId);

      if (recordType) {
        query = query.eq('record_type', toPgRestrictedRecordType(recordType));
      }
      if (recordId) {
        query = query.eq('record_id', recordId);
      }

      const { data, error } = await query.order('created_at', { ascending: true });
      if (error) {
        return err(new Error(error.message));
      }

      const grants: RestrictedRecordGrant[] = (data || []).map((row: any) => ({
        id: row.id,
        householdId: row.household_id,
        recordType: fromPgRestrictedRecordType(row.record_type),
        recordId: row.record_id,
        granteeUserId: row.user_id,
        canEdit: row.permission === 'manage',
        grantedByUserId: row.granted_by ?? undefined,
        createdAt: row.created_at ?? undefined,
      }));

      return ok(grants);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to list restricted record grants'));
    }
  }

  async upsertRestrictedRecordGrant(params: SetRestrictedRecordGrantParams): Promise<Result<void>> {
    try {
      const { error } = await supabase.from('restricted_record_grants').upsert(
        {
          household_id: params.householdId,
          record_type: toPgRestrictedRecordType(params.recordType),
          record_id: params.recordId,
          user_id: params.granteeUserId,
          permission: params.canEdit ? 'manage' : 'view',
        },
        { onConflict: 'record_type,record_id,user_id' }
      );

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to save restricted record grant'));
    }
  }

  async removeRestrictedRecordGrant(id: string): Promise<Result<void>> {
    try {
      const { error } = await supabase.from('restricted_record_grants').delete().eq('id', id);
      if (error) {
        return err(new Error(error.message));
      }
      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to remove restricted record grant'));
    }
  }

  async listAuditLogs(
    householdId: string,
    limit = 50
  ): Promise<Result<readonly HouseholdAuditLogEntry[]>> {
    try {
      const { data, error } = await supabase
        .from('household_audit_logs')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return err(new Error(error.message));
      }

      const logs: HouseholdAuditLogEntry[] = (data || []).map((row: any) => ({
        id: row.id,
        householdId: row.household_id,
        actorUserId: row.actor_user_id ?? undefined,
        targetUserId: row.target_user_id ?? undefined,
        targetFamilyMemberId: row.target_family_member_id ?? undefined,
        action: row.action,
        metadata: (row.metadata || {}) as Record<string, unknown>,
        createdAt: row.created_at,
      }));

      return ok(logs);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to list household audit logs'));
    }
  }
}
