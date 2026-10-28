import { Result, ok, err } from '@wealthnest/shared';

/**
 * Cross-User and Cross-Household Isolation Invariants
 * 
 * Enforces zero cross-tenant contamination across all database adapters (PostgreSQL RLS,
 * offline SQLite, and in-memory caches). A user or household must NEVER be able to:
 * 1. Link a holding to an asset belonging to another user.
 * 2. Associate a transaction with another user's demat account or family member.
 * 3. Link a liability to another user's real estate property.
 * 4. Record valuations or loan repayments against unowned entities.
 * 5. Import or restore backup data belonging to a different user identity without explicit re-homing.
 */

export interface OwnershipEntityReference {
  readonly entityId: string;
  readonly entityType: 'asset' | 'holding' | 'transaction' | 'liability' | 'account' | 'member' | 'valuation';
  readonly ownerUserId: string;
}

export class CrossUserIsolationViolationError extends Error {
  constructor(message: string) {
    super(`CrossUserIsolationViolation: ${message}`);
    this.name = 'CrossUserIsolationViolationError';
  }
}

/**
 * Validates that all referenced sub-entities strictly match the authenticated actor's userId.
 */
export function validateCrossUserOwnership(
  actingUserId: string,
  references: readonly OwnershipEntityReference[]
): Result<void> {
  if (!actingUserId || actingUserId.trim() === '') {
    return err(new CrossUserIsolationViolationError('Acting userId is missing or invalid'));
  }

  for (const ref of references) {
    if (ref.ownerUserId !== actingUserId) {
      return err(
        new CrossUserIsolationViolationError(
          `Unauthorized cross-user reference: ${ref.entityType} '${ref.entityId}' is owned by user '${ref.ownerUserId}', not acting user '${actingUserId}'.`
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
  liabilityOwnerUserId: string
): Result<void> {
  if (assetOwnerUserId !== actingUserId) {
    return err(
      new CrossUserIsolationViolationError(
        `Asset owner '${assetOwnerUserId}' does not match acting user '${actingUserId}'`
      )
    );
  }
  if (liabilityOwnerUserId !== actingUserId) {
    return err(
      new CrossUserIsolationViolationError(
        `Liability owner '${liabilityOwnerUserId}' does not match acting user '${actingUserId}'`
      )
    );
  }
  return ok(undefined);
}

/**
 * Validates that a demat/portfolio account belongs to the same user and family member.
 */
export function validateAccountMemberIsolation(
  actingUserId: string,
  accountOwnerUserId: string,
  memberOwnerUserId: string
): Result<void> {
  if (accountOwnerUserId !== actingUserId) {
    return err(
      new CrossUserIsolationViolationError(
        `Account owner '${accountOwnerUserId}' does not match acting user '${actingUserId}'`
      )
    );
  }
  if (memberOwnerUserId !== actingUserId) {
    return err(
      new CrossUserIsolationViolationError(
        `Family member owner '${memberOwnerUserId}' does not match acting user '${actingUserId}'`
      )
    );
  }
  return ok(undefined);
}
