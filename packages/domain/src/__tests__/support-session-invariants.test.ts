import { describe, it, expect } from 'vitest';
import {
  canInitiateSupportSession,
  validateSupportSessionRequest,
  calculateRemainingSeconds,
  isSupportSessionExpired,
  formatRemainingSessionTime,
} from '../admin/support-session-invariants.js';

describe('Support Session Invariants', () => {
  describe('canInitiateSupportSession', () => {
    it('permits super_admin to initiate support sessions', () => {
      expect(canInitiateSupportSession('super_admin')).toBe(true);
    });

    it('permits support_admin to initiate support sessions', () => {
      expect(canInitiateSupportSession('support_admin')).toBe(true);
    });

    it('prohibits auditor from initiating support sessions', () => {
      expect(canInitiateSupportSession('auditor')).toBe(false);
    });

    it('prohibits undefined role from initiating support sessions', () => {
      expect(canInitiateSupportSession(undefined)).toBe(false);
    });
  });

  describe('validateSupportSessionRequest', () => {
    const adminId = 'a1111111-1111-1111-1111-111111111111'; // Ketan Vaghela (Admin)
    const targetUserId = 'b2222222-2222-2222-2222-222222222222'; // Parul Vaghela (Target)

    it('permits valid support session request with sufficient reason length', () => {
      const result = validateSupportSessionRequest(
        adminId,
        targetUserId,
        'Investigating portfolio synchronization discrepancy reported in ticket #402'
      );
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('rejects self-impersonation when adminId equals targetUserId', () => {
      const result = validateSupportSessionRequest(
        adminId,
        adminId,
        'Testing my own portfolio in support view'
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('cannot initiate a support view session for your own administrator account');
    });

    it('rejects empty or whitespace reason', () => {
      const result = validateSupportSessionRequest(adminId, targetUserId, '   ');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('minimum 8 characters');
    });

    it('rejects reason shorter than 8 characters', () => {
      const result = validateSupportSessionRequest(adminId, targetUserId, 'Help');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('minimum 8 characters');
    });

    it('rejects missing adminId or targetUserId', () => {
      const res1 = validateSupportSessionRequest('', targetUserId, 'Valid ticket reason');
      expect(res1.allowed).toBe(false);
      const res2 = validateSupportSessionRequest(adminId, '', 'Valid ticket reason');
      expect(res2.allowed).toBe(false);
    });
  });

  describe('Expiration & Time Calculation', () => {
    it('calculates remaining seconds correctly', () => {
      const now = new Date('2026-10-24T10:00:00Z');
      const future = new Date('2026-10-24T10:15:00Z'); // 15 mins later
      expect(calculateRemainingSeconds(future, now)).toBe(900);
    });

    it('returns 0 remaining seconds for past expiration', () => {
      const now = new Date('2026-10-24T10:15:00Z');
      const past = new Date('2026-10-24T10:00:00Z');
      expect(calculateRemainingSeconds(past, now)).toBe(0);
    });

    it('identifies expired session correctly', () => {
      const now = new Date('2026-10-24T10:15:01Z');
      const expiry = new Date('2026-10-24T10:15:00Z');
      expect(isSupportSessionExpired(expiry, now)).toBe(true);
    });

    it('identifies active session correctly', () => {
      const now = new Date('2026-10-24T10:14:59Z');
      const expiry = new Date('2026-10-24T10:15:00Z');
      expect(isSupportSessionExpired(expiry, now)).toBe(false);
    });

    it('formats remaining seconds in MM:SS', () => {
      expect(formatRemainingSessionTime(900)).toBe('15:00');
      expect(formatRemainingSessionTime(899)).toBe('14:59');
      expect(formatRemainingSessionTime(65)).toBe('01:05');
      expect(formatRemainingSessionTime(9)).toBe('00:09');
      expect(formatRemainingSessionTime(0)).toBe('00:00');
      expect(formatRemainingSessionTime(-10)).toBe('00:00');
    });
  });
});
