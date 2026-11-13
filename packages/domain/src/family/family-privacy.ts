export type AccountVisibilityScope = 'shared_family' | 'owner_only';

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

