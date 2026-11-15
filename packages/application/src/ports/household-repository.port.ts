import { Result } from '@wealthnest/shared';
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

export interface CreateHouseholdInvitationParams {
  readonly householdId: string;
  readonly invitedEmail: string;
  readonly role: Exclude<HouseholdRole, 'primary_owner'>;
  readonly familyMemberId?: string;
  readonly expiresInHours?: number;
}

export interface CreatedHouseholdInvitationResult {
  readonly invitationId: string;
  readonly householdId: string;
  readonly familyMemberId?: string;
  readonly invitedEmail: string;
  readonly role: Exclude<HouseholdRole, 'primary_owner'>;
  readonly expiresAt: string;
  readonly inviteToken: string;
}

export interface AcceptHouseholdInvitationResult {
  readonly householdId: string;
  readonly householdRole: HouseholdRole;
  readonly familyMemberId?: string;
}

export interface SetFamilyMemberAccessParams {
  readonly householdId: string;
  readonly familyMemberId: string;
  readonly userId: string;
  readonly canView: boolean;
  readonly canManage: boolean;
}

export interface SetRestrictedRecordGrantParams {
  readonly householdId: string;
  readonly recordType: RestrictedRecordTargetType;
  readonly recordId: string;
  readonly granteeUserId: string;
  readonly canEdit: boolean;
}

export interface HouseholdRepositoryPort {
  listMyHouseholds(): Promise<Result<readonly HouseholdSummary[]>>;
  ensureDefaultHousehold(displayName?: string): Promise<Result<string>>;
  createHousehold(name: string, displayName?: string): Promise<Result<HouseholdSummary>>;
  renameHousehold(householdId: string, name: string): Promise<Result<void>>;

  listAccessMembers(householdId: string): Promise<Result<readonly HouseholdAccessMember[]>>;
  appointAdmin(
    householdId: string,
    targetUserId: string,
    grant: boolean
  ): Promise<Result<void>>;
  setMemberRole(
    householdId: string,
    targetUserId: string,
    role: Exclude<HouseholdRole, 'primary_owner'>
  ): Promise<Result<void>>;
  transferPrimaryOwner(householdId: string, newOwnerUserId: string): Promise<Result<void>>;
  revokeOrRestoreMember(
    householdId: string,
    targetUserId: string,
    status: HouseholdMembershipStatus
  ): Promise<Result<void>>;

  createInvitation(
    params: CreateHouseholdInvitationParams
  ): Promise<Result<CreatedHouseholdInvitationResult>>;
  listInvitations(householdId: string): Promise<Result<readonly HouseholdInvitation[]>>;
  revokeInvitation(invitationId: string): Promise<Result<void>>;
  previewInvitation(token: string): Promise<Result<HouseholdInvitationPreview>>;
  acceptInvitation(token: string): Promise<Result<AcceptHouseholdInvitationResult>>;
  unlinkFamilyMemberAccount(householdId: string, familyMemberId: string): Promise<Result<void>>;

  listFamilyMemberAccess(
    householdId: string,
    familyMemberId?: string
  ): Promise<Result<readonly FamilyMemberAccessGrant[]>>;
  upsertFamilyMemberAccess(params: SetFamilyMemberAccessParams): Promise<Result<void>>;
  removeFamilyMemberAccess(id: string): Promise<Result<void>>;

  listRestrictedRecordGrants(
    householdId: string,
    recordType?: RestrictedRecordTargetType,
    recordId?: string
  ): Promise<Result<readonly RestrictedRecordGrant[]>>;
  upsertRestrictedRecordGrant(params: SetRestrictedRecordGrantParams): Promise<Result<void>>;
  removeRestrictedRecordGrant(id: string): Promise<Result<void>>;

  listAuditLogs(
    householdId: string,
    limit?: number
  ): Promise<Result<readonly HouseholdAuditLogEntry[]>>;
}
