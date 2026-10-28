import { Result, ok, err } from '@wealthnest/shared';
import {
  AssetClassDefinition,
  TransactionType,
  LoanType,
  InterestType,
  LiabilityStatus,
  AssetLiabilityLinkType,
  GoalCategory,
  GoalPriority,
  ImportSummaryResult,
} from '@wealthnest/domain';
import { SqliteDatabase } from './sqlite-connection.js';
import { AssetClassRepositoryPort } from '../../ports/asset-class-repository.port.js';
import {
  CasImportRepositoryPort,
  ConfirmCasImportParams,
} from '../../ports/cas-import.port.js';
import {
  HoldingRepositoryPort,
  HoldingDetailDto,
  CreateHoldingParams,
  UpdateHoldingValuesParams,
} from '../../ports/holding-repository.port.js';
import {
  TransactionRepositoryPort,
  TransactionDetailDto,
  CreateTransactionParams,
} from '../../ports/transaction-repository.port.js';
import {
  LiabilityRepositoryPort,
  LiabilityDto,
  LiabilityBalanceDto,
  AssetValuationDto,
  AssetLiabilityLinkDto,
  CreateLiabilityParams,
  UpdateLiabilityParams,
  RecordLiabilityBalanceParams,
  RecordAssetValuationParams,
} from '../../ports/liability-repository.port.js';
import {
  GoalRepositoryPort,
  GoalDetailDto,
  CreateGoalParams,
  UpdateGoalParams,
  LinkHoldingToGoalParams,
} from '../../ports/goal-repository.port.js';
import {
  FamilyRepositoryPort,
  FamilyMemberDto,
  PortfolioAccountDto,
} from '../../ports/family-repository.port.js';
import { BackupPort, PortfolioBackupData } from '../../ports/backup.port.js';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// -------------------------------------------------------------
// 1. SqliteAssetClassAdapter
// -------------------------------------------------------------
export class SqliteAssetClassAdapter implements AssetClassRepositoryPort {
  constructor(private readonly db: SqliteDatabase) {}

  async listAll(): Promise<Result<AssetClassDefinition[]>> {
    try {
      const rows = this.db
        .prepare<{ id: string; name: string; color_hex: string; display_order: number }>(
          'SELECT id, name, color_hex, display_order FROM asset_classes ORDER BY display_order ASC;'
        )
        .all();

      const mapped: AssetClassDefinition[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.name,
        colorHex: r.color_hex,
        displayOrder: r.display_order,
      }));

      return ok(mapped);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}

// -------------------------------------------------------------
// 2. SqliteFamilyAdapter
// -------------------------------------------------------------
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
        }>('SELECT * FROM family_members WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC;')
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

// -------------------------------------------------------------
// 3. SqliteHoldingAdapter
// -------------------------------------------------------------
export class SqliteHoldingAdapter implements HoldingRepositoryPort {
  constructor(private readonly db: SqliteDatabase) {}

