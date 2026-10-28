import { describe, it, expect } from 'vitest';
import {
  validateCrossUserOwnership,
  validateAssetLiabilityLinkIsolation,
  validateAccountMemberIsolation,
  CrossUserIsolationViolationError,
} from '../admin/cross-user-isolation.js';

describe('Cross-User and Cross-Household Isolation Invariants', () => {
  const KETAN_USER_ID = 'usr-ketan-01';
  const STRANGER_USER_ID = 'usr-stranger-99';

  it('allows operations when all referenced entities belong to the acting user', () => {
    const references = [
      { entityId: 'asset-rel-1', entityType: 'asset' as const, ownerUserId: KETAN_USER_ID },
      { entityId: 'acc-zerodha-1', entityType: 'account' as const, ownerUserId: KETAN_USER_ID },
      { entityId: 'mem-parul-1', entityType: 'member' as const, ownerUserId: KETAN_USER_ID },
    ];

    const result = validateCrossUserOwnership(KETAN_USER_ID, references);
    expect(result.success).toBe(true);
  });

  it('strictly rejects operations when an asset belongs to a different user', () => {
    const references = [
      { entityId: 'asset-hcl-1', entityType: 'asset' as const, ownerUserId: STRANGER_USER_ID }, // Foreign asset!
      { entityId: 'acc-zerodha-1', entityType: 'account' as const, ownerUserId: KETAN_USER_ID },
    ];

    const result = validateCrossUserOwnership(KETAN_USER_ID, references);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(CrossUserIsolationViolationError);
      expect(result.error.message).toContain('Unauthorized cross-user reference');
      expect(result.error.message).toContain(STRANGER_USER_ID);
    }
  });

  it('rejects asset-liability links if asset or liability belongs to another household', () => {
    // Ketan's loan linked to stranger's property
    const invalidAssetResult = validateAssetLiabilityLinkIsolation(
      KETAN_USER_ID,
      STRANGER_USER_ID, // stranger asset
      KETAN_USER_ID     // ketan loan
    );
    expect(invalidAssetResult.success).toBe(false);
    if (!invalidAssetResult.success) {
      expect(invalidAssetResult.error.message).toContain('Asset owner');
    }

    // Stranger's loan linked to Ketan's property
    const invalidLoanResult = validateAssetLiabilityLinkIsolation(
      KETAN_USER_ID,
      KETAN_USER_ID,    // ketan asset
      STRANGER_USER_ID  // stranger loan
    );
    expect(invalidLoanResult.success).toBe(false);
    if (!invalidLoanResult.success) {
      expect(invalidLoanResult.error.message).toContain('Liability owner');
    }

    // Valid same-household link
    const validResult = validateAssetLiabilityLinkIsolation(
      KETAN_USER_ID,
      KETAN_USER_ID,
      KETAN_USER_ID
    );
    expect(validResult.success).toBe(true);
  });

  it('rejects portfolio account linking if family member belongs to another user', () => {
    const invalidResult = validateAccountMemberIsolation(
      KETAN_USER_ID,
      KETAN_USER_ID,
      STRANGER_USER_ID
    );
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.error.message).toContain('Family member owner');
    }

    const validResult = validateAccountMemberIsolation(
      KETAN_USER_ID,
      KETAN_USER_ID,
      KETAN_USER_ID
    );
    expect(validResult.success).toBe(true);
  });
});
