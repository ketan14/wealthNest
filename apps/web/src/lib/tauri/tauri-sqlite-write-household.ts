import { RelationalDatabaseState } from './tauri-sqlite-types';

/**
 * Executes write SQL statements for household governance, ownership splits,
 * liability parties, and document vault tables.
 */
export function executeHouseholdWrite(
  state: RelationalDatabaseState,
  sql: string,
  params: unknown[],
  now: string
): number | null {
  // households
  if (/INSERT OR IGNORE INTO households/i.test(sql)) {
    const [id, name, created_by] = params;
    if (!state.households.some((h) => h.id === id)) {
      state.households.push({ id, name, created_by, created_at: now, updated_at: now });
      return 1;
    }
    return 0;
  }
  if (/INSERT INTO households/i.test(sql)) {
    const [id, name, created_by, created_at, updated_at] = params;
    state.households.push({
      id,
      name,
      created_by,
      created_at: created_at ?? now,
      updated_at: updated_at ?? now,
    });
    return 1;
  }
  if (/UPDATE households SET name = \?/i.test(sql)) {
    const [name, id] = params;
    const h = state.households.find((r) => r.id === id);
    if (h) {
      h.name = name;
      h.updated_at = now;
      return 1;
    }
    return 0;
  }

  // household_members
  if (/INSERT INTO household_members/i.test(sql)) {
    const [id, household_id, user_id, household_role, status, joined_at] = params;
    state.household_members.push({
      id,
      household_id,
      user_id,
      household_role,
      status: status || 'active',
      joined_at: joined_at ?? now,
    });
    return 1;
  }
  if (/UPDATE household_members SET household_role = 'admin' WHERE household_id = \? AND user_id = \?/i.test(sql)) {
    const [household_id, user_id] = params;
    const hm = state.household_members.find(
      (r) => r.household_id === household_id && r.user_id === user_id
    );
    if (hm) {
      hm.household_role = 'admin';
      return 1;
    }
    return 0;
  }
  if (/UPDATE household_members SET household_role = 'primary_owner' WHERE household_id = \? AND user_id = \?/i.test(sql)) {
    const [household_id, user_id] = params;
    const hm = state.household_members.find(
      (r) => r.household_id === household_id && r.user_id === user_id
    );
    if (hm) {
      hm.household_role = 'primary_owner';
      return 1;
    }
    return 0;
  }
  if (/UPDATE household_members SET household_role = \?, status = 'active' WHERE id = \?/i.test(sql)) {
    const [role, id] = params;
    const hm = state.household_members.find((r) => r.id === id);
    if (hm) {
      hm.household_role = role;
      hm.status = 'active';
      return 1;
    }
    return 0;
  }
  if (/UPDATE household_members SET household_role = \? WHERE household_id = \? AND user_id = \?/i.test(sql)) {
    const [role, household_id, user_id] = params;
    const hm = state.household_members.find(
      (r) => r.household_id === household_id && r.user_id === user_id
    );
    if (hm) {
      hm.household_role = role;
      return 1;
    }
    return 0;
  }
  if (/UPDATE household_members SET status = \? WHERE household_id = \? AND user_id = \?/i.test(sql)) {
    const [status, household_id, user_id] = params;
    const hm = state.household_members.find(
      (r) => r.household_id === household_id && r.user_id === user_id
    );
    if (hm) {
      hm.status = status;
      return 1;
    }
    return 0;
  }

  // household_invitations
  if (/INSERT INTO household_invitations/i.test(sql)) {
    const [
      id,
      household_id,
      family_member_id,
      invited_email,
      household_role,
      token_hash,
      invited_by,
      expires_at,
    ] = params;
    state.household_invitations.push({
      id,
      household_id,
      family_member_id: family_member_id ?? null,
      invited_email,
      household_role,
      token_hash,
      invited_by,
      expires_at,
      accepted_at: null,
      accepted_by_user_id: null,
      revoked_at: null,
      created_at: now,
    });
    return 1;
  }
  if (/UPDATE household_invitations SET revoked_at/i.test(sql)) {
    const [id] = params;
    const inv = state.household_invitations.find((r) => r.id === id);
    if (inv) {
      inv.revoked_at = now;
      return 1;
    }
    return 0;
  }
  if (/UPDATE household_invitations SET accepted_at/i.test(sql)) {
    const [accepted_at, accepted_by_user_id, id] = params;
    const inv = state.household_invitations.find((r) => r.id === id);
    if (inv) {
      inv.accepted_at = accepted_at ?? now;
      inv.accepted_by_user_id = accepted_by_user_id;
      return 1;
    }
    return 0;
  }

  // family_member_access
  if (/INSERT INTO family_member_access/i.test(sql)) {
    const [id, household_id, family_member_id, user_id, can_view, can_manage, granted_by_user_id] =
      params;
    const existing = state.family_member_access.find(
      (r) =>
        r.household_id === household_id &&
        r.family_member_id === family_member_id &&
        r.user_id === user_id
    );
    if (existing) {
      existing.can_view = can_view;
      existing.can_manage = can_manage;
      existing.updated_at = now;
    } else {
      state.family_member_access.push({
        id,
        household_id,
        family_member_id,
        user_id,
        can_view,
        can_manage,
        granted_by_user_id,
        created_at: now,
        updated_at: now,
      });
    }
    return 1;
  }
  if (/DELETE FROM family_member_access WHERE id = \?/i.test(sql)) {
    const [id] = params;
    const before = state.family_member_access.length;
    state.family_member_access = state.family_member_access.filter((r) => r.id !== id);
    return before - state.family_member_access.length;
  }

  // restricted_record_grants
  if (/INSERT INTO restricted_record_grants/i.test(sql)) {
    const [id, household_id, record_type, record_id, grantee_user_id, can_edit, granted_by_user_id] =
      params;
    const existing = state.restricted_record_grants.find(
      (r) =>
        r.household_id === household_id &&
        r.record_type === record_type &&
        r.record_id === record_id &&
        r.grantee_user_id === grantee_user_id
    );
    if (existing) {
      existing.can_edit = can_edit;
    } else {
      state.restricted_record_grants.push({
        id,
        household_id,
        record_type,
        record_id,
        grantee_user_id,
        can_edit,
        granted_by_user_id,
        created_at: now,
      });
    }
    return 1;
  }
  if (/DELETE FROM restricted_record_grants WHERE id = \?/i.test(sql)) {
    const [id] = params;
    const before = state.restricted_record_grants.length;
    state.restricted_record_grants = state.restricted_record_grants.filter((r) => r.id !== id);
    return before - state.restricted_record_grants.length;
  }

  // household_audit_logs
  if (/INSERT INTO household_audit_logs/i.test(sql)) {
    const [
      id,
      household_id,
      actor_user_id,
      target_user_id,
      target_family_member_id,
      action,
      metadata_json,
    ] = params;
    state.household_audit_logs.push({
      id,
      household_id,
      actor_user_id: actor_user_id ?? null,
      target_user_id: target_user_id ?? null,
      target_family_member_id: target_family_member_id ?? null,
      action,
      metadata_json: metadata_json ?? '{}',
      created_at: now,
    });
    return 1;
  }

  // holding_owners
  if (/DELETE FROM holding_owners WHERE holding_id = \?/i.test(sql)) {
    const [holding_id] = params;
    const before = state.holding_owners.length;
    state.holding_owners = state.holding_owners.filter((r) => r.holding_id !== holding_id);
    return before - state.holding_owners.length;
  }
  if (/INSERT INTO holding_owners/i.test(sql)) {
    const [id, household_id, holding_id, family_member_id, ownership_share, is_primary_owner] =
      params;
    state.holding_owners.push({
      id,
      household_id: household_id ?? null,
      holding_id,
      family_member_id,
      ownership_share: ownership_share ?? 100,
      is_primary_owner: is_primary_owner ?? 1,
      created_at: now,
    });
    return 1;
  }

  // liability_parties
  if (/DELETE FROM liability_parties WHERE liability_id = \?/i.test(sql)) {
    const [liability_id] = params;
    const before = state.liability_parties.length;
    state.liability_parties = state.liability_parties.filter(
      (r) => r.liability_id !== liability_id
    );
    return before - state.liability_parties.length;
  }
  if (/INSERT INTO liability_parties/i.test(sql)) {
    const [id, household_id, liability_id, family_member_id, party_role, liability_share] = params;
    state.liability_parties.push({
      id,
      household_id: household_id ?? null,
      liability_id,
      family_member_id,
      party_role: party_role || 'primary_borrower',
      liability_share: liability_share ?? 100,
      created_at: now,
    });
    return 1;
  }

  // family_documents
  if (/INSERT INTO family_documents/i.test(sql)) {
    const [
      id,
      user_id,
      member_id,
      title,
      category,
      file_name,
      file_size_bytes,
      mime_type,
      storage_path,
      document_date,
      expiry_date,
      notes,
      is_encrypted,
      local_data_url,
      created_at,
      updated_at,
      household_id,
      visibility,
      created_by,
    ] = params;
    state.family_documents.push({
      id,
      user_id,
      member_id: member_id ?? null,
      title,
      category,
      file_name,
      file_size_bytes,
      mime_type,
      storage_path,
      document_date: document_date ?? null,
      expiry_date: expiry_date ?? null,
      notes: notes ?? null,
      is_encrypted: is_encrypted ?? 0,
      local_data_url: local_data_url ?? null,
      created_at: created_at ?? now,
      updated_at: updated_at ?? now,
      household_id: household_id ?? null,
      visibility: visibility ?? 'household_shared',
      created_by: created_by ?? user_id,
    });
    return 1;
  }
  if (/DELETE FROM family_documents WHERE id = \?/i.test(sql)) {
    const [id, user_id, household_id] = params;
    const before = state.family_documents.length;
    state.family_documents = state.family_documents.filter(
      (d) =>
        !(
          d.id === id &&
          (!user_id || d.user_id === user_id || d.household_id === (household_id ?? user_id))
        )
    );
    return before - state.family_documents.length;
  }

  // Backfill household_id for default household adoption
  const backfillMatch = sql.match(
    /^UPDATE\s+([a-z_]+)\s+SET\s+household_id\s*=\s*\?\s+WHERE\s+user_id\s*=\s*\?\s+AND\s+household_id\s+IS\s+NULL/i
  );
  if (backfillMatch) {
    const tableName = backfillMatch[1] as keyof RelationalDatabaseState;
    const rows = state[tableName];
    if (Array.isArray(rows)) {
      const [household_id, user_id] = params;
      let count = 0;
      for (const r of rows) {
        if (r.user_id === user_id && (r.household_id === null || r.household_id === undefined)) {
          r.household_id = household_id;
          count++;
        }
      }
      return count;
    }
  }

  return null;
}
