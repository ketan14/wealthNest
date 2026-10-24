import { PlatformRole, UserAccessStatus } from './admin-types.js';

export const PRIVATE_FINANCIAL_TABLES = [
  'holdings',
  'transactions',
  'liabilities',
  'liability_balances',
  'loan_payments',
  'goals',
  'goal_holding_allocations',
  'asset_valuations',
  'portfolio_accounts',
] as const;

export type PrivateFinancialTable = typeof PRIVATE_FINANCIAL_TABLES[number];

/**
 * Validates whether an actor with a given platform role is permitted to modify user access status.
 * Auditors have strictly read-only capabilities.
 */
export function canModifyUserStatus(actorRole?: PlatformRole): boolean {
  if (!actorRole) return false;
  return actorRole === 'super_admin' || actorRole === 'support_admin';
}

/**
 * Invariants governing user status updates:
 * 1. An administrator cannot suspend or deactivate their own account (prevents platform lockout).
 * 2. Suspending or deactivating an account requires a valid reason code.
 */
export function validateStatusChange(
  actorUserId: string,
  targetUserId: string,
  newStatus: UserAccessStatus,
  reasonCode?: string
): { allowed: boolean; reason?: string } {
  if (actorUserId === targetUserId && (newStatus === 'suspended' || newStatus === 'deactivated')) {
    return {
      allowed: false,
      reason: 'Administrative Invariant: You cannot suspend or deactivate your own account',
    };
  }

  if ((newStatus === 'suspended' || newStatus === 'deactivated') && (!reasonCode || reasonCode.trim() === '')) {
    return {
      allowed: false,
      reason: 'Administrative Invariant: A reason code is required when suspending or deactivating a user',
    };
  }

  return { allowed: true };
}

/**
 * Validates whether an actor can grant or revoke platform admin roles.
 * Only super_admin holds RBAC delegation authority.
 */
export function canManagePlatformRole(actorRole?: PlatformRole): boolean {
  return actorRole === 'super_admin';
}

/**
 * Invariant governing role revocation:
 * Prohibits revoking super_admin if there is only 1 active super_admin left in the platform.
 */
export function validateRoleRevocation(
  targetRole: PlatformRole,
  activeSuperAdminCount: number
): { allowed: boolean; reason?: string } {
  if (targetRole === 'super_admin' && activeSuperAdminCount <= 1) {
    return {
      allowed: false,
      reason: 'Administrative Invariant: Cannot revoke the last active super_admin on the platform',
    };
  }

  return { allowed: true };
}

/**
 * Sanitizes audit metadata before persisting or displaying.
 * Strips secrets, tokens, passwords, session credentials, and unmasked identifiers.
 */
export function sanitizeAuditMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'password',
    'password_hash',
    'token',
    'access_token',
    'refresh_token',
    'secret',
    'service_role',
    'authorization',
    'bearer',
    'cookie',
    'pan',
    'aadhaar',
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some((s) => lowerKey.includes(s));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeAuditMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Enforces the WealthNest confidentiality boundary:
 * Confirms whether an entity/table is private financial data that platform admins are barred from accessing.
 */
export function isFinancialDataIsolatedFromAdmin(tableName: string): boolean {
  return (PRIVATE_FINANCIAL_TABLES as readonly string[]).includes(tableName.toLowerCase());
}
