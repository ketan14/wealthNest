import { Result, ok, err } from '@wealthnest/shared';
import {
  HouseholdSummary,
  HouseholdAccessMember,
  HouseholdInvitation,
  HouseholdInvitationPreview,
  HouseholdAuditLogEntry,
  HouseholdRole,
  HouseholdMembershipStatus,
  HouseholdInvitationStatus,
  FamilyMemberAccessGrant,
  RestrictedRecordGrant,
  RestrictedRecordTargetType,
} from '@wealthnest/domain';
import { SqliteDatabase } from './sqlite-connection.js';
import {
  HouseholdRepositoryPort,
  CreateHouseholdInvitationParams,
  CreatedHouseholdInvitationResult,
  AcceptHouseholdInvitationResult,
  SetFamilyMemberAccessParams,
  SetRestrictedRecordGrantParams,
} from '../../ports/household-repository.port.js';
import { generateId } from './sqlite-utils.js';

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const local = parts[0]!;
  const domain = parts[1]!;
  if (local.length <= 2) return `${local[0] ?? '*'}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export class SqliteHouseholdAdapter implements HouseholdRepositoryPort {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly currentUserId: string = 'usr-local-vault',
    private readonly currentUserEmail?: string
  ) {}

  private ensureProfileExists(displayName?: string): void {
    this.db
      .prepare('INSERT OR IGNORE INTO profiles (id, display_name) VALUES (?, ?);')
      .run(this.currentUserId, displayName?.trim() || 'Local Investor');
  }

  private getCallerRole(
    householdId: string,
    userId: string = this.currentUserId
  ): { role: HouseholdRole; status: HouseholdMembershipStatus } | null {
    const row = this.db
      .prepare<{ household_role: HouseholdRole; status: HouseholdMembershipStatus }>(
        `SELECT household_role, status FROM household_members WHERE household_id = ? AND user_id = ?;`
      )
      .get(householdId, userId);
    return row ? { role: row.household_role, status: row.status } : null;
  }

  private appendAuditLog(
    householdId: string,
    action: string,
    options?: {
      readonly targetUserId?: string;
      readonly targetFamilyMemberId?: string;
      readonly metadata?: Record<string, unknown>;
    }
  ): void {
    const logId = generateId('hlog');
    this.db
      .prepare(
        `INSERT INTO household_audit_logs (
           id, household_id, actor_user_id, target_user_id, target_family_member_id, action, metadata_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?);`
      )
      .run(
        logId,
        householdId,
        this.currentUserId,
        options?.targetUserId ?? null,
        options?.targetFamilyMemberId ?? null,
        action,
        JSON.stringify(options?.metadata ?? {})
      );
  }

  async ensureDefaultHousehold(displayName?: string): Promise<Result<string>> {
    try {
      this.ensureProfileExists(displayName);
      const existing = this.db
        .prepare<{ household_id: string }>(
          `SELECT household_id FROM household_members
           WHERE user_id = ? AND status = 'active'
           ORDER BY joined_at ASC LIMIT 1;`
        )
        .get(this.currentUserId);

      if (existing) {
        return ok(existing.household_id);
      }

      const householdName = displayName?.trim()
        ? `${displayName.trim()}'s Household`
        : 'Vaghela Household';
      const created = await this.createHousehold(householdName, displayName);
      if (!created.success) return created;

      const hid = created.value.id;
      const tables = [
        'family_members',
        'portfolio_accounts',
        'assets',
        'holdings',
        'transactions',
        'liabilities',
        'financial_goals',
        'family_documents',
      ] as const;
      for (const table of tables) {
        this.db
          .prepare(
            `UPDATE ${table} SET household_id = ? WHERE user_id = ? AND household_id IS NULL;`
          )
          .run(hid, this.currentUserId);
      }

      return ok(hid);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async listMyHouseholds(): Promise<Result<readonly HouseholdSummary[]>> {
    try {
      const rows = this.db
        .prepare<{
          id: string;
          name: string;
          created_by?: string;
          role: HouseholdRole;
          status: HouseholdMembershipStatus;
          created_at: string;
          updated_at: string;
        }>(
          `SELECT h.id, h.name, h.created_by, hm.household_role as role, hm.status, h.created_at, h.updated_at
           FROM households h
           JOIN household_members hm ON hm.household_id = h.id
           WHERE hm.user_id = ? AND hm.status = 'active'
           ORDER BY hm.joined_at ASC;`
        )
        .all(this.currentUserId);

      const mapped: HouseholdSummary[] = rows.map((r, index) => {
        const countRow = this.db
          .prepare<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM household_members WHERE household_id = ? AND status = 'active';`
          )
          .get(r.id);

        return {
          id: r.id,
          name: r.name,
          createdBy: r.created_by || undefined,
          role: r.role,
          status: r.status,
          isDefault: index === 0,
          memberCount: countRow?.cnt ?? 1,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      });

      return ok(mapped);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async createHousehold(name: string, displayName?: string): Promise<Result<HouseholdSummary>> {
    try {
      this.ensureProfileExists(displayName);
      const householdId = generateId('hh');
      const memberId = generateId('hhm');
      const now = new Date().toISOString();

      this.db
        .prepare(
          `INSERT INTO households (id, name, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?);`
        )
        .run(householdId, name.trim(), this.currentUserId, now, now);

      this.db
        .prepare(
          `INSERT INTO household_members (id, household_id, user_id, household_role, status, joined_at)
           VALUES (?, ?, ?, 'primary_owner', 'active', ?);`
        )
        .run(memberId, householdId, this.currentUserId, now);

      this.appendAuditLog(householdId, 'household_created', { metadata: { name: name.trim() } });

      return ok({
        id: householdId,
        name: name.trim(),
        createdBy: this.currentUserId,
        role: 'primary_owner',
        status: 'active',
        isDefault: true,
        memberCount: 1,
        createdAt: now,
        updatedAt: now,
      });
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async renameHousehold(householdId: string, name: string): Promise<Result<void>> {
    try {
      const caller = this.getCallerRole(householdId);
      if (
        !caller ||
        caller.status !== 'active' ||
        (caller.role !== 'primary_owner' && caller.role !== 'admin')
      ) {
        return err(new Error('Only a household owner or administrator can rename the household.'));
      }

      this.db
        .prepare(`UPDATE households SET name = ?, updated_at = datetime('now') WHERE id = ?;`)
        .run(name.trim(), householdId);

      this.appendAuditLog(householdId, 'household_renamed', { metadata: { name: name.trim() } });
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async listAccessMembers(householdId: string): Promise<Result<readonly HouseholdAccessMember[]>> {
    try {
      const caller = this.getCallerRole(householdId);
      if (!caller || caller.status !== 'active') {
        return err(new Error('You are not an active member of this household.'));
      }

      const rows = this.db
        .prepare<{
          id: string;
          household_id: string;
          user_id: string;
          household_role: HouseholdRole;
          status: HouseholdMembershipStatus;
          joined_at: string;
          display_name?: string;
        }>(
          `SELECT hm.id, hm.household_id, hm.user_id, hm.household_role, hm.status, hm.joined_at, p.display_name
           FROM household_members hm
           LEFT JOIN profiles p ON p.id = hm.user_id
           WHERE hm.household_id = ?
           ORDER BY hm.joined_at ASC;`
        )
        .all(householdId);

      const mapped: HouseholdAccessMember[] = rows.map((r) => {
        const linked = this.db
          .prepare<{ id: string; name: string; email?: string }>(
            `SELECT id, name, email FROM family_members
             WHERE household_id = ? AND linked_user_id = ? LIMIT 1;`
          )
          .get(householdId, r.user_id);

        return {
          id: r.id,
          householdId: r.household_id,
          userId: r.user_id,
          email: linked?.email || undefined,
          displayName: r.display_name || undefined,
          householdRole: r.household_role,
          status: r.status,
          joinedAt: r.joined_at,
          linkedFamilyMemberId: linked?.id,
          linkedFamilyMemberName: linked?.name,
        };
      });

      return ok(mapped);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async appointAdmin(
    householdId: string,
    targetUserId: string,
    grant: boolean
  ): Promise<Result<void>> {
    try {
      const caller = this.getCallerRole(householdId);
      if (!caller || caller.status !== 'active' || caller.role !== 'primary_owner') {
        return err(new Error('Only the household primary owner can appoint or remove admins.'));
      }
      if (targetUserId === this.currentUserId) {
        return err(new Error('Primary owner cannot demote themselves via admin appointment.'));
      }
      const target = this.getCallerRole(householdId, targetUserId);
      if (!target || target.status !== 'active') {
        return err(new Error('Target user must be an active member of this household.'));
      }

      const nextRole: HouseholdRole = grant ? 'admin' : 'member';
      this.db
        .prepare(
          `UPDATE household_members SET household_role = ? WHERE household_id = ? AND user_id = ?;`
        )
        .run(nextRole, householdId, targetUserId);

      this.appendAuditLog(householdId, grant ? 'admin_appointed' : 'admin_removed', {
        targetUserId,
        metadata: { role: nextRole },
      });
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async setMemberRole(
    householdId: string,
    targetUserId: string,
    role: Exclude<HouseholdRole, 'primary_owner'>
  ): Promise<Result<void>> {
    try {
      const caller = this.getCallerRole(householdId);
      if (
        !caller ||
        caller.status !== 'active' ||
        (caller.role !== 'primary_owner' && caller.role !== 'admin')
      ) {
        return err(new Error('Insufficient household permissions to change member role.'));
      }
      const target = this.getCallerRole(householdId, targetUserId);
      if (!target) {
        return err(new Error('Target household member not found.'));
      }
      if (target.role === 'primary_owner') {
        return err(new Error('Cannot change role of the primary owner directly.'));
      }
      if (caller.role === 'admin' && (role === 'admin' || target.role === 'admin')) {
        return err(new Error('Only the primary owner can promote or demote administrators.'));
      }

      this.db
        .prepare(
          `UPDATE household_members SET household_role = ? WHERE household_id = ? AND user_id = ?;`
        )
        .run(role, householdId, targetUserId);

      this.appendAuditLog(householdId, 'member_role_updated', {
        targetUserId,
        metadata: { role },
      });
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async transferPrimaryOwner(householdId: string, newOwnerUserId: string): Promise<Result<void>> {
    try {
      const caller = this.getCallerRole(householdId);
      if (!caller || caller.status !== 'active' || caller.role !== 'primary_owner') {
        return err(new Error('Only the current primary owner can transfer household ownership.'));
      }
      const target = this.getCallerRole(householdId, newOwnerUserId);
      if (!target || target.status !== 'active') {
        return err(new Error('New owner must be an active member of this household.'));
      }

      this.db.exec('BEGIN IMMEDIATE TRANSACTION;');
      try {
        this.db
          .prepare(
            `UPDATE household_members SET household_role = 'admin' WHERE household_id = ? AND user_id = ?;`
          )
          .run(householdId, this.currentUserId);
        this.db
          .prepare(
            `UPDATE household_members SET household_role = 'primary_owner' WHERE household_id = ? AND user_id = ?;`
          )
          .run(householdId, newOwnerUserId);
        this.db.exec('COMMIT;');
      } catch (innerErr) {
        this.db.exec('ROLLBACK;');
        throw innerErr;
      }

      this.appendAuditLog(householdId, 'primary_owner_transferred', {
        targetUserId: newOwnerUserId,
      });
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async revokeOrRestoreMember(
    householdId: string,
    targetUserId: string,
    status: HouseholdMembershipStatus
  ): Promise<Result<void>> {
    try {
      const caller = this.getCallerRole(householdId);
      if (
        !caller ||
        caller.status !== 'active' ||
        (caller.role !== 'primary_owner' && caller.role !== 'admin')
      ) {
        return err(new Error('Insufficient permissions to revoke or restore household members.'));
      }
      const target = this.getCallerRole(householdId, targetUserId);
      if (!target) {
        return err(new Error('Target household member not found.'));
      }
      if (target.role === 'primary_owner') {
        return err(new Error('The primary owner membership cannot be revoked.'));
      }
      if (caller.role === 'admin' && target.role === 'admin') {
        return err(new Error('Only the primary owner can suspend or restore an administrator.'));
      }

      this.db
        .prepare(`UPDATE household_members SET status = ? WHERE household_id = ? AND user_id = ?;`)
        .run(status, householdId, targetUserId);

      this.appendAuditLog(
        householdId,
        status === 'revoked' ? 'member_revoked' : 'member_restored',
        { targetUserId }
      );
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async createInvitation(
    params: CreateHouseholdInvitationParams
  ): Promise<Result<CreatedHouseholdInvitationResult>> {
    try {
      const caller = this.getCallerRole(params.householdId);
      if (
        !caller ||
        caller.status !== 'active' ||
        (caller.role !== 'primary_owner' && caller.role !== 'admin')
      ) {
        return err(new Error('Only a household owner or administrator can invite members.'));
      }
      if (params.role === 'admin' && caller.role !== 'primary_owner') {
        return err(new Error('Only the household primary owner can invite administrators.'));
      }

      const invitationId = generateId('hinv');
      const token = `${generateId('tok')}${Math.random().toString(36).slice(2, 10)}`;
      const expiresAt = new Date(
        Date.now() + (params.expiresInHours ?? 168) * 3600 * 1000
      ).toISOString();

      this.db
        .prepare(
          `INSERT INTO household_invitations (
             id, household_id, family_member_id, invited_email, household_role, token_hash, invited_by, expires_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`
        )
        .run(
          invitationId,
          params.householdId,
          params.familyMemberId ?? null,
          params.invitedEmail.trim().toLowerCase(),
          params.role,
          token,
          this.currentUserId,
          expiresAt
        );

      this.appendAuditLog(params.householdId, 'invitation_created', {
        targetFamilyMemberId: params.familyMemberId,
        metadata: { invited_email: params.invitedEmail, role: params.role },
      });

      return ok({
        invitationId,
        householdId: params.householdId,
        familyMemberId: params.familyMemberId,
        invitedEmail: params.invitedEmail.trim().toLowerCase(),
        role: params.role,
        expiresAt,
        inviteToken: token,
      });
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async listInvitations(householdId: string): Promise<Result<readonly HouseholdInvitation[]>> {
    try {
      const caller = this.getCallerRole(householdId);
      if (
        !caller ||
        caller.status !== 'active' ||
        (caller.role !== 'primary_owner' && caller.role !== 'admin')
      ) {
        return ok([]);
      }

      const rows = this.db
        .prepare<{
          id: string;
          household_id: string;
          family_member_id?: string;
          family_member_name?: string;
          invited_email: string;
          household_role: Exclude<HouseholdRole, 'primary_owner'>;
          expires_at: string;
          accepted_at?: string;
          accepted_by_user_id?: string;
          revoked_at?: string;
          created_at: string;
        }>(
          `SELECT hi.*, fm.name as family_member_name
           FROM household_invitations hi
           LEFT JOIN family_members fm ON fm.id = hi.family_member_id
           WHERE hi.household_id = ?
           ORDER BY hi.created_at DESC;`
        )
        .all(householdId);

      const nowMs = Date.now();
      const mapped: HouseholdInvitation[] = rows.map((r) => {
        let status: HouseholdInvitationStatus = 'pending';
        if (r.accepted_at) status = 'accepted';
        else if (r.revoked_at) status = 'revoked';
        else if (new Date(r.expires_at).getTime() < nowMs) status = 'expired';

        return {
          id: r.id,
          householdId: r.household_id,
          familyMemberId: r.family_member_id || undefined,
          familyMemberName: r.family_member_name || undefined,
          invitedEmail: r.invited_email,
          householdRole: r.household_role,
          status,
          expiresAt: r.expires_at,
          acceptedAt: r.accepted_at || undefined,
          acceptedByUserId: r.accepted_by_user_id || undefined,
          revokedAt: r.revoked_at || undefined,
          createdAt: r.created_at,
        };
      });

      return ok(mapped);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async revokeInvitation(invitationId: string): Promise<Result<void>> {
    try {
      const inv = this.db
        .prepare<{ id: string; household_id: string }>(
          `SELECT id, household_id FROM household_invitations WHERE id = ?;`
        )
        .get(invitationId);
      if (!inv) {
        return err(new Error('Invitation not found.'));
      }
      const caller = this.getCallerRole(inv.household_id);
      if (
        !caller ||
        caller.status !== 'active' ||
        (caller.role !== 'primary_owner' && caller.role !== 'admin')
      ) {
        return err(new Error('Insufficient permissions to revoke invitation.'));
      }

      this.db
        .prepare(`UPDATE household_invitations SET revoked_at = datetime('now') WHERE id = ?;`)
        .run(invitationId);

      this.appendAuditLog(inv.household_id, 'invitation_revoked', {
        metadata: { invitation_id: invitationId },
      });
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async previewInvitation(token: string): Promise<Result<HouseholdInvitationPreview>> {
    try {
      const inv = this.db
        .prepare<{
          household_id: string;
          household_name?: string;
          family_member_id?: string;
          family_member_name?: string;
          invited_email: string;
          household_role: Exclude<HouseholdRole, 'primary_owner'>;
          expires_at: string;
          accepted_at?: string;
          revoked_at?: string;
        }>(
          `SELECT hi.*, h.name as household_name, fm.name as family_member_name
           FROM household_invitations hi
           LEFT JOIN households h ON h.id = hi.household_id
           LEFT JOIN family_members fm ON fm.id = hi.family_member_id
           WHERE hi.token_hash = ?;`
        )
        .get(token);

      if (!inv) {
        return ok({ valid: false, reason: 'not_found' });
      }
      if (inv.revoked_at) {
        return ok({ valid: false, reason: 'revoked' });
      }
      if (inv.accepted_at) {
        return ok({ valid: false, reason: 'already_accepted' });
      }
      if (new Date(inv.expires_at).getTime() < Date.now()) {
        return ok({ valid: false, reason: 'expired' });
      }

      return ok({
        valid: true,
        householdId: inv.household_id,
        householdName: inv.household_name,
        familyMemberId: inv.family_member_id || undefined,
        familyMemberName: inv.family_member_name || undefined,
        invitedEmail: maskEmail(inv.invited_email),
        householdRole: inv.household_role,
        expiresAt: inv.expires_at,
      });
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async acceptInvitation(token: string): Promise<Result<AcceptHouseholdInvitationResult>> {
    try {
      this.ensureProfileExists();
      const inv = this.db
        .prepare<{
          id: string;
          household_id: string;
          family_member_id?: string;
          invited_email: string;
          household_role: Exclude<HouseholdRole, 'primary_owner'>;
          expires_at: string;
          accepted_at?: string;
          revoked_at?: string;
        }>(`SELECT * FROM household_invitations WHERE token_hash = ?;`)
        .get(token);

      if (!inv || inv.revoked_at || inv.accepted_at || new Date(inv.expires_at).getTime() < Date.now()) {
        return err(new Error('Invitation is invalid, revoked, already accepted, or expired.'));
      }

      if (
        this.currentUserEmail &&
        inv.invited_email.toLowerCase() !== this.currentUserEmail.trim().toLowerCase()
      ) {
        return err(new Error('Signed-in account email does not match this invitation.'));
      }

      const now = new Date().toISOString();
      const existingMember = this.db
        .prepare<{ id: string }>(
          `SELECT id FROM household_members WHERE household_id = ? AND user_id = ?;`
        )
        .get(inv.household_id, this.currentUserId);

      if (existingMember) {
        this.db
          .prepare(
            `UPDATE household_members SET household_role = ?, status = 'active' WHERE id = ?;`
          )
          .run(inv.household_role, existingMember.id);
      } else {
        this.db
          .prepare(
            `INSERT INTO household_members (id, household_id, user_id, household_role, status, joined_at)
             VALUES (?, ?, ?, ?, 'active', ?);`
          )
          .run(generateId('hhm'), inv.household_id, this.currentUserId, inv.household_role, now);
      }

      if (inv.family_member_id) {
        this.db
          .prepare(`UPDATE family_members SET linked_user_id = ? WHERE id = ?;`)
          .run(this.currentUserId, inv.family_member_id);
      }

      this.db
        .prepare(
          `UPDATE household_invitations SET accepted_at = ?, accepted_by_user_id = ? WHERE id = ?;`
        )
        .run(now, this.currentUserId, inv.id);

      this.appendAuditLog(inv.household_id, 'invitation_accepted', {
        targetUserId: this.currentUserId,
        targetFamilyMemberId: inv.family_member_id || undefined,
      });

      return ok({
        householdId: inv.household_id,
        householdRole: inv.household_role,
        familyMemberId: inv.family_member_id || undefined,
      });
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async unlinkFamilyMemberAccount(householdId: string, familyMemberId: string): Promise<Result<void>> {
    try {
      const caller = this.getCallerRole(householdId);
      if (
        !caller ||
        caller.status !== 'active' ||
        (caller.role !== 'primary_owner' && caller.role !== 'admin')
      ) {
        return err(new Error('Insufficient permissions to unlink family member account.'));
      }

      this.db
        .prepare(`UPDATE family_members SET linked_user_id = NULL WHERE id = ? AND household_id = ?;`)
        .run(familyMemberId, householdId);

      this.appendAuditLog(householdId, 'family_member_unlinked', {
        targetFamilyMemberId: familyMemberId,
      });
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async listFamilyMemberAccess(
    householdId: string,
    familyMemberId?: string
  ): Promise<Result<readonly FamilyMemberAccessGrant[]>> {
    try {
      const sql = familyMemberId
        ? `SELECT * FROM family_member_access WHERE household_id = ? AND family_member_id = ?;`
        : `SELECT * FROM family_member_access WHERE household_id = ?;`;
      const rows = (
        familyMemberId
          ? this.db.prepare<Record<string, unknown>>(sql).all(householdId, familyMemberId)
          : this.db.prepare<Record<string, unknown>>(sql).all(householdId)
      ) as Array<{
        id: string;
        household_id: string;
        family_member_id: string;
        user_id: string;
        can_view: number;
        can_manage: number;
        granted_by_user_id?: string;
        created_at: string;
        updated_at: string;
      }>;

      return ok(
        rows.map((r) => ({
          id: r.id,
          householdId: r.household_id,
          familyMemberId: r.family_member_id,
          userId: r.user_id,
          canView: Boolean(r.can_view),
          canManage: Boolean(r.can_manage),
          grantedByUserId: r.granted_by_user_id || undefined,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }))
      );
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async upsertFamilyMemberAccess(params: SetFamilyMemberAccessParams): Promise<Result<void>> {
    try {
      const id = generateId('fma');
      this.db
        .prepare(
          `INSERT INTO family_member_access (
             id, household_id, family_member_id, user_id, can_view, can_manage, granted_by_user_id
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(household_id, family_member_id, user_id) DO UPDATE SET
             can_view = excluded.can_view,
             can_manage = excluded.can_manage,
             updated_at = datetime('now');`
        )
        .run(
          id,
          params.householdId,
          params.familyMemberId,
          params.userId,
          params.canView ? 1 : 0,
          params.canManage ? 1 : 0,
          this.currentUserId
        );
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async removeFamilyMemberAccess(id: string): Promise<Result<void>> {
    try {
      this.db.prepare(`DELETE FROM family_member_access WHERE id = ?;`).run(id);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async listRestrictedRecordGrants(
    householdId: string,
    recordType?: RestrictedRecordTargetType,
    recordId?: string
  ): Promise<Result<readonly RestrictedRecordGrant[]>> {
    try {
      let sql = `SELECT * FROM restricted_record_grants WHERE household_id = ?`;
      const args: unknown[] = [householdId];
      if (recordType) {
        sql += ` AND record_type = ?`;
        args.push(recordType);
      }
      if (recordId) {
        sql += ` AND record_id = ?`;
        args.push(recordId);
      }
      sql += ';';

      const rows = this.db
        .prepare<{
          id: string;
          household_id: string;
          record_type: RestrictedRecordTargetType;
          record_id: string;
          grantee_user_id: string;
          can_edit: number;
          granted_by_user_id?: string;
          created_at: string;
        }>(sql)
        .all(...args);

      return ok(
        rows.map((r) => ({
          id: r.id,
          householdId: r.household_id,
          recordType: r.record_type,
          recordId: r.record_id,
          granteeUserId: r.grantee_user_id,
          canEdit: Boolean(r.can_edit),
          grantedByUserId: r.granted_by_user_id || undefined,
          createdAt: r.created_at,
        }))
      );
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async upsertRestrictedRecordGrant(params: SetRestrictedRecordGrantParams): Promise<Result<void>> {
    try {
      const id = generateId('rrg');
      this.db
        .prepare(
          `INSERT INTO restricted_record_grants (
             id, household_id, record_type, record_id, grantee_user_id, can_edit, granted_by_user_id
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(household_id, record_type, record_id, grantee_user_id) DO UPDATE SET
             can_edit = excluded.can_edit;`
        )
        .run(
          id,
          params.householdId,
          params.recordType,
          params.recordId,
          params.granteeUserId,
          params.canEdit ? 1 : 0,
          this.currentUserId
        );
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async removeRestrictedRecordGrant(id: string): Promise<Result<void>> {
    try {
      this.db.prepare(`DELETE FROM restricted_record_grants WHERE id = ?;`).run(id);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async listAuditLogs(
    householdId: string,
    limit: number = 50
  ): Promise<Result<readonly HouseholdAuditLogEntry[]>> {
    try {
      const rows = this.db
        .prepare<{
          id: string;
          household_id: string;
          actor_user_id?: string;
          target_user_id?: string;
          target_family_member_id?: string;
          action: string;
          metadata_json: string;
          created_at: string;
        }>(
          `SELECT * FROM household_audit_logs
           WHERE household_id = ?
           ORDER BY created_at DESC LIMIT ?;`
        )
        .all(householdId, limit);

      return ok(
        rows.map((r) => {
          let metadata: Record<string, unknown> = {};
          try {
            metadata = JSON.parse(r.metadata_json || '{}') as Record<string, unknown>;
          } catch {
            metadata = {};
          }
          return {
            id: r.id,
            householdId: r.household_id,
            actorUserId: r.actor_user_id || undefined,
            targetUserId: r.target_user_id || undefined,
            targetFamilyMemberId: r.target_family_member_id || undefined,
            action: r.action,
            metadata,
            createdAt: r.created_at,
          };
        })
      );
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}
