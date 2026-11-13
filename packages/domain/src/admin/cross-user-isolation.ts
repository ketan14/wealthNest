import { Result, ok, err } from '@wealthnest/shared';

/**
 * Cross-User and Cross-Household Isolation Invariants
 *
 * Enforces zero cross-tenant contamination across all database adapters (PostgreSQL RLS,
 * offline SQLite, and in-memory caches). A user or household must NEVER be able to:
 * 1. Link a holding to an asset belonging to another household.
 * 2. Associate a transaction with another household's demat account or family member.
 * 3. Link a liability to another household's real estate property.
 * 4. Record valuations or loan repayments against unowned entities.
 * 5. Import or restore backup data belonging to a different tenant without explicit re-homing.
 */

export interface OwnershipEntityReference {
  readonly entityId: string;
  readonly entityType:
    'asset' | 'holding' | 'transaction' | 'liability' | 'account' | 'member' | 'valuation';
  readonly ownerUserId: string;
  readonly householdId?: string;
}

export class CrossUserIsolationViolationError extends Error {
  constructor(message: string) {
    super(`CrossUserIsolationViolation: ${message}`);
    this.name = 'CrossUserIsolationViolationError';
  }
}

/**
 * Validates that all referenced sub-entities strictly match the authenticated actor's userId,
 * or share an authorized household membership.
 */
export function validateCrossUserOwnership(
  actingUserId: string,
  references: readonly OwnershipEntityReference[],
  authorizedHouseholdMemberUserIds?: readonly string[]
): Result<void> {
  if (!actingUserId || actingUserId.trim() === '') {
    return err(new CrossUserIsolationViolationError('Acting userId is missing or invalid'));
  }

  const allowedUserIds = new Set<string>([actingUserId, ...(authorizedHouseholdMemberUserIds || [])]);

  for (const ref of references) {
    if (!allowedUserIds.has(ref.ownerUserId)) {
      return err(
        new CrossUserIsolationViolationError(
          `Unauthorized cross-user reference: ${ref.entityType} '${ref.entityId}' is owned by user '${ref.ownerUserId}', not acting user '${actingUserId}' or household.`
        )
      );
    }
  }

  return ok(undefined);
}

/**
 * Validates that an asset-liability link is within the exact same household/user boundary.
 */
export function validateAssetLiabilityLinkIsolation(
  actingUserId: string,
  assetOwnerUserId: string,
  liabilityOwnerUserId: string,
  authorizedHouseholdMemberUserIds?: readonly string[]
): Result<void> {
  const allowedUserIds = new Set<string>([actingUserId, ...(authorizedHouseholdMemberUserIds || [])]);

  if (!allowedUserIds.has(assetOwnerUserId)) {
    return err(
      new CrossUserIsolationViolationError(
        `Asset owner '${assetOwnerUserId}' is outside the authorized household boundary of acting user '${actingUserId}'`
      )
    );
  }
  if (!allowedUserIds.has(liabilityOwnerUserId)) {
    return err(
      new CrossUserIsolationViolationError(
        `Liability owner '${liabilityOwnerUserId}' is outside the authorized household boundary of acting user '${actingUserId}'`
      )
    );
  }
  return ok(undefined);
}

/**
 * Validates that a demat/portfolio account belongs to the same user or authorized household member.
 */
export function validateAccountMemberIsolation(
  actingUserId: string,
  accountOwnerUserId: string,
  memberOwnerUserId: string,
  authorizedHouseholdMemberUserIds?: readonly string[]
): Result<void> {
  const allowedUserIds = new Set<string>([actingUserId, ...(authorizedHouseholdMemberUserIds || [])]);

  if (!allowedUserIds.has(accountOwnerUserId)) {
    return err(
      new CrossUserIsolationViolationError(
        `Account owner '${accountOwnerUserId}' does not match acting user '${actingUserId}' or household`
      )
    );
  }
  if (!allowedUserIds.has(memberOwnerUserId)) {
    return err(
      new CrossUserIsolationViolationError(
        `Family member owner '${memberOwnerUserId}' does not match acting user '${actingUserId}' or household`
      )
    );
  }
  return ok(undefined);
}
