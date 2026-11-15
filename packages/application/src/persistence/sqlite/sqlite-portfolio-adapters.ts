import { Result, ok, err } from '@wealthnest/shared';
import {
  AssetClassDefinition,
  TransactionType,
  RecordVisibility,
  HoldingOwnerShareInput,
  validateOwnershipShares,
} from '@wealthnest/domain';
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
import { generateId, isHouseholdScope } from './sqlite-utils.js';

interface HoldingJoinedRow {
  holdingId: string;
  assetId: string;
  householdId?: string | null;
  visibility?: string | null;
  createdBy?: string | null;
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
}

const HOLDING_JOIN_SELECT = `
  SELECT 
    h.id as holdingId,
    a.id as assetId,
    h.household_id as householdId,
    h.visibility as visibility,
    h.created_by as createdBy,
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
`;

interface TransactionJoinedRow {
  id: string;
  householdId?: string | null;
  userId: string;
  visibility?: string | null;
  createdBy?: string | null;
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
}

const TRANSACTION_JOIN_SELECT = `
  SELECT 
    t.id,
    t.household_id as householdId,
    t.user_id as userId,
    t.visibility as visibility,
    t.created_by as createdBy,
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
`;

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

  private loadOwners(holdingId: string, fallbackMemberId?: string): HoldingOwnerShareInput[] | undefined {
    const ownerRows = this.db
      .prepare<{
        family_member_id: string;
        ownership_share: number;
        is_primary_owner: number;
      }>(
        `SELECT family_member_id, ownership_share, is_primary_owner
         FROM holding_owners
         WHERE holding_id = ?
         ORDER BY is_primary_owner DESC, ownership_share DESC;`
      )
      .all(holdingId);

    if (ownerRows.length > 0) {
      return ownerRows.map((o) => ({
        familyMemberId: o.family_member_id,
        ownershipShare: Number(o.ownership_share),
        isPrimaryOwner: Boolean(o.is_primary_owner),
      }));
    }

    if (fallbackMemberId) {
      return [
        {
          familyMemberId: fallbackMemberId,
          ownershipShare: 100,
          isPrimaryOwner: true,
        },
      ];
    }

    return undefined;
  }

  private mapHoldingRows(rows: HoldingJoinedRow[]): HoldingDetailDto[] {
    return rows.map((r) => ({
      holdingId: r.holdingId,
      assetId: r.assetId,
      householdId: r.householdId || undefined,
      visibility: (r.visibility as RecordVisibility) || 'household_shared',
      createdBy: r.createdBy || undefined,
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
      owners: this.loadOwners(r.holdingId, r.memberId || undefined),
    }));
  }

  async listDetailsByUser(userId: string): Promise<Result<HoldingDetailDto[]>> {
    try {
      const rows = this.db
        .prepare<HoldingJoinedRow>(`${HOLDING_JOIN_SELECT} WHERE h.user_id = ? ORDER BY h.updated_at DESC;`)
        .all(userId);

      return ok(this.mapHoldingRows(rows));
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async listDetailsByHousehold(householdId: string): Promise<Result<HoldingDetailDto[]>> {
    if (!isHouseholdScope(this.db, householdId)) {
      return this.listDetailsByUser(householdId);
    }
    try {
      const rows = this.db
        .prepare<HoldingJoinedRow>(
          `${HOLDING_JOIN_SELECT} WHERE h.household_id = ? ORDER BY h.updated_at DESC;`
        )
        .all(householdId);

      return ok(this.mapHoldingRows(rows));
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async createHoldingWithAsset(params: CreateHoldingParams): Promise<Result<HoldingDetailDto>> {
    try {
      const resolvedOwners: HoldingOwnerShareInput[] | undefined =
        params.ownerShares && params.ownerShares.length > 0
          ? [...params.ownerShares]
          : params.memberId
            ? [{ familyMemberId: params.memberId, ownershipShare: 100, isPrimaryOwner: true }]
            : undefined;

      if (resolvedOwners && resolvedOwners.length > 0) {
        const validation = validateOwnershipShares(
          resolvedOwners.map((o) => ({
            familyMemberId: o.familyMemberId,
            sharePercentage: o.ownershipShare,
            isPrimary: o.isPrimaryOwner,
          }))
        );
        if (!validation.valid) {
          return err(new Error(validation.error ?? 'Invalid ownership shares.'));
        }
      }

      const primaryOwnerMemberId =
        resolvedOwners?.find((o) => o.isPrimaryOwner)?.familyMemberId ??
        resolvedOwners?.[0]?.familyMemberId ??
        params.memberId ??
        null;

      // Ensure profile (and household if supplied) exist
      this.db
        .prepare('INSERT OR IGNORE INTO profiles (id, display_name) VALUES (?, ?);')
        .run(params.userId, 'User');
      if (params.householdId) {
        this.db
          .prepare('INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, ?, ?);')
          .run(params.householdId, 'My Household', params.userId);
      }

      const assetId = generateId('ast');
      const holdingId = generateId('hld');
      const visibility = params.visibility ?? 'household_shared';

      this.db
        .prepare(
          `INSERT INTO assets (id, user_id, name, ticker, isin, asset_class_id, currency, household_id, visibility, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
        )
        .run(
          assetId,
          params.userId,
          params.name,
          params.ticker ?? null,
          params.isin ?? null,
          params.assetClassId,
          params.currency,
          params.householdId ?? null,
          visibility,
          params.userId
        );

      this.db
        .prepare(
          `INSERT INTO holdings (
             id, user_id, asset_id, quantity, unit_cost_paise, current_value_paise,
             member_id, account_id, demat_account_id, folio_number, amc_name, scheme_plan, cost_basis_verified,
             household_id, visibility, created_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
        )
        .run(
          holdingId,
          params.userId,
          assetId,
          params.quantity,
          params.unitCostCents,
          params.currentValueCents,
          primaryOwnerMemberId,
          params.accountId ?? null,
          params.dematAccountId ?? null,
          params.folioNumber ?? null,
          params.amcName ?? null,
          params.schemePlan ?? null,
          params.costBasisVerified !== undefined ? (params.costBasisVerified ? 1 : 0) : 1,
          params.householdId ?? null,
          visibility,
          params.userId
        );

      if (resolvedOwners && resolvedOwners.length > 0) {
        await this.writeHoldingOwnersInternal(
          holdingId,
          params.householdId ?? null,
          resolvedOwners,
          false
        );
      }

      const created = await this.listDetailsByUser(params.userId);
      if (!created.success) return created;

      const found = created.value.find((h) => h.holdingId === holdingId);
      if (!found) return err(new Error('Holding was created but could not be retrieved.'));

      return ok(found);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  private writeHoldingOwnersInternal(
    holdingId: string,
    householdId: string | null,
    owners: readonly HoldingOwnerShareInput[],
    syncPrimaryMember: boolean = true
  ): void {
    this.db.prepare('DELETE FROM holding_owners WHERE holding_id = ?;').run(holdingId);

    const hasExplicitPrimary = owners.some((o) => o.isPrimaryOwner);
    owners.forEach((o, idx) => {
      const isPrimary = o.isPrimaryOwner ?? (!hasExplicitPrimary && idx === 0);
      this.db
        .prepare(
          `INSERT INTO holding_owners (id, household_id, holding_id, family_member_id, ownership_share, is_primary_owner)
           VALUES (?, ?, ?, ?, ?, ?);`
        )
        .run(
          generateId('ho'),
          householdId,
          holdingId,
          o.familyMemberId,
          o.ownershipShare,
          isPrimary ? 1 : 0
        );
    });

    if (syncPrimaryMember) {
      const primaryId =
        owners.find((o) => o.isPrimaryOwner)?.familyMemberId ?? owners[0]?.familyMemberId ?? null;
      this.db
        .prepare(`UPDATE holdings SET member_id = ?, updated_at = datetime('now') WHERE id = ?;`)
        .run(primaryId, holdingId);
    }
  }

  async setHoldingOwners(
    holdingId: string,
    owners: readonly HoldingOwnerShareInput[]
  ): Promise<Result<void>> {
    try {
      const validation = validateOwnershipShares(
        owners.map((o) => ({
          familyMemberId: o.familyMemberId,
          sharePercentage: o.ownershipShare,
          isPrimary: o.isPrimaryOwner,
        }))
      );
      if (!validation.valid) {
        return err(new Error(validation.error ?? 'Invalid ownership shares.'));
      }

      const row = this.db
        .prepare<{ household_id?: string | null }>('SELECT household_id FROM holdings WHERE id = ?;')
        .get(holdingId);

      this.writeHoldingOwnersInternal(holdingId, row?.household_id ?? null, owners, true);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async deleteHolding(holdingId: string, scopeId: string): Promise<Result<void>> {
    try {
      this.db
        .prepare('DELETE FROM holdings WHERE id = ? AND (user_id = ? OR household_id = ?);')
        .run(holdingId, scopeId, scopeId);
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
           WHERE id = ? AND (user_id = ? OR household_id = ?);`
        )
        .run(
          params.quantity,
          params.unitCostCents,
          params.currentValueCents,
          params.holdingId,
          params.userId,
          params.householdId ?? params.userId
        );

      if (params.visibility) {
        this.db
          .prepare(`UPDATE holdings SET visibility = ? WHERE id = ?;`)
          .run(params.visibility, params.holdingId);
      }

      if (params.ownerShares && params.ownerShares.length > 0) {
        const res = await this.setHoldingOwners(params.holdingId, params.ownerShares);
        if (!res.success) return res;
      }

      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}

export class SqliteTransactionAdapter implements TransactionRepositoryPort {
  constructor(private readonly db: SqliteDatabase) {}

  private mapTransactionRows(rows: TransactionJoinedRow[]): TransactionDetailDto[] {
    return rows.map((r) => ({
      id: r.id,
      householdId: r.householdId || undefined,
      userId: r.userId,
      visibility: (r.visibility as RecordVisibility) || 'household_shared',
      createdBy: r.createdBy || undefined,
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
  }

  async listByUser(userId: string): Promise<Result<TransactionDetailDto[]>> {
    try {
      const rows = this.db
        .prepare<TransactionJoinedRow>(
          `${TRANSACTION_JOIN_SELECT} WHERE t.user_id = ? ORDER BY t.transaction_date DESC, t.created_at DESC;`
        )
        .all(userId);

      return ok(this.mapTransactionRows(rows));
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async listByHousehold(householdId: string): Promise<Result<TransactionDetailDto[]>> {
    if (!isHouseholdScope(this.db, householdId)) {
      return this.listByUser(householdId);
    }
    try {
      const rows = this.db
        .prepare<TransactionJoinedRow>(
          `${TRANSACTION_JOIN_SELECT} WHERE t.household_id = ? ORDER BY t.transaction_date DESC, t.created_at DESC;`
        )
        .all(householdId);

      return ok(this.mapTransactionRows(rows));
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async createTransaction(params: CreateTransactionParams): Promise<Result<TransactionDetailDto>> {
    try {
      const id = generateId('txn');
      const txnDate = params.transactionDate || new Date().toISOString().slice(0, 10);
      const visibility = params.visibility ?? 'household_shared';

      if (params.householdId) {
        this.db
          .prepare('INSERT OR IGNORE INTO profiles (id, display_name) VALUES (?, ?);')
          .run(params.userId, 'User');
        this.db
          .prepare('INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, ?, ?);')
          .run(params.householdId, 'My Household', params.userId);
      }

      this.db
        .prepare(
          `INSERT INTO transactions (id, user_id, asset_id, type, quantity, amount_paise, currency, transaction_date, notes, member_id, account_id, destination_account_id, household_id, visibility, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
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
          params.destinationAccountId ?? null,
          params.householdId ?? null,
          visibility,
          params.userId
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

  async deleteTransaction(transactionId: string, scopeId: string): Promise<Result<void>> {
    try {
      this.db
        .prepare('DELETE FROM transactions WHERE id = ? AND (user_id = ? OR household_id = ?);')
        .run(transactionId, scopeId, scopeId);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}
