const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sanitizes arbitrary string identifiers before sending them to PostgreSQL UUID columns.
 * Prevents "invalid input syntax for type uuid: mem-self" errors when UI components
 * provide demo fallbacks or un-migrated identifiers.
 */
export function toValidUuidOrNull(val: string | null | undefined): string | null {
  if (typeof val === 'string' && UUID_REGEX.test(val.trim())) {
    return val.trim();
  }
  return null;
}
