import { describe, it, expect } from 'vitest';
import {
  isAccountVisibleToViewer,
  filterRecordsByPrivacy,
  summarizeHouseholdPrivacy,
  AccountVisibilityScope,
} from '../family/family-privacy.js';

describe('Member-Level Household Privacy Controls', () => {
  const privacyRules: Record<string, AccountVisibilityScope> = {
    'acc-groww-parul': 'owner_only',
    'acc-zerodha-ketan': 'shared_family',
  };

  it('hides owner_only accounts in Combined Family view and from other members, but shows to owner', () => {
    expect(
      isAccountVisibleToViewer({
        accountId: 'acc-groww-parul',
        ownerMemberId: 'mem-spouse',
        viewerMemberId: 'all',
        privacyRules,
      })
    ).toBe(false);

    expect(
      isAccountVisibleToViewer({
        accountId: 'acc-groww-parul',
        ownerMemberId: 'mem-spouse',
        viewerMemberId: 'mem-self',
        privacyRules,
      })
    ).toBe(false);

    expect(
      isAccountVisibleToViewer({
        accountId: 'acc-groww-parul',
        ownerMemberId: 'mem-spouse',
        viewerMemberId: 'mem-spouse',
        privacyRules,
      })
    ).toBe(true);
  });

  it('filters records by privacy rules and summarizes shared vs private accounts', () => {
    const records = [
      { id: 'h-1', accountId: 'acc-zerodha-ketan', memberId: 'mem-self' },
      { id: 'h-2', accountId: 'acc-groww-parul', memberId: 'mem-spouse' },
      { id: 'h-3', accountId: 'acc-huf-cams', memberId: 'mem-huf' },
    ];

    const familyVisible = filterRecordsByPrivacy(records, 'all', privacyRules);
    expect(familyVisible.map((r) => r.id)).toEqual(['h-1', 'h-3']);

    const spouseVisible = filterRecordsByPrivacy(records, 'mem-spouse', privacyRules);
    expect(spouseVisible.map((r) => r.id)).toEqual(['h-1', 'h-2', 'h-3']);

    const summary = summarizeHouseholdPrivacy(
      [{ id: 'acc-zerodha-ketan' }, { id: 'acc-groww-parul' }, { id: 'acc-huf-cams' }],
      privacyRules
    );
    expect(summary.totalAccounts).toBe(3);
    expect(summary.sharedCount).toBe(2);
    expect(summary.privateCount).toBe(1);
    expect(summary.privateAccountIds).toEqual(['acc-groww-parul']);
  });
});