  async listDetailsByUser(userId: string): Promise<Result<HoldingDetailDto[]>> {
    try {
      const rows = this.db
        .prepare<{
          holdingId: string;
          assetId: string;
          name: string;
          ticker?: string;
          isin?: string;
          assetClassId: string;
          assetClassName: string;
          assetClassColor: string;
          quantity: number;
          unitCostCents: number;
          currentValueCents: number;
          currency: string;
          updatedAt: string;
          dematAccountId?: string;
          folioNumber?: string;
          amcName?: string;
          schemePlan?: string;
          costBasisVerified: number;
          memberId?: string;
          accountId?: string;
        }>(
          `SELECT 
             h.id as holdingId,
             a.id as assetId,
             a.name as name,
             a.ticker as ticker,
             a.isin as isin,
             ac.id as assetClassId,
             ac.name as assetClassName,
             ac.color_hex as assetClassColor,
             h.quantity as quantity,
             h.unit_cost_paise as unitCostCents,
             h.current_value_paise as currentValueCents,
             a.currency as currency,
             h.updated_at as updatedAt,
             h.demat_account_id as dematAccountId,
             h.folio_number as folioNumber,
             h.amc_name as amcName,
             h.scheme_plan as schemePlan,
             h.cost_basis_verified as costBasisVerified,
             h.member_id as memberId,
             h.account_id as accountId
           FROM holdings h
           JOIN assets a ON h.user_id = a.user_id AND h.asset_id = a.id
           JOIN asset_classes ac ON a.asset_class_id = ac.id
           WHERE h.user_id = ?
           ORDER BY h.updated_at DESC;`
        )
        .all(userId);

      const mapped: HoldingDetailDto[] = rows.map((r) => ({
        holdingId: r.holdingId,
        assetId: r.assetId,
        name: r.name,
        ticker: r.ticker || undefined,
        isin: r.isin || undefined,
        assetClassId: r.assetClassId,
        assetClassName: r.assetClassName,
        assetClassColor: r.assetClassColor,
        quantity: r.quantity,
        unitCostCents: r.unitCostCents,
        currentValueCents: r.currentValueCents,
        currency: r.currency,
        updatedAt: r.updatedAt,
        dematAccountId: r.dematAccountId || undefined,
        folioNumber: r.folioNumber || undefined,
        amcName: r.amcName || undefined,
        schemePlan: r.schemePlan || undefined,
        costBasisVerified: Boolean(r.costBasisVerified),
        memberId: r.memberId || undefined,
        accountId: r.accountId || undefined,
      }));

      return ok(mapped);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async createHoldingWithAsset(params: CreateHoldingParams): Promise<Result<HoldingDetailDto>> {
    try {
      // Ensure profile exists
      this.db
        .prepare('INSERT OR IGNORE INTO profiles (id, display_name) VALUES (?, ?);')
        .run(params.userId, 'User');

      const assetId = generateId('ast');
      const holdingId = generateId('hld');

      this.db
        .prepare(
          `INSERT INTO assets (id, user_id, name, ticker, isin, asset_class_id, currency)
           VALUES (?, ?, ?, ?, ?, ?, ?);`
        )
        .run(
          assetId,
          params.userId,
          params.name,
          params.ticker ?? null,
          params.isin ?? null,
          params.assetClassId,
          params.currency
        );

      this.db
        .prepare(
          `INSERT INTO holdings (
             id, user_id, asset_id, quantity, unit_cost_paise, current_value_paise,
             member_id, account_id, demat_account_id, folio_number, amc_name, scheme_plan, cost_basis_verified
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
        )
        .run(
          holdingId,
          params.userId,
          assetId,
          params.quantity,
          params.unitCostCents,
          params.currentValueCents,
          params.memberId ?? null,
          params.accountId ?? null,
          params.dematAccountId ?? null,
          params.folioNumber ?? null,
          params.amcName ?? null,
          params.schemePlan ?? null,
          params.costBasisVerified !== undefined ? (params.costBasisVerified ? 1 : 0) : 1
        );

      const created = await this.listDetailsByUser(params.userId);
      if (!created.success) return created;

      const found = created.value.find((h) => h.holdingId === holdingId);
      if (!found) return err(new Error('Holding was created but could not be retrieved.'));

      return ok(found);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async deleteHolding(holdingId: string, userId: string): Promise<Result<void>> {
    try {
      this.db
        .prepare('DELETE FROM holdings WHERE id = ? AND user_id = ?;')
        .run(holdingId, userId);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async updateHoldingValues(params: UpdateHoldingValuesParams): Promise<Result<void>> {
    try {
      this.db
        .prepare(
          `UPDATE holdings SET
             quantity = ?,
             unit_cost_paise = ?,
             current_value_paise = ?,
             updated_at = datetime('now')
           WHERE id = ? AND user_id = ?;`
        )
        .run(
          params.quantity,
          params.unitCostCents,
          params.currentValueCents,
          params.holdingId,
          params.userId
        );
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}

// -------------------------------------------------------------
// 4. SqliteTransactionAdapter
// -------------------------------------------------------------
export class SqliteTransactionAdapter implements TransactionRepositoryPort {
  constructor(private readonly db: SqliteDatabase) {}

  async listByUser(userId: string): Promise<Result<TransactionDetailDto[]>> {
    try {
      const rows = this.db
        .prepare<{
          id: string;
          userId: string;
          assetId?: string;
          assetName?: string;
          assetTicker?: string;
          type: string;
          quantity?: number;
          amountCents: number;
          currency: string;
          transactionDate: string;
          notes?: string;
          memberId?: string;
          accountId?: string;
          createdAt: string;
        }>(
          `SELECT 
             t.id,
             t.user_id as userId,
             t.asset_id as assetId,
             a.name as assetName,
             a.ticker as assetTicker,
             t.type,
             t.quantity,
             t.amount_paise as amountCents,
             t.currency,
             t.transaction_date as transactionDate,
             t.notes,
             t.member_id as memberId,
             t.account_id as accountId,
             t.created_at as createdAt
           FROM transactions t
           LEFT JOIN assets a ON t.user_id = a.user_id AND t.asset_id = a.id
           WHERE t.user_id = ?
           ORDER BY t.transaction_date DESC, t.created_at DESC;`
        )
        .all(userId);

      const mapped: TransactionDetailDto[] = rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        assetId: r.assetId || undefined,
        assetName: r.assetName || undefined,
        assetTicker: r.assetTicker || undefined,
        type: r.type as TransactionType,
        quantity: r.quantity !== null && r.quantity !== undefined ? r.quantity : undefined,
        amountCents: r.amountCents,
        currency: r.currency,
        transactionDate: r.transactionDate,
        notes: r.notes || undefined,
        memberId: r.memberId || undefined,
        accountId: r.accountId || undefined,
        createdAt: r.createdAt,
      }));

      return ok(mapped);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async createTransaction(params: CreateTransactionParams): Promise<Result<TransactionDetailDto>> {
    try {
      const id = generateId('txn');
      const txnDate = params.transactionDate || new Date().toISOString().slice(0, 10);

      this.db
        .prepare(
          `INSERT INTO transactions (id, user_id, asset_id, type, quantity, amount_paise, currency, transaction_date, notes, member_id, account_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
        )
        .run(
          id,
          params.userId,
          params.assetId ?? null,
          params.type,
          params.quantity ?? null,
          params.amountCents,
          params.currency,
          txnDate,
          params.notes ?? null,
          params.memberId ?? null,
          params.accountId ?? null
        );

      const listRes = await this.listByUser(params.userId);
      if (!listRes.success) return listRes;

      const created = listRes.value.find((t) => t.id === id);
      if (!created) return err(new Error('Transaction created but could not be retrieved.'));

      return ok(created);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async deleteTransaction(transactionId: string, userId: string): Promise<Result<void>> {
    try {
      this.db
        .prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?;')
        .run(transactionId, userId);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}

// -------------------------------------------------------------
// 5. SqliteLiabilityAdapter
// -------------------------------------------------------------
export class SqliteLiabilityAdapter implements LiabilityRepositoryPort {
  constructor(private readonly db: SqliteDatabase) {}

  async listLiabilitiesByUser(userId: string): Promise<Result<readonly LiabilityDto[]>> {
    try {
      const rows = this.db
        .prepare<{
          id: string;
          user_id: string;
          name: string;
          loan_type: string;
          lender: string;
          account_number?: string;
          original_principal_paise: number;
          interest_rate: number;
          interest_type: string;
          tenure_months?: number;
          emi_amount_paise: number;
          currency: string;
          start_date?: string;
          end_date?: string;
          status: string;
          linked_asset_id?: string;
          member_id?: string;
          notes?: string;
          created_at: string;
        }>('SELECT * FROM liabilities WHERE user_id = ? ORDER BY created_at DESC;')
        .all(userId);

      const mapped: LiabilityDto[] = rows.map((r) => {
        // Fetch latest balance
        const latestBalance = this.db
          .prepare<{ balance_paise: number; as_of_date: string }>(
            'SELECT balance_paise, as_of_date FROM liability_balances WHERE liability_id = ? ORDER BY as_of_date DESC LIMIT 1;'
          )
          .get(r.id);

        const currentBalanceCents = latestBalance
          ? BigInt(latestBalance.balance_paise)
          : BigInt(r.original_principal_paise);

        return {
          id: r.id,
          userId: r.user_id,
          name: r.name,
          loanType: r.loan_type as LoanType,
          lender: r.lender,
          accountNumber: r.account_number || undefined,
          originalPrincipalCents: BigInt(r.original_principal_paise),
          currentBalanceCents,
          interestRate: r.interest_rate,
          interestType: r.interest_type as InterestType,
          tenureMonths: r.tenure_months || undefined,
          emiAmountCents: BigInt(r.emi_amount_paise),
          currency: r.currency,
          startDate: r.start_date || undefined,
          endDate: r.end_date || undefined,
          status: r.status as LiabilityStatus,
          linkedAssetId: r.linked_asset_id || undefined,
          memberId: r.member_id || undefined,
          notes: r.notes || undefined,
          lastBalanceDate: latestBalance?.as_of_date,
          createdAt: r.created_at,
          updatedAt: r.created_at,
        };
      });

      return ok(mapped);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async getLiabilityById(id: string, userId: string): Promise<Result<LiabilityDto | null>> {
    try {
      const all = await this.listLiabilitiesByUser(userId);
      if (!all.success) return all;
      const found = all.value.find((l) => l.id === id);
      return ok(found || null);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async createLiability(params: CreateLiabilityParams): Promise<Result<LiabilityDto>> {
    try {
      const id = generateId('lia');
      this.db
        .prepare(
          `INSERT INTO liabilities (
             id, user_id, name, loan_type, lender, account_number, original_principal_paise,
             interest_rate, interest_type, tenure_months, emi_amount_paise, currency,
             start_date, end_date, status, linked_asset_id, member_id, notes
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
        )
        .run(
          id,
          params.userId,
          params.name,
          params.loanType,
          params.lender,
          params.accountNumber ?? null,
          Number(params.originalPrincipalCents),
          params.interestRate,
          params.interestType || 'floating',
          params.tenureMonths ?? null,
          Number(params.emiAmountCents ?? 0n),
          params.currency || 'INR',
          params.startDate ?? null,
          params.endDate ?? null,
          params.status || 'active',
          params.linkedAssetId ?? null,
          params.memberId ?? null,
          params.notes ?? null
        );

      if (params.initialBalanceCents !== undefined) {
        await this.recordLiabilityBalance({
          liabilityId: id,
          userId: params.userId,
          balanceCents: params.initialBalanceCents,
          asOfDate: params.startDate || new Date().toISOString().slice(0, 10),
        });
      }

      const res = await this.getLiabilityById(id, params.userId);
      if (!res.success || !res.value) return err(new Error('Failed to retrieve created liability'));
      return ok(res.value);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async updateLiability(params: UpdateLiabilityParams): Promise<Result<LiabilityDto>> {
    try {
      this.db
        .prepare(
          `UPDATE liabilities SET
             name = COALESCE(?, name),
             loan_type = COALESCE(?, loan_type),
             lender = COALESCE(?, lender),
             account_number = COALESCE(?, account_number),
             interest_rate = COALESCE(?, interest_rate),
             interest_type = COALESCE(?, interest_type),
             tenure_months = COALESCE(?, tenure_months),
             emi_amount_paise = COALESCE(?, emi_amount_paise),
             status = COALESCE(?, status),
             linked_asset_id = COALESCE(?, linked_asset_id),
             member_id = COALESCE(?, member_id),
             notes = COALESCE(?, notes)
           WHERE id = ? AND user_id = ?;`
        )
        .run(
          params.name ?? null,
          params.loanType ?? null,
          params.lender ?? null,
          params.accountNumber ?? null,
          params.interestRate ?? null,
          params.interestType ?? null,
          params.tenureMonths ?? null,
          params.emiAmountCents !== undefined ? Number(params.emiAmountCents) : null,
          params.status ?? null,
          params.linkedAssetId !== undefined ? params.linkedAssetId : null,
          params.memberId ?? null,
          params.notes ?? null,
          params.id,
          params.userId
        );

      const res = await this.getLiabilityById(params.id, params.userId);
      if (!res.success || !res.value) return err(new Error('Failed to retrieve updated liability'));
      return ok(res.value);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async deleteLiability(id: string, userId: string): Promise<Result<void>> {
    try {
      this.db
        .prepare('DELETE FROM liabilities WHERE id = ? AND user_id = ?;')
        .run(id, userId);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async recordLiabilityBalance(params: RecordLiabilityBalanceParams): Promise<Result<LiabilityBalanceDto>> {
    try {
      const id = generateId('lbal');
      this.db
        .prepare(
          `INSERT INTO liability_balances (id, user_id, liability_id, balance_paise, as_of_date, source, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(liability_id, as_of_date) DO UPDATE SET
             balance_paise = excluded.balance_paise,
             source = excluded.source,
             notes = excluded.notes;`
        )
        .run(
          id,
          params.userId,
          params.liabilityId,
          Number(params.balanceCents),
          params.asOfDate,
          params.source || 'manual',
          params.notes ?? null
        );

      return ok({
        id,
        liabilityId: params.liabilityId,
        userId: params.userId,
        balanceCents: params.balanceCents,
        asOfDate: params.asOfDate,
        source: params.source || 'manual',
        notes: params.notes,
        createdAt: new Date().toISOString(),
      });
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async listLiabilityBalances(liabilityId: string, userId: string): Promise<Result<readonly LiabilityBalanceDto[]>> {
    try {
      const rows = this.db
        .prepare<{
          id: string;
          liability_id: string;
          user_id: string;
          balance_paise: number;
          as_of_date: string;
          source: string;
          notes?: string;
          created_at: string;
        }>('SELECT * FROM liability_balances WHERE liability_id = ? AND user_id = ? ORDER BY as_of_date DESC;')
        .all(liabilityId, userId);

      const mapped: LiabilityBalanceDto[] = rows.map((r) => ({
        id: r.id,
        liabilityId: r.liability_id,
        userId: r.user_id,
        balanceCents: BigInt(r.balance_paise),
        asOfDate: r.as_of_date,
        source: r.source,
        notes: r.notes || undefined,
        createdAt: r.created_at,
      }));

      return ok(mapped);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async recordAssetValuation(params: RecordAssetValuationParams): Promise<Result<AssetValuationDto>> {
    try {
      const id = generateId('aval');
      this.db
        .prepare(
          `INSERT INTO asset_valuations (id, user_id, asset_id, valuation_paise, currency, as_of_date, source, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, asset_id, as_of_date) DO UPDATE SET
             valuation_paise = excluded.valuation_paise,
             source = excluded.source,
             notes = excluded.notes;`
        )
        .run(
          id,
          params.userId,
          params.assetId,
          Number(params.valuationCents),
          params.currency || 'INR',
          params.asOfDate,
          params.source || 'manual_appraisal',
          params.notes ?? null
        );

      return ok({
        id,
        assetId: params.assetId,
        userId: params.userId,
        valuationCents: params.valuationCents,
        currency: params.currency || 'INR',
        asOfDate: params.asOfDate,
        source: params.source || 'manual_appraisal',
        notes: params.notes,
        createdAt: new Date().toISOString(),
      });
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async listAssetValuations(assetId: string, userId: string): Promise<Result<readonly AssetValuationDto[]>> {
    try {
      const rows = this.db
        .prepare<{
          id: string;
          asset_id: string;
          user_id: string;
          valuation_paise: number;
          currency: string;
          as_of_date: string;
          source: string;
          notes?: string;
          created_at: string;
        }>('SELECT * FROM asset_valuations WHERE asset_id = ? AND user_id = ? ORDER BY as_of_date DESC;')
        .all(assetId, userId);

      const mapped: AssetValuationDto[] = rows.map((r) => ({
        id: r.id,
        assetId: r.asset_id,
        userId: r.user_id,
        valuationCents: BigInt(r.valuation_paise),
        currency: r.currency,
        asOfDate: r.as_of_date,
        source: r.source,
        notes: r.notes || undefined,
        createdAt: r.created_at,
      }));

      return ok(mapped);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async listAssetLiabilityLinks(userId: string): Promise<Result<readonly AssetLiabilityLinkDto[]>> {
    try {
      const rows = this.db
        .prepare<{
          id: string;
          user_id: string;
          asset_id: string;
          liability_id: string;
          link_type: string;
          ownership_share_percentage: number;
          created_at: string;
        }>('SELECT * FROM asset_liability_links WHERE user_id = ?;')
        .all(userId);

      const mapped: AssetLiabilityLinkDto[] = rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        assetId: r.asset_id,
        liabilityId: r.liability_id,
        linkType: r.link_type as AssetLiabilityLinkType,
        ownershipSharePercentage: r.ownership_share_percentage,
        createdAt: r.created_at,
      }));

      return ok(mapped);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async linkAssetLiability(params: {
    userId: string;
    assetId: string;
    liabilityId: string;
    linkType?: AssetLiabilityLinkType;
    ownershipSharePercentage?: number;
  }): Promise<Result<void>> {
    try {
      const id = generateId('all');
      this.db
        .prepare(
          `INSERT INTO asset_liability_links (id, user_id, asset_id, liability_id, link_type, ownership_share_percentage)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(asset_id, liability_id) DO UPDATE SET
             link_type = excluded.link_type,
             ownership_share_percentage = excluded.ownership_share_percentage;`
        )
        .run(
          id,
          params.userId,
          params.assetId,
          params.liabilityId,
          params.linkType || 'mortgage',
          params.ownershipSharePercentage ?? 100.0
        );

      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async unlinkAssetLiability(userId: string, assetId: string, liabilityId: string): Promise<Result<void>> {
    try {
      this.db
        .prepare('DELETE FROM asset_liability_links WHERE user_id = ? AND asset_id = ? AND liability_id = ?;')
        .run(userId, assetId, liabilityId);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}

// -------------------------------------------------------------
// 6. SqliteGoalAdapter
// -------------------------------------------------------------
export class SqliteGoalAdapter implements GoalRepositoryPort {
  constructor(private readonly db: SqliteDatabase) {}

  async listGoalsByUser(userId: string): Promise<Result<GoalDetailDto[]>> {
    try {
      const rows = this.db
        .prepare<{
          id: string;
          user_id: string;
          name: string;
          category: string;
          target_amount_paise: number;
          target_date: string;
          initial_saved_paise: number;
          monthly_contribution_paise: number;
          expected_return_rate: number;
          inflation_rate: number;
          priority: string;
          currency: string;
          notes?: string;
          member_id?: string;
          created_at: string;
        }>('SELECT * FROM financial_goals WHERE user_id = ? ORDER BY target_date ASC;')
        .all(userId);

      const mapped: GoalDetailDto[] = rows.map((r) => {
        const links = this.db
          .prepare<{
            holding_id: string;
            allocation_percentage: number;
            holding_name: string;
            ticker?: string;
            current_value_paise: number;
          }>(
            `SELECT 
               gh.holding_id,
               gh.allocation_percentage,
               a.name as holding_name,
               a.ticker as ticker,
               h.current_value_paise as current_value_paise
             FROM goal_holdings gh
             JOIN holdings h ON gh.holding_id = h.id
             JOIN assets a ON h.user_id = a.user_id AND h.asset_id = a.id
             WHERE gh.goal_id = ?;`
          )
          .all(r.id);

        return {
          id: r.id,
          userId: r.user_id,
          name: r.name,
          category: r.category as GoalCategory,
          targetAmountCents: r.target_amount_paise,
          targetDate: r.target_date,
          initialSavedCents: r.initial_saved_paise,
          monthlyContributionCents: r.monthly_contribution_paise,
          expectedReturnRate: r.expected_return_rate,
          inflationRate: r.inflation_rate,
          priority: r.priority as GoalPriority,
          currency: r.currency,
          notes: r.notes || undefined,
          memberId: r.member_id || undefined,
          createdAt: r.created_at,
          updatedAt: r.created_at,
          linkedHoldings: links.map((l) => ({
            holdingId: l.holding_id,
            holdingName: l.holding_name,
            ticker: l.ticker || undefined,
            allocationPercentage: l.allocation_percentage,
            currentValueCents: l.current_value_paise,
          })),
        };
      });

      return ok(mapped);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async createGoal(params: CreateGoalParams): Promise<Result<GoalDetailDto>> {
    try {
      const id = generateId('gol');
      this.db
        .prepare(
          `INSERT INTO financial_goals (
             id, user_id, name, category, target_amount_paise, target_date,
             initial_saved_paise, monthly_contribution_paise, expected_return_rate,
             inflation_rate, priority, currency, notes, member_id
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
        )
        .run(
          id,
          params.userId,
          params.name,
          params.category,
          params.targetAmountCents,
          params.targetDate,
          params.initialSavedCents ?? 0,
          params.monthlyContributionCents ?? 0,
          params.expectedReturnRate ?? 12.0,
          params.inflationRate ?? 6.0,
          params.priority ?? 'medium',
          params.currency || 'INR',
          params.notes ?? null,
          params.memberId ?? null
        );

      const listRes = await this.listGoalsByUser(params.userId);
      if (!listRes.success) return listRes;
      const found = listRes.value.find((g) => g.id === id);
      if (!found) return err(new Error('Failed to retrieve created goal'));

      return ok(found);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async updateGoal(params: UpdateGoalParams): Promise<Result<GoalDetailDto>> {
    try {
      this.db
        .prepare(
          `UPDATE financial_goals SET
             name = COALESCE(?, name),
             category = COALESCE(?, category),
             target_amount_paise = COALESCE(?, target_amount_paise),
             target_date = COALESCE(?, target_date),
             initial_saved_paise = COALESCE(?, initial_saved_paise),
             monthly_contribution_paise = COALESCE(?, monthly_contribution_paise),
             expected_return_rate = COALESCE(?, expected_return_rate),
             inflation_rate = COALESCE(?, inflation_rate),
             priority = COALESCE(?, priority),
             notes = COALESCE(?, notes),
             member_id = COALESCE(?, member_id)
           WHERE id = ? AND user_id = ?;`
        )
        .run(
          params.name ?? null,
          params.category ?? null,
          params.targetAmountCents ?? null,
          params.targetDate ?? null,
          params.initialSavedCents ?? null,
          params.monthlyContributionCents ?? null,
          params.expectedReturnRate ?? null,
          params.inflationRate ?? null,
          params.priority ?? null,
          params.notes ?? null,
          params.memberId ?? null,
          params.goalId,
          params.userId
        );

      const listRes = await this.listGoalsByUser(params.userId);
      if (!listRes.success) return listRes;
      const found = listRes.value.find((g) => g.id === params.goalId);
      if (!found) return err(new Error('Failed to retrieve updated goal'));

      return ok(found);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async deleteGoal(goalId: string, userId: string): Promise<Result<void>> {
    try {
      this.db
        .prepare('DELETE FROM financial_goals WHERE id = ? AND user_id = ?;')
        .run(goalId, userId);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async linkHoldingToGoal(params: LinkHoldingToGoalParams): Promise<Result<void>> {
    try {
      const id = generateId('gh');
      this.db
        .prepare(
          `INSERT INTO goal_holdings (id, goal_id, holding_id, allocation_percentage)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(goal_id, holding_id) DO UPDATE SET
             allocation_percentage = excluded.allocation_percentage;`
        )
        .run(id, params.goalId, params.holdingId, params.allocationPercentage);

      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async unlinkHoldingFromGoal(goalId: string, holdingId: string, _userId: string): Promise<Result<void>> {
    try {
      this.db
        .prepare('DELETE FROM goal_holdings WHERE goal_id = ? AND holding_id = ?;')
        .run(goalId, holdingId);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}

// -------------------------------------------------------------
// 7. SqliteBackupAdapter
// -------------------------------------------------------------
export class SqliteBackupAdapter implements BackupPort {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly holdingAdapter: SqliteHoldingAdapter,
    private readonly transactionAdapter: SqliteTransactionAdapter,
    private readonly liabilityAdapter: SqliteLiabilityAdapter,
    private readonly goalAdapter: SqliteGoalAdapter
  ) {}

  async createFullBackup(userId: string): Promise<Result<PortfolioBackupData>> {
    try {
      const [holdingsRes, transactionsRes, liabilitiesRes, goalsRes] = await Promise.all([
        this.holdingAdapter.listDetailsByUser(userId),
        this.transactionAdapter.listByUser(userId),
        this.liabilityAdapter.listLiabilitiesByUser(userId),
        this.goalAdapter.listGoalsByUser(userId),
      ]);

      if (!holdingsRes.success) return holdingsRes;
      if (!transactionsRes.success) return transactionsRes;
      if (!liabilitiesRes.success) return liabilitiesRes;
      if (!goalsRes.success) return goalsRes;

      const holdings = holdingsRes.value;
      const transactions = transactionsRes.value;
      const liabilities = liabilitiesRes.value;
      const goals = goalsRes.value;

      const totalAssetsCents = holdings.reduce((sum, h) => sum + h.currentValueCents, 0);
      const totalLiabilitiesCents = Number(
        liabilities.reduce((sum, l) => sum + l.currentBalanceCents, 0n)
      );
      const netWorthCents = totalAssetsCents - totalLiabilitiesCents;

      const backup: PortfolioBackupData = {
        version: '1.0.0',
        schema: 'wealthnest-portfolio-v1',
        exportedAt: new Date().toISOString(),
        user: {
          id: userId,
          email: `${userId}@wealthnest.local`,
          displayName: 'Investor',
          defaultCurrency: 'INR',
        },
        holdings,
        transactions,
        liabilities,
        goals,
        metrics: {
          totalAssetsCents,
          totalLiabilitiesCents,
          netWorthCents,
          totalHoldings: holdings.length,
          totalTransactions: transactions.length,
          totalLiabilities: liabilities.length,
          totalGoals: goals.length,
        },
      };

      return ok(backup);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async restoreFromBackup(
    userId: string,
    backup: PortfolioBackupData
  ): Promise<
    Result<{
      readonly restoredHoldings: number;
      readonly restoredTransactions: number;
      readonly restoredLiabilities: number;
      readonly restoredGoals: number;
    }>
  > {
    try {
      // Begin transaction for atomic restore
      this.db.exec('BEGIN IMMEDIATE TRANSACTION;');

      try {
        // Ensure user profile exists
        this.db
          .prepare(
            `INSERT INTO profiles (id, display_name, default_currency)
             VALUES (?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               display_name = excluded.display_name,
               default_currency = excluded.default_currency;`
          )
          .run(userId, backup.user.displayName || 'Restored Investor', backup.user.defaultCurrency || 'INR');

        // Restore Holdings & Assets
        let restoredHoldings = 0;
        for (const h of backup.holdings) {
          const assetId = h.assetId || generateId('ast');
          this.db
            .prepare(
              `INSERT INTO assets (id, user_id, name, ticker, isin, asset_class_id, currency)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 name = excluded.name,
                 ticker = excluded.ticker,
                 isin = excluded.isin,
                 asset_class_id = excluded.asset_class_id,
                 currency = excluded.currency;`
            )
            .run(
              assetId,
              userId,
              h.name,
              h.ticker ?? null,
              h.isin ?? null,
              h.assetClassId || 'equity',
              h.currency || 'INR'
            );

          const holdingId = h.holdingId || generateId('hld');
          this.db
            .prepare(
              `INSERT INTO holdings (
                 id, user_id, asset_id, quantity, unit_cost_paise, current_value_paise,
                 member_id, account_id, demat_account_id, folio_number, amc_name, scheme_plan, cost_basis_verified
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 quantity = excluded.quantity,
                 unit_cost_paise = excluded.unit_cost_paise,
                 current_value_paise = excluded.current_value_paise;`
            )
            .run(
              holdingId,
              userId,
              assetId,
              h.quantity,
              h.unitCostCents,
              h.currentValueCents,
              h.memberId ?? null,
              h.accountId ?? null,
              h.dematAccountId ?? null,
              h.folioNumber ?? null,
              h.amcName ?? null,
              h.schemePlan ?? null,
              h.costBasisVerified ? 1 : 0
            );
          restoredHoldings++;
        }

        // Restore Transactions
        let restoredTransactions = 0;
        for (const t of backup.transactions) {
          const txnId = t.id || generateId('txn');
          this.db
            .prepare(
              `INSERT INTO transactions (id, user_id, asset_id, type, quantity, amount_paise, currency, transaction_date, notes, member_id, account_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 amount_paise = excluded.amount_paise,
                 notes = excluded.notes;`
            )
            .run(
              txnId,
              userId,
              t.assetId ?? null,
              t.type,
              t.quantity ?? null,
              t.amountCents,
              t.currency || 'INR',
              t.transactionDate,
              t.notes ?? null,
              t.memberId ?? null,
              t.accountId ?? null
            );
          restoredTransactions++;
        }

        // Restore Liabilities
        let restoredLiabilities = 0;
        for (const l of backup.liabilities) {
          const liaId = l.id || generateId('lia');
          this.db
            .prepare(
              `INSERT INTO liabilities (
                 id, user_id, name, loan_type, lender, account_number, original_principal_paise,
                 interest_rate, interest_type, tenure_months, emi_amount_paise, currency,
                 start_date, end_date, status, linked_asset_id, member_id, notes
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 interest_rate = excluded.interest_rate,
                 emi_amount_paise = excluded.emi_amount_paise;`
            )
            .run(
              liaId,
              userId,
              l.name,
              l.loanType,
              l.lender,
              l.accountNumber ?? null,
              Number(l.originalPrincipalCents),
              l.interestRate,
              l.interestType || 'floating',
              l.tenureMonths ?? null,
              Number(l.emiAmountCents ?? 0n),
              l.currency || 'INR',
              l.startDate ?? null,
              l.endDate ?? null,
              l.status || 'active',
              l.linkedAssetId ?? null,
              l.memberId ?? null,
              l.notes ?? null
            );

          // Add balance snapshot
          const balId = generateId('lbal');
          this.db
            .prepare(
              `INSERT INTO liability_balances (id, user_id, liability_id, balance_paise, as_of_date, source)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(liability_id, as_of_date) DO UPDATE SET balance_paise = excluded.balance_paise;`
            )
            .run(
              balId,
              userId,
              liaId,
              Number(l.currentBalanceCents ?? l.originalPrincipalCents),
              l.lastBalanceDate || new Date().toISOString().slice(0, 10),
              'restore'
            );
          restoredLiabilities++;
        }

        // Restore Goals
        let restoredGoals = 0;
        for (const g of backup.goals) {
          const golId = g.id || generateId('gol');
          this.db
            .prepare(
              `INSERT INTO financial_goals (
                 id, user_id, name, category, target_amount_paise, target_date,
                 initial_saved_paise, monthly_contribution_paise, expected_return_rate,
                 inflation_rate, priority, currency, notes, member_id
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 target_amount_paise = excluded.target_amount_paise;`
            )
            .run(
              golId,
              userId,
              g.name,
              g.category,
              g.targetAmountCents,
              g.targetDate,
              g.initialSavedCents ?? 0,
              g.monthlyContributionCents ?? 0,
              g.expectedReturnRate ?? 12.0,
              g.inflationRate ?? 6.0,
              g.priority ?? 'medium',
              g.currency || 'INR',
              g.notes ?? null,
              g.memberId ?? null
            );
          restoredGoals++;
        }

        this.db.exec('COMMIT;');

        return ok({
          restoredHoldings,
          restoredTransactions,
          restoredLiabilities,
          restoredGoals,
        });
      } catch (innerErr) {
        this.db.exec('ROLLBACK;');
        throw innerErr;
      }
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}

// -------------------------------------------------------------
// 8. SqliteCasImportAdapter
// -------------------------------------------------------------
export class SqliteCasImportAdapter implements CasImportRepositoryPort {
  constructor(private readonly db: SqliteDatabase) {}

  async upsertHoldingsFromCas(
    params: ConfirmCasImportParams
  ): Promise<Result<ImportSummaryResult>> {
    try {
      // Ensure user profile exists for foreign key integrity
      this.db
        .prepare(
          `INSERT OR IGNORE INTO profiles (id, display_name, default_currency) VALUES (?, 'Local Investor', 'INR');`
        )
        .run(params.userId);

      // Verify optional memberId / accountId exist for this user in SQLite to respect composite FKs
      let validMemberId: string | null = null;
      if (params.memberId) {
        const memRow = this.db
          .prepare<{ id: string }>(
            'SELECT id FROM family_members WHERE user_id = ? AND id = ?;'
          )
          .get(params.userId, params.memberId);
        if (memRow) {
          validMemberId = memRow.id;
        }
      }

      let validAccountId: string | null = null;
      if (params.accountId) {
        const accRow = this.db
          .prepare<{ id: string }>(
            'SELECT id FROM portfolio_accounts WHERE user_id = ? AND id = ?;'
          )
          .get(params.userId, params.accountId);
        if (accRow) {
          validAccountId = accRow.id;
        }
      }

      let imported = 0;
      let updated = 0;
      let failed = 0;
      let equitiesImported = 0;
      let equitiesUpdated = 0;
      let mutualFundsImported = 0;
      let mutualFundsUpdated = 0;

      for (const item of params.items) {
        try {
          // 1. Resolve existing asset by ISIN first, then case-insensitive name
          let existingAssetId: string | null = null;

          if (item.isin) {
            const byIsin = this.db
              .prepare<{ id: string }>(
                'SELECT id FROM assets WHERE user_id = ? AND isin = ?;'
              )
              .get(params.userId, item.isin);

            if (byIsin) {
              existingAssetId = byIsin.id;
              this.db
                .prepare(
                  `UPDATE assets SET name = ?, ticker = COALESCE(?, ticker) WHERE id = ? AND user_id = ?;`
                )
                .run(item.name, item.ticker ?? null, existingAssetId, params.userId);
            }
          }

          if (!existingAssetId) {
            const byName = this.db
              .prepare<{ id: string }>(
                'SELECT id FROM assets WHERE user_id = ? AND LOWER(name) = LOWER(?);'
              )
              .get(params.userId, item.name);

            if (byName) {
              existingAssetId = byName.id;
              this.db
                .prepare(
                  `UPDATE assets SET name = ?, isin = COALESCE(?, isin), ticker = COALESCE(?, ticker) WHERE id = ? AND user_id = ?;`
                )
                .run(
                  item.name,
                  item.isin || null,
                  item.ticker ?? null,
                  existingAssetId,
                  params.userId
                );
            }
          }

          // 2. Create asset if it does not exist
          if (!existingAssetId) {
            const classExists = this.db
              .prepare<{ id: string }>('SELECT id FROM asset_classes WHERE id = ?;')
              .get(item.assetClassId);
            const assetClassToUse = classExists ? item.assetClassId : 'equity';
            const newAssetId = generateId('ast');

            this.db
              .prepare(
                `INSERT INTO assets (id, user_id, name, ticker, isin, asset_class_id, currency)
                 VALUES (?, ?, ?, ?, ?, ?, ?);`
              )
              .run(
                newAssetId,
                params.userId,
                item.name,
                item.ticker || null,
                item.isin || null,
                assetClassToUse,
                item.currency || 'INR'
              );

            existingAssetId = newAssetId;
          }

          // 3. Check if holding already exists for (user_id, asset_id)
          const existingHolding = this.db
            .prepare<{
              id: string;
              unit_cost_paise: number;
              cost_basis_verified: number;
            }>(
              'SELECT id, unit_cost_paise, cost_basis_verified FROM holdings WHERE user_id = ? AND asset_id = ?;'
            )
            .get(params.userId, existingAssetId);

          const isMutualFund = item.assetClassId === 'mutual_fund';

          if (existingHolding) {
            const shouldPreserveUnitCost =
              Boolean(existingHolding.cost_basis_verified) && !item.costBasisVerified;
            const nextUnitCost = shouldPreserveUnitCost
              ? existingHolding.unit_cost_paise
              : item.unitCostCents;
            const nextVerified =
              Boolean(item.costBasisVerified) || Boolean(existingHolding.cost_basis_verified)
                ? 1
                : 0;

            this.db
              .prepare(
                `UPDATE holdings
                 SET quantity = ?,
                     unit_cost_paise = ?,
                     current_value_paise = ?,
                     demat_account_id = COALESCE(?, demat_account_id),
                     folio_number = COALESCE(?, folio_number),
                     amc_name = COALESCE(?, amc_name),
                     scheme_plan = COALESCE(?, scheme_plan),
                     cost_basis_verified = ?,
                     member_id = COALESCE(?, member_id),
                     account_id = COALESCE(?, account_id),
                     updated_at = datetime('now')
                 WHERE id = ? AND user_id = ?;`
              )
              .run(
                item.quantity,
                nextUnitCost,
                item.currentValueCents,
                item.dematAccountId ?? null,
                item.folioNumber ?? null,
                item.amcName ?? null,
                item.schemePlan ?? null,
                nextVerified,
                validMemberId,
                validAccountId,
                existingHolding.id,
                params.userId
              );

            updated++;
            if (isMutualFund) {
              mutualFundsUpdated++;
            } else {
              equitiesUpdated++;
            }
          } else {
            const newHoldingId = generateId('hld');
            this.db
              .prepare(
                `INSERT INTO holdings (
                   id, user_id, asset_id, quantity, unit_cost_paise, current_value_paise,
                   member_id, account_id, demat_account_id, folio_number, amc_name, scheme_plan, cost_basis_verified
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
              )
              .run(
                newHoldingId,
                params.userId,
                existingAssetId,
                item.quantity,
                item.unitCostCents,
                item.currentValueCents,
                validMemberId,
                validAccountId,
                item.dematAccountId ?? null,
                item.folioNumber ?? null,
                item.amcName ?? null,
                item.schemePlan ?? null,
                item.costBasisVerified ? 1 : 0
              );

            imported++;
            if (isMutualFund) {
              mutualFundsImported++;
            } else {
              equitiesImported++;
            }
          }
        } catch {
          failed++;
        }
      }

      // 4. Import transactions if provided
      let transactionsImported = 0;
      if (params.transactions && params.transactions.length > 0) {
        for (const tx of params.transactions) {
          try {
            let assetId: string | null = null;
            if (tx.isin) {
              const byIsin = this.db
                .prepare<{ id: string }>(
                  'SELECT id FROM assets WHERE user_id = ? AND isin = ?;'
                )
                .get(params.userId, tx.isin);
              if (byIsin) {
                assetId = byIsin.id;
              }
            }

            if (!assetId && tx.schemeName) {
              const byName = this.db
                .prepare<{ id: string }>(
                  'SELECT id FROM assets WHERE user_id = ? AND LOWER(name) = LOWER(?);'
                )
                .get(params.userId, tx.schemeName);
              if (byName) {
                assetId = byName.id;
              }
            }

            if (!assetId) {
              const newAssetId = generateId('ast');
              this.db
                .prepare(
                  `INSERT INTO assets (id, user_id, name, ticker, isin, asset_class_id, currency)
                   VALUES (?, ?, ?, ?, ?, 'mutual_fund', ?);`
                )
                .run(
                  newAssetId,
                  params.userId,
                  tx.schemeName || 'Imported Security',
                  tx.ticker || null,
                  tx.isin || null,
                  tx.currency || 'INR'
                );
              assetId = newAssetId;
            }

            const existingTx = this.db
              .prepare<{ id: string }>(
                `SELECT id FROM transactions
                 WHERE user_id = ? AND asset_id = ? AND transaction_date = ? AND amount_paise = ? AND type = ?;`
              )
              .get(params.userId, assetId, tx.date, tx.amountCents, tx.type);

            if (!existingTx) {
              const newTxId = generateId('txn');
              this.db
                .prepare(
                  `INSERT INTO transactions (
                     id, user_id, asset_id, type, quantity, amount_paise, currency,
                     transaction_date, notes, member_id, account_id
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
                )
                .run(
                  newTxId,
                  params.userId,
                  assetId,
                  tx.type,
                  tx.units ?? null,
                  tx.amountCents,
                  tx.currency || 'INR',
                  tx.date,
                  tx.description || null,
                  validMemberId,
                  validAccountId
                );
              transactionsImported++;
            }
          } catch {
            // Non-blocking per transaction
          }
        }
      }

      return ok({
        batchId: `sqlite-batch-${Date.now()}`,
        total: params.items.length,
        imported,
        updated,
        skipped: 0,
        failed,
        equitiesImported,
        equitiesUpdated,
        mutualFundsImported,
        mutualFundsUpdated,
        transactionsImported,
      });
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}
