import { RecordVisibility, RestrictedRecordTargetType } from '@wealthnest/domain';
import { supabase } from './client';
import { toValidUuidOrNull } from './uuid-utils';

let cachedDefaultHouseholdUserId: string | null = null;
let cachedDefaultHouseholdId: string | null = null;

/**
 * Resolves the authoritative household UUID for Supabase writes.
 * Throws if neither a valid household UUID nor an authenticated session is available.
 */
export async function resolveHouseholdIdForWrite(
  householdId?: string,
  userId?: string
): Promise<string> {
  const validHouseholdId = toValidUuidOrNull(householdId);
  if (validHouseholdId) {
    return validHouseholdId;
  }

  const validUserId = toValidUuidOrNull(userId);
  if (validUserId && cachedDefaultHouseholdUserId === validUserId && cachedDefaultHouseholdId) {
    return cachedDefaultHouseholdId;
  }

  const { data, error } = await supabase.rpc('ensure_user_default_household');
  if (error || typeof data !== 'string' || !toValidUuidOrNull(data)) {
    throw new Error(error?.message || 'Active household could not be resolved for write operation');
  }

  if (validUserId) {
    cachedDefaultHouseholdUserId = validUserId;
    cachedDefaultHouseholdId = data;
  }
  return data;
}

export function clearCachedDefaultHousehold(): void {
  cachedDefaultHouseholdUserId = null;
  cachedDefaultHouseholdId = null;
}

export function toPgRestrictedRecordType(recordType: RestrictedRecordTargetType): string {
  return recordType === 'cas_import_batch' ? 'import_batch' : recordType;
}

export function fromPgRestrictedRecordType(recordType: string): RestrictedRecordTargetType {
  return (recordType === 'import_batch'
    ? 'cas_import_batch'
    : recordType) as RestrictedRecordTargetType;
}

export async function syncRestrictedRecordGrants(params: {
  readonly householdId: string;
  readonly recordType: RestrictedRecordTargetType;
  readonly recordId: string;
  readonly visibility?: RecordVisibility;
  readonly granteeUserIds?: readonly string[];
}): Promise<void> {
  if (params.visibility !== 'restricted') {
    return;
  }

  const validUsers = Array.from(
    new Set(
      (params.granteeUserIds || [])
        .map((id) => toValidUuidOrNull(id))
        .filter((id): id is string => id !== null)
    )
  );

  if (validUsers.length === 0) {
    return;
  }

  const pgRecordType = toPgRestrictedRecordType(params.recordType);
  const rows = validUsers.map((uid) => ({
    household_id: params.householdId,
    record_type: pgRecordType,
    record_id: params.recordId,
    user_id: uid,
    permission: 'view',
  }));

  const { error } = await supabase
    .from('restricted_record_grants')
    .upsert(rows, { onConflict: 'record_type,record_id,user_id' });

  if (error) {
    throw new Error(`Failed to persist restricted access grants: ${error.message}`);
  }
}
