import { Result, err } from '@wealthnest/shared';
import {
  HouseholdSummary,
  HouseholdAccessMember,
  HouseholdInvitation,
  HouseholdInvitationPreview,
  HouseholdAuditLogEntry,
  HouseholdRole,
  HouseholdMembershipStatus,
  RestrictedRecordGrant,
  RestrictedRecordTargetType,
} from '@wealthnest/domain';
import {
  HouseholdRepositoryPort,
  CreateHouseholdInvitationParams,
  CreatedHouseholdInvitationResult,
  AcceptHouseholdInvitationResult,
  SetRestrictedRecordGrantParams,
} from '../ports/household-repository.port.js';

export class ManageHouseholdUseCase {
  constructor(private readonly householdRepo: HouseholdRepositoryPort) {}

  listMyHouseholds(): Promise<Result<readonly HouseholdSummary[]>> {
    return this.householdRepo.listMyHouseholds();
  }

  ensureDefaultHousehold(displayName?: string): Promise<Result<string>> {
    return this.householdRepo.ensureDefaultHousehold(displayName);
  }

  createHousehold(name: string, displayName?: string): Promise<Result<HouseholdSummary>> {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      return Promise.resolve(err(new Error('Household name must be at least 2 characters.')));
    }
    return this.householdRepo.createHousehold(trimmed, displayName);
  }

  renameHousehold(householdId: string, name: string): Promise<Result<void>> {
    const trimmed = name.trim();
    if (!householdId || trimmed.length < 2) {
      return Promise.resolve(err(new Error('Valid household ID and name are required.')));
    }
    return this.householdRepo.renameHousehold(householdId, trimmed);
  }

  listAccessMembers(householdId: string): Promise<Result<readonly HouseholdAccessMember[]>> {
    if (!householdId) {
      return Promise.resolve(err(new Error('Household ID is required.')));
    }
    return this.householdRepo.listAccessMembers(householdId);
  }

  appointAdmin(householdId: string, targetUserId: string, grant: boolean): Promise<Result<void>> {
    if (!householdId || !targetUserId) {
      return Promise.resolve(err(new Error('Household ID and target user ID are required.')));
    }
    return this.householdRepo.appointAdmin(householdId, targetUserId, grant);
  }

  setMemberRole(
    householdId: string,
    targetUserId: string,
    role: Exclude<HouseholdRole, 'primary_owner'>
  ): Promise<Result<void>> {
    if (!householdId || !targetUserId) {
      return Promise.resolve(err(new Error('Household ID and target user ID are required.')));
    }
    return this.householdRepo.setMemberRole(householdId, targetUserId, role);
  }

  transferPrimaryOwner(householdId: string, newOwnerUserId: string): Promise<Result<void>> {
    if (!householdId || !newOwnerUserId) {
      return Promise.resolve(err(new Error('Household ID and new owner user ID are required.')));
    }
    return this.householdRepo.transferPrimaryOwner(householdId, newOwnerUserId);
  }

  revokeOrRestoreMember(
    householdId: string,
    targetUserId: string,
    status: HouseholdMembershipStatus
  ): Promise<Result<void>> {
    if (!householdId || !targetUserId) {
      return Promise.resolve(err(new Error('Household ID and target user ID are required.')));
    }
    return this.householdRepo.revokeOrRestoreMember(householdId, targetUserId, status);
  }

  createInvitation(
    params: CreateHouseholdInvitationParams
  ): Promise<Result<CreatedHouseholdInvitationResult>> {
    const email = params.invitedEmail.trim().toLowerCase();
    if (!params.householdId || !email || !email.includes('@')) {
      return Promise.resolve(err(new Error('A valid recipient email address is required.')));
    }
    return this.householdRepo.createInvitation({
      ...params,
      invitedEmail: email,
    });
  }

  listInvitations(householdId: string): Promise<Result<readonly HouseholdInvitation[]>> {
    if (!householdId) {
      return Promise.resolve(err(new Error('Household ID is required.')));
    }
    return this.householdRepo.listInvitations(householdId);
  }

  revokeInvitation(invitationId: string): Promise<Result<void>> {
    if (!invitationId) {
      return Promise.resolve(err(new Error('Invitation ID is required.')));
    }
    return this.householdRepo.revokeInvitation(invitationId);
  }

  previewInvitation(token: string): Promise<Result<HouseholdInvitationPreview>> {
    if (!token || token.trim().length < 8) {
      return Promise.resolve(err(new Error('Valid invitation token is required.')));
    }
    return this.householdRepo.previewInvitation(token.trim());
  }

  acceptInvitation(token: string): Promise<Result<AcceptHouseholdInvitationResult>> {
    if (!token || token.trim().length < 8) {
      return Promise.resolve(err(new Error('Valid invitation token is required.')));
    }
    return this.householdRepo.acceptInvitation(token.trim());
  }

  unlinkFamilyMemberAccount(householdId: string, familyMemberId: string): Promise<Result<void>> {
    if (!householdId || !familyMemberId) {
      return Promise.resolve(err(new Error('Household ID and family member ID are required.')));
    }
    return this.householdRepo.unlinkFamilyMemberAccount(householdId, familyMemberId);
  }

  listRestrictedGrants(
    householdId: string,
    recordType?: RestrictedRecordTargetType,
    recordId?: string
  ): Promise<Result<readonly RestrictedRecordGrant[]>> {
    if (!householdId) {
      return Promise.resolve(err(new Error('Household ID is required.')));
    }
    return this.householdRepo.listRestrictedRecordGrants(householdId, recordType, recordId);
  }

  upsertRestrictedGrant(params: SetRestrictedRecordGrantParams): Promise<Result<void>> {
    if (!params.householdId || !params.recordId || !params.granteeUserId) {
      return Promise.resolve(
        err(new Error('Household ID, record ID, and grantee user ID are required.'))
      );
    }
    return this.householdRepo.upsertRestrictedRecordGrant(params);
  }

  removeRestrictedGrant(id: string): Promise<Result<void>> {
    if (!id) {
      return Promise.resolve(err(new Error('Grant ID is required.')));
    }
    return this.householdRepo.removeRestrictedRecordGrant(id);
  }

  listAuditLogs(
    householdId: string,
    limit: number = 50
  ): Promise<Result<readonly HouseholdAuditLogEntry[]>> {
    if (!householdId) {
      return Promise.resolve(err(new Error('Household ID is required.')));
    }
    return this.householdRepo.listAuditLogs(householdId, limit);
  }
}
