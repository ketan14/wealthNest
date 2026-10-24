import { PlatformRole } from './admin-types.js';

export const SUPPORT_SESSION_DEFAULT_TTL_MINUTES = 15;
export const SUPPORT_SESSION_WARNING_THRESHOLD_SECONDS = 120; // 2 minutes

/**
 * Validates whether an actor with a given platform role is permitted to initiate a support session.
 * - super_admin: Allowed
 * - support_admin: Allowed
 * - auditor: Disallowed (auditors have strictly read-only audit log inspection privileges)
 */
export function canInitiateSupportSession(actorRole?: PlatformRole): boolean {
  if (!actorRole) return false;
  return actorRole === 'super_admin' || actorRole === 'support_admin';
}

/**
 * Invariants governing support session initiation:
 * 1. An administrator cannot initiate a support session targeting their own user account.
 * 2. Initiating a support session requires a documented justification / ticket reason of at least 8 characters.
 */
export function validateSupportSessionRequest(
  adminId: string,
  targetUserId: string,
  reason?: string
): { allowed: boolean; reason?: string } {
  if (!adminId || !targetUserId) {
    return {
      allowed: false,
      reason: 'Administrative Invariant: Admin ID and Target User ID are required',
    };
  }

  if (adminId === targetUserId) {
    return {
      allowed: false,
      reason: 'Administrative Invariant: You cannot initiate a support view session for your own administrator account',
    };
  }

  if (!reason || reason.trim().length < 8) {
    return {
      allowed: false,
      reason: 'Administrative Invariant: A documented support justification (minimum 8 characters) is required',
    };
  }

  return { allowed: true };
}

/**
 * Calculates remaining seconds until support session expiration.
 */
export function calculateRemainingSeconds(expiresAt: string | Date, now: Date = new Date()): number {
  const expiryTime = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt.getTime();
  const currentTime = now.getTime();
  const diffMs = expiryTime - currentTime;
  return Math.max(0, Math.floor(diffMs / 1000));
}

/**
 * Evaluates whether a support session is expired based on timestamp.
 */
export function isSupportSessionExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  return calculateRemainingSeconds(expiresAt, now) <= 0;
}

/**
 * Formats remaining seconds as a MM:SS string for countdown banners.
 */
export function formatRemainingSessionTime(remainingSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(remainingSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
