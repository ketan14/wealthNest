import type { SqliteDatabase } from './sqlite-connection.js';

/** Generates a prefixed unique identifier for SQLite records. */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Returns true if scopeId belongs to a household (or is neither a profile nor household),
 * and false only when scopeId matches a profile ID without a household ID (legacy userId call).
 */
export function isHouseholdScope(db: SqliteDatabase, scopeId: string): boolean {
  const hh = db.prepare<{ id: string }>('SELECT id FROM households WHERE id = ?;').get(scopeId);
  if (hh) return true;
  const prof = db.prepare<{ id: string }>('SELECT id FROM profiles WHERE id = ?;').get(scopeId);
  return !prof;
}
