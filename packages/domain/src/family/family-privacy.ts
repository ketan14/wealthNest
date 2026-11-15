import type { RecordVisibility } from '../household/household-types.js';

export type AccountVisibilityScope = 'shared_family' | 'owner_only';

export interface RecordVisibilityEvaluationParams {
  readonly visibility: RecordVisibility | undefined;
  readonly viewerUserId: string | undefined;
  readonly creatorUserId?: string;
  readonly ownerLinkedUserIds?: readonly string[];
  readonly explicitGrantUserIds?: readonly string[];
}

/**
 * Canonical client-side evaluator mirroring PostgreSQL `can_access_household_record`:
 * - `'household_shared'` (or omitted): accessible to all active household members.
 * - `'owner_only'`: accessible ONLY to the creator or a user linked to one of the owners
 *   (NOT automatically visible to household admins or primary_owner).
 * - `'restricted'`: accessible to creator, owners, or explicitly granted users.
 */
export function isRecordVisibleToHouseholdUser(
  params: RecordVisibilityEvaluationParams
): boolean {
  const vis: RecordVisibility = params.visibility ?? 'household_shared';
  if (vis === 'household_shared') {
    return true;
  }
  if (!params.viewerUserId) {
    return false;
  }
  if (params.creatorUserId && params.creatorUserId === params.viewerUserId) {
    return true;
  }
  if (params.ownerLinkedUserIds?.includes(params.viewerUserId)) {
    return true;
  }
  if (vis === 'restricted' && params.explicitGrantUserIds?.includes(params.viewerUserId)) {
    return true;
  }
  return false;
}

export interface HouseholdPrivacySummary {
  readonly totalAccounts: number;
  readonly sharedCount: number;
  readonly privateCount: number;
  readonly privateAccountIds: readonly string[];
}

export interface AccountVisibilityCheckParams {
  readonly accountId?: string;
  readonly ownerMemberId?: string;
  readonly viewerMemberId: string | 'all';
  readonly privacyRules: Readonly<Record<string, AccountVisibilityScope>>;
}

/**
 * Determines whether a financial account (or a holding/transaction linked to it)
 * is visible to the current viewer under household privacy rules.
 *
 * - Default (unset) visibility is `'shared_family'`.
 * - `'owner_only'` accounts are hidden in `'all'` (Combined Family) view and when
 *   viewed by another family member (`viewerMemberId !== ownerMemberId`).
 */
export function isAccountVisibleToViewer(params: AccountVisibilityCheckParams): boolean {
  if (!params.accountId) return true;
  const scope = params.privacyRules[params.accountId] ?? 'shared_family';
  if (scope === 'shared_family') return true;
  if (params.viewerMemberId === 'all') return false;
  if (!params.ownerMemberId) return false;
  return params.viewerMemberId === params.ownerMemberId;
}

/**
 * Filters a list of account-scoped records (holdings, transactions, etc.)
 * according to household member privacy rules.
 */
export function filterRecordsByPrivacy<T extends { accountId?: string; memberId?: string }>(
  records: readonly T[],
  viewerMemberId: string | 'all',
  privacyRules: Readonly<Record<string, AccountVisibilityScope>>
): T[] {
  return records.filter((rec) =>
    isAccountVisibleToViewer({
      accountId: rec.accountId,
      ownerMemberId: rec.memberId,
      viewerMemberId,
      privacyRules,
    })
  );
}

/**
 * Summarizes how many household accounts are shared vs marked owner-only private.
 */
export function summarizeHouseholdPrivacy(
  accounts: readonly { id: string }[],
  privacyRules: Readonly<Record<string, AccountVisibilityScope>>
): HouseholdPrivacySummary {
  const privateAccountIds: string[] = [];
  let sharedCount = 0;

  for (const acc of accounts) {
    const scope = privacyRules[acc.id] ?? 'shared_family';
    if (scope === 'owner_only') {
      privateAccountIds.push(acc.id);
    } else {
      sharedCount += 1;
    }
  }

  return {
    totalAccounts: accounts.length,
    sharedCount,
    privateCount: privateAccountIds.length,
    privateAccountIds,
  };
}
