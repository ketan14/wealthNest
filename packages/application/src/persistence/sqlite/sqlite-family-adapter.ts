import { Result, ok, err } from '@wealthnest/shared';
import { SqliteDatabase } from './sqlite-connection.js';
import {
  FamilyRepositoryPort,
  FamilyMemberDto,
  PortfolioAccountDto,
} from '../../ports/family-repository.port.js';

export class SqliteFamilyAdapter implements FamilyRepositoryPort {
  constructor(private readonly db: SqliteDatabase) {}

  async getMembers(userId: string): Promise<Result<readonly FamilyMemberDto[]>> {
    try {
      const rows = this.db
        .prepare<{
          id: string;
          user_id: string;
          name: string;
          relationship: string;
          pan_masked?: string;
          color_hex: string;
          is_primary: number;
          notes?: string;
          created_at: string;
        }>(
          'SELECT * FROM family_members WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC;'
        )
        .all(userId);

      const mapped: FamilyMemberDto[] = rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        relationship: r.relationship as FamilyMemberDto['relationship'],
        panMasked: r.pan_masked || undefined,
        colorHex: r.color_hex,
        isPrimary: Boolean(r.is_primary),
        notes: r.notes || undefined,
        createdAt: r.created_at,
      }));

      return ok(mapped);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async getMemberById(id: string): Promise<Result<FamilyMemberDto | null>> {
    try {
      const r = this.db
        .prepare<{
          id: string;
          user_id: string;
          name: string;
          relationship: string;
          pan_masked?: string;
          color_hex: string;
          is_primary: number;
          notes?: string;
          created_at: string;
        }>('SELECT * FROM family_members WHERE id = ?;')
        .get(id);

      if (!r) return ok(null);

      return ok({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        relationship: r.relationship as FamilyMemberDto['relationship'],
        panMasked: r.pan_masked || undefined,
        colorHex: r.color_hex,
        isPrimary: Boolean(r.is_primary),
        notes: r.notes || undefined,
        createdAt: r.created_at,
      });
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async saveMember(member: FamilyMemberDto): Promise<Result<void>> {
    try {
      this.db
        .prepare(
          `INSERT INTO family_members (id, user_id, name, relationship, pan_masked, color_hex, is_primary, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             relationship = excluded.relationship,
             pan_masked = excluded.pan_masked,
             color_hex = excluded.color_hex,
             is_primary = excluded.is_primary,
             notes = excluded.notes;`
        )
        .run(
          member.id,
          member.userId,
          member.name,
          member.relationship,
          member.panMasked ?? null,
          member.colorHex,
          member.isPrimary ? 1 : 0,
          member.notes ?? null
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
        .prepare<{
          id: string;
          user_id: string;
          member_id: string;
          account_name: string;
          broker_name: string;
          depository: string;
          account_number_masked?: string;
          account_type: string;
          created_at: string;
        }>('SELECT * FROM portfolio_accounts WHERE user_id = ? ORDER BY created_at ASC;')
        .all(userId);

      const mapped: PortfolioAccountDto[] = rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        memberId: r.member_id,
        accountName: r.account_name,
        brokerName: r.broker_name,
        depository: r.depository as PortfolioAccountDto['depository'],
        accountNumberMasked: r.account_number_masked || undefined,
        accountType: r.account_type as PortfolioAccountDto['accountType'],
        createdAt: r.created_at,
      }));

      return ok(mapped);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async getAccountById(id: string): Promise<Result<PortfolioAccountDto | null>> {
    try {
      const r = this.db
        .prepare<{
          id: string;
          user_id: string;
          member_id: string;
          account_name: string;
          broker_name: string;
          depository: string;
          account_number_masked?: string;
          account_type: string;
          created_at: string;
        }>('SELECT * FROM portfolio_accounts WHERE id = ?;')
        .get(id);

      if (!r) return ok(null);

      return ok({
        id: r.id,
        userId: r.user_id,
        memberId: r.member_id,
        accountName: r.account_name,
        brokerName: r.broker_name,
        depository: r.depository as PortfolioAccountDto['depository'],
        accountNumberMasked: r.account_number_masked || undefined,
        accountType: r.account_type as PortfolioAccountDto['accountType'],
        createdAt: r.created_at,
      });
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async saveAccount(account: PortfolioAccountDto): Promise<Result<void>> {
    try {
      this.db
        .prepare(
          `INSERT INTO portfolio_accounts (id, user_id, member_id, account_name, broker_name, depository, account_number_masked, account_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             member_id = excluded.member_id,
             account_name = excluded.account_name,
             broker_name = excluded.broker_name,
             depository = excluded.depository,
             account_number_masked = excluded.account_number_masked,
             account_type = excluded.account_type;`
        )
        .run(
          account.id,
          account.userId,
          account.memberId,
          account.accountName,
          account.brokerName,
          account.depository,
          account.accountNumberMasked ?? null,
          account.accountType
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
