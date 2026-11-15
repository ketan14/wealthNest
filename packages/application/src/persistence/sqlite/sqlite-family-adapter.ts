import { Result, ok, err } from '@wealthnest/shared';
import { FamilyEntityType, RecordVisibility } from '@wealthnest/domain';
import { SqliteDatabase } from './sqlite-connection.js';
import { isHouseholdScope } from './sqlite-utils.js';
import {
  FamilyRepositoryPort,
  FamilyMemberDto,
  PortfolioAccountDto,
} from '../../ports/family-repository.port.js';

interface FamilyMemberRow {
  id: string;
  user_id: string;
  household_id?: string | null;
  linked_user_id?: string | null;
  email?: string | null;
  entity_type?: string | null;
  name: string;
  relationship: string;
  pan_masked?: string | null;
  color_hex: string;
  is_primary: number;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

interface PortfolioAccountRow {
  id: string;
  user_id: string;
  household_id?: string | null;
  member_id: string;
  account_name: string;
  broker_name: string;
  depository: string;
  account_number_masked?: string | null;
  account_type: string;
  visibility?: string | null;
  created_by?: string | null;
  created_at: string;
}

function mapMemberRow(r: FamilyMemberRow): FamilyMemberDto {
  return {
    id: r.id,
    userId: r.user_id,
    householdId: r.household_id || undefined,
    linkedUserId: r.linked_user_id || undefined,
    email: r.email || undefined,
    entityType: (r.entity_type as FamilyEntityType) || 'individual',
    name: r.name,
    relationship: r.relationship as FamilyMemberDto['relationship'],
    panMasked: r.pan_masked || undefined,
    colorHex: r.color_hex,
    isPrimary: Boolean(r.is_primary),
    notes: r.notes || undefined,
    createdAt: r.created_at,
  };
}

function mapAccountRow(r: PortfolioAccountRow): PortfolioAccountDto {
  return {
    id: r.id,
    userId: r.user_id,
    householdId: r.household_id || undefined,
    memberId: r.member_id,
    accountName: r.account_name,
    brokerName: r.broker_name,
    depository: r.depository as PortfolioAccountDto['depository'],
    accountNumberMasked: r.account_number_masked || undefined,
    accountType: r.account_type as PortfolioAccountDto['accountType'],
    visibility: (r.visibility as RecordVisibility) || 'household_shared',
    createdBy: r.created_by || undefined,
    createdAt: r.created_at,
  };
}

export class SqliteFamilyAdapter implements FamilyRepositoryPort {
  constructor(private readonly db: SqliteDatabase) {}

  async getMembers(userId: string): Promise<Result<readonly FamilyMemberDto[]>> {
    try {
      const rows = this.db
        .prepare<FamilyMemberRow>(
          'SELECT * FROM family_members WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC;'
        )
        .all(userId);

      return ok(rows.map(mapMemberRow));
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async getMembersByHousehold(householdId: string): Promise<Result<readonly FamilyMemberDto[]>> {
    if (!isHouseholdScope(this.db, householdId)) {
      return this.getMembers(householdId);
    }
    try {
      const rows = this.db
        .prepare<FamilyMemberRow>(
          'SELECT * FROM family_members WHERE household_id = ? ORDER BY is_primary DESC, created_at ASC;'
        )
        .all(householdId);

      return ok(rows.map(mapMemberRow));
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async getMemberById(id: string): Promise<Result<FamilyMemberDto | null>> {
    try {
      const r = this.db
        .prepare<FamilyMemberRow>('SELECT * FROM family_members WHERE id = ?;')
        .get(id);

      if (!r) return ok(null);

      return ok(mapMemberRow(r));
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async saveMember(member: FamilyMemberDto): Promise<Result<void>> {
    try {
      if (member.householdId) {
        this.db
          .prepare('INSERT OR IGNORE INTO profiles (id, display_name) VALUES (?, ?);')
          .run(member.userId, 'Local Investor');
        this.db
          .prepare('INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, ?, ?);')
          .run(member.householdId, 'My Household', member.userId);
      }

      this.db
        .prepare(
          `INSERT INTO family_members (id, user_id, name, relationship, pan_masked, color_hex, is_primary, notes, household_id, email, linked_user_id, entity_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             relationship = excluded.relationship,
             pan_masked = excluded.pan_masked,
             color_hex = excluded.color_hex,
             is_primary = excluded.is_primary,
             notes = excluded.notes,
             household_id = COALESCE(excluded.household_id, family_members.household_id),
             email = excluded.email,
             linked_user_id = COALESCE(excluded.linked_user_id, family_members.linked_user_id),
             entity_type = excluded.entity_type;`
        )
        .run(
          member.id,
          member.userId,
          member.name,
          member.relationship,
          member.panMasked ?? null,
          member.colorHex,
          member.isPrimary ? 1 : 0,
          member.notes ?? null,
          member.householdId ?? null,
          member.email ?? null,
          member.linkedUserId ?? null,
          member.entityType ?? 'individual'
        );

      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async deleteMember(id: string): Promise<Result<void>> {
    try {
      this.db.prepare('DELETE FROM family_members WHERE id = ?;').run(id);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async getAccounts(userId: string): Promise<Result<readonly PortfolioAccountDto[]>> {
    try {
      const rows = this.db
        .prepare<PortfolioAccountRow>(
          'SELECT * FROM portfolio_accounts WHERE user_id = ? ORDER BY created_at ASC;'
        )
        .all(userId);

      return ok(rows.map(mapAccountRow));
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async getAccountsByHousehold(
    householdId: string
  ): Promise<Result<readonly PortfolioAccountDto[]>> {
    if (!isHouseholdScope(this.db, householdId)) {
      return this.getAccounts(householdId);
    }
    try {
      const rows = this.db
        .prepare<PortfolioAccountRow>(
          'SELECT * FROM portfolio_accounts WHERE household_id = ? ORDER BY created_at ASC;'
        )
        .all(householdId);

      return ok(rows.map(mapAccountRow));
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async getAccountById(id: string): Promise<Result<PortfolioAccountDto | null>> {
    try {
      const r = this.db
        .prepare<PortfolioAccountRow>('SELECT * FROM portfolio_accounts WHERE id = ?;')
        .get(id);

      if (!r) return ok(null);

      return ok(mapAccountRow(r));
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async saveAccount(account: PortfolioAccountDto): Promise<Result<void>> {
    try {
      this.db
        .prepare(
          `INSERT INTO portfolio_accounts (id, user_id, member_id, account_name, broker_name, depository, account_number_masked, account_type, household_id, visibility)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             member_id = excluded.member_id,
             account_name = excluded.account_name,
             broker_name = excluded.broker_name,
             depository = excluded.depository,
             account_number_masked = excluded.account_number_masked,
             account_type = excluded.account_type,
             household_id = COALESCE(excluded.household_id, portfolio_accounts.household_id),
             visibility = excluded.visibility;`
        )
        .run(
          account.id,
          account.userId,
          account.memberId,
          account.accountName,
          account.brokerName,
          account.depository,
          account.accountNumberMasked ?? null,
          account.accountType,
          account.householdId ?? null,
          account.visibility ?? 'household_shared'
        );

      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async deleteAccount(id: string): Promise<Result<void>> {
    try {
      this.db.prepare('DELETE FROM portfolio_accounts WHERE id = ?;').run(id);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}
