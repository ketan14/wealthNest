import { describe, it, expect } from 'vitest';
import {
  canModifyUserStatus,
  validateStatusChange,
  canManagePlatformRole,
  validateRoleRevocation,
  sanitizeAuditMetadata,
  isFinancialDataIsolatedFromAdmin,
  PRIVATE_FINANCIAL_TABLES,
} from '../admin/admin-invariants.js';

describe('Admin Domain Invariants & Security Rules', () => {
  describe('canModifyUserStatus', () => {
    it('allows super_admin and support_admin to manage user status', () => {
      expect(canModifyUserStatus('super_admin')).toBe(true);
      expect(canModifyUserStatus('support_admin')).toBe(true);
    });

    it('denies auditor and unassigned callers from managing user status', () => {
      expect(canModifyUserStatus('auditor')).toBe(false);
      expect(canModifyUserStatus(undefined)).toBe(false);
    });
  });

  describe('validateStatusChange', () => {
    const actorId = 'user-admin-ketan-vaghela';
    const otherUserId = 'user-regular-vaghela';

    it('prevents self-suspension or self-deactivation', () => {
      const suspension = validateStatusChange(actorId, actorId, 'suspended', 'SECURITY_REVIEW');
      expect(suspension.allowed).toBe(false);
      expect(suspension.reason).toMatch(/cannot suspend or deactivate your own account/i);

      const deactivation = validateStatusChange(actorId, actorId, 'deactivated', 'OFFBOARDING');
      expect(deactivation.allowed).toBe(false);
    });

    it('mandates a reason code when suspending or deactivating accounts', () => {
      const missingReason = validateStatusChange(actorId, otherUserId, 'suspended', '');
      expect(missingReason.allowed).toBe(false);
      expect(missingReason.reason).toMatch(/reason code is required/i);

      const undefinedReason = validateStatusChange(actorId, otherUserId, 'deactivated', undefined);
      expect(undefinedReason.allowed).toBe(false);
    });

    it('permits valid suspension with a reason code', () => {
      const valid = validateStatusChange(actorId, otherUserId, 'suspended', 'POLICY_VIOLATION');
      expect(valid.allowed).toBe(true);
    });

    it('permits reactivating an account without requiring a negative reason code', () => {
      const valid = validateStatusChange(actorId, otherUserId, 'active');
      expect(valid.allowed).toBe(true);
    });
  });

  describe('canManagePlatformRole', () => {
    it('restricts role grants and revocations strictly to super_admin', () => {
      expect(canManagePlatformRole('super_admin')).toBe(true);
      expect(canManagePlatformRole('support_admin')).toBe(false);
      expect(canManagePlatformRole('auditor')).toBe(false);
      expect(canManagePlatformRole(undefined)).toBe(false);
    });
  });

  describe('validateRoleRevocation', () => {
    it('prevents revoking the last active super_admin', () => {
      const attempt = validateRoleRevocation('super_admin', 1);
      expect(attempt.allowed).toBe(false);
      expect(attempt.reason).toMatch(/cannot revoke the last active super_admin/i);
    });

    it('allows revoking super_admin if another super_admin remains', () => {
      const attempt = validateRoleRevocation('super_admin', 2);
      expect(attempt.allowed).toBe(true);
    });

    it('allows revoking support_admin or auditor even if count is 1', () => {
      expect(validateRoleRevocation('support_admin', 1).allowed).toBe(true);
      expect(validateRoleRevocation('auditor', 1).allowed).toBe(true);
    });
  });

  describe('sanitizeAuditMetadata', () => {
    it('redacts sensitive credentials, tokens, passwords, and identity numbers', () => {
      const rawMetadata = {
        actorEmail: 'ketan.vaghela@wealthnest.local',
        targetHousehold: 'Vaghela Household',
        password: 'superSecretPassword123!',
        access_token: 'jwt.token.here',
        user_pan: 'ABCDE1234F',
        aadhaar_number: '1234 5678 9012',
        session: {
          bearer_token: 'secret_bearer',
          ip: '192.168.1.5',
        },
      };

      const sanitized = sanitizeAuditMetadata(rawMetadata);

      expect(sanitized.actorEmail).toBe('ketan.vaghela@wealthnest.local');
      expect(sanitized.targetHousehold).toBe('Vaghela Household');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.access_token).toBe('[REDACTED]');
      expect(sanitized.user_pan).toBe('[REDACTED]');
      expect(sanitized.aadhaar_number).toBe('[REDACTED]');
      expect((sanitized.session as Record<string, unknown>).bearer_token).toBe('[REDACTED]');
      expect((sanitized.session as Record<string, unknown>).ip).toBe('192.168.1.5');
    });
  });

  describe('isFinancialDataIsolatedFromAdmin', () => {
    it('confirms all private user financial tables are isolated from platform administration', () => {
      expect(PRIVATE_FINANCIAL_TABLES).toContain('holdings');
      expect(PRIVATE_FINANCIAL_TABLES).toContain('transactions');
      expect(PRIVATE_FINANCIAL_TABLES).toContain('liabilities');
      expect(PRIVATE_FINANCIAL_TABLES).toContain('goals');

      for (const table of PRIVATE_FINANCIAL_TABLES) {
        expect(isFinancialDataIsolatedFromAdmin(table)).toBe(true);
      }
    });

    it('returns false for public or administrative tables', () => {
      expect(isFinancialDataIsolatedFromAdmin('profiles')).toBe(false);
      expect(isFinancialDataIsolatedFromAdmin('platform_admin_roles')).toBe(false);
      expect(isFinancialDataIsolatedFromAdmin('admin_audit_logs')).toBe(false);
      expect(isFinancialDataIsolatedFromAdmin('households')).toBe(false);
    });
  });
});
