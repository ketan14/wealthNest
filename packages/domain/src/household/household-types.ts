import type { CustomPlanLimits, PlanTier } from '../plans/plan-entitlements.js';

export type HouseholdRole = 'primary_owner' | 'admin' | 'member' | 'viewer';

export type HouseholdMembershipStatus = 'active' | 'revoked';

export type RecordVisibility = 'household_shared' | 'owner_only' | 'restricted';

export type FamilyEntityType = 'individual' | 'huf' | 'minor' | 'joint_pool';

export type HouseholdInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export type LiabilityPartyRole = 'primary_borrower' | 'co_borrower' | 'guarantor';

export type RestrictedRecordTargetType =
  | 'holding'
  | 'transaction'
  | 'liability'
  | 'goal'
  | 'family_document'
  | 'portfolio_account'
  | 'asset'
  | 'asset_valuation'
  | 'cas_import_batch'
  | 'liability_balance'
  | 'loan_payment'
  | 'asset_liability_link'
  | 'goal_holding_link';

export interface HouseholdSummary {
  readonly id: string;
  readonly name: string;
  readonly createdBy?: string;
  readonly role: HouseholdRole;
  readonly status: HouseholdMembershipStatus;
  readonly isDefault?: boolean;
  readonly memberCount?: number;
  readonly planTier?: PlanTier;
  readonly customLimits?: CustomPlanLimits | null;
  readonly planExpiresAt?: string | null;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface HouseholdAccessMember {
  readonly id: string;
  readonly householdId: string;
  readonly userId: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly householdRole: HouseholdRole;
  readonly status: HouseholdMembershipStatus;
  readonly joinedAt: string;
  readonly linkedFamilyMemberId?: string;
  readonly linkedFamilyMemberName?: string;
}

export interface HouseholdInvitation {
  readonly id: string;
  readonly householdId: string;
  readonly householdName?: string;
  readonly familyMemberId?: string;
  readonly familyMemberName?: string;
  readonly invitedEmail: string;
  readonly householdRole: Exclude<HouseholdRole, 'primary_owner'>;
  readonly grantMemberManage?: boolean;
  readonly status: HouseholdInvitationStatus;
  readonly expiresAt: string;
  readonly acceptedAt?: string;
  readonly acceptedByUserId?: string;
  readonly revokedAt?: string;
  readonly createdAt: string;
}

export interface HouseholdInvitationPreview {
  readonly valid: boolean;
  readonly reason?: string;
  readonly householdId?: string;
  readonly householdName?: string;
  readonly familyMemberId?: string;
  readonly familyMemberName?: string;
  readonly invitedEmail?: string;
  readonly householdRole?: Exclude<HouseholdRole, 'primary_owner'>;
  readonly expiresAt?: string;
}

export interface HouseholdAuditLogEntry {
  readonly id: string;
  readonly householdId: string;
  readonly actorUserId?: string;
  readonly targetUserId?: string;
  readonly targetFamilyMemberId?: string;
  readonly action: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface HoldingOwner {
  readonly id?: string;
  readonly householdId?: string;
  readonly holdingId: string;
  readonly familyMemberId: string;
  readonly ownershipShare: number; // 0 < share <= 100
  readonly isPrimaryOwner: boolean;
}

export interface HoldingOwnerShareInput {
  readonly familyMemberId: string;
  readonly ownershipShare: number;
  readonly isPrimaryOwner?: boolean;
}

export interface LiabilityParty {
  readonly id?: string;
  readonly householdId?: string;
  readonly liabilityId: string;
  readonly familyMemberId: string;
  readonly partyRole: LiabilityPartyRole;
  readonly liabilityShare: number; // 0 < share <= 100
}

export interface LiabilityPartyShareInput {
  readonly familyMemberId: string;
  readonly partyRole: LiabilityPartyRole;
  readonly liabilityShare: number;
}

export interface FamilyMemberAccessGrant {
  readonly id: string;
  readonly householdId: string;
  readonly familyMemberId: string;
  readonly userId: string;
  readonly canView: boolean;
  readonly canManage: boolean;
  readonly grantedByUserId?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface RestrictedRecordGrant {
  readonly id: string;
  readonly householdId: string;
  readonly recordType: RestrictedRecordTargetType;
  readonly recordId: string;
  readonly granteeUserId: string;
  readonly canEdit: boolean;
  readonly grantedByUserId?: string;
  readonly createdAt?: string;
}

export const RECORD_VISIBILITY_OPTIONS: readonly {
  readonly value: RecordVisibility;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    value: 'household_shared',
    label: 'Household Shared',
    description: 'Visible to all active members of this household according to their role.',
  },
  {
    value: 'owner_only',
    label: 'Owner Only (Private)',
    description:
      'Visible only to the record creator and linked owner(s). Hidden from other admins and owners.',
  },
  {
    value: 'restricted',
    label: 'Restricted (Selected Users)',
    description:
      'Visible only to the owner(s), creator, and explicitly granted household members.',
  },
] as const;

export function canHouseholdRoleEditFinancials(role: HouseholdRole | undefined): boolean {
  return role === 'primary_owner' || role === 'admin' || role === 'member';
}

export function canHouseholdRoleManageMembers(role: HouseholdRole | undefined): boolean {
  return role === 'primary_owner' || role === 'admin';
}

export function canHouseholdRoleManageAdminsOrTransfer(role: HouseholdRole | undefined): boolean {
  return role === 'primary_owner';
}
