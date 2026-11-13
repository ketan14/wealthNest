import { Result, ok, err } from '@wealthnest/shared';
import { AssetClassDefinition, TransactionType } from '@wealthnest/domain';
import { SqliteDatabase } from './sqlite-connection.js';
import { AssetClassRepositoryPort } from '../../ports/asset-class-repository.port.js';
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
import { generateId } from './sqlite-utils.js';

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
      this.db.prepare('DELETE FROM holdings WHERE id = ? AND user_id = ?;').run(holdingId, userId);
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
          destinationAccountId?: string;
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
             t.destination_account_id as destinationAccountId,
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
        destinationAccountId: r.destinationAccountId || undefined,
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
          `INSERT INTO transactions (id, user_id, asset_id, type, quantity, amount_paise, currency, transaction_date, notes, member_id, account_id, destination_account_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
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
          params.accountId ?? null,
          params.destinationAccountId ?? null
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
