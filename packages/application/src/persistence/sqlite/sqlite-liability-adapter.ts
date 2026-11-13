import { Result, ok, err } from '@wealthnest/shared';
import {
  LoanType,
  InterestType,
  LiabilityStatus,
  AssetLiabilityLinkType,
} from '@wealthnest/domain';
import { SqliteDatabase } from './sqlite-connection.js';
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
import { generateId } from './sqlite-utils.js';

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
      this.db.prepare('DELETE FROM liabilities WHERE id = ? AND user_id = ?;').run(id, userId);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async recordLiabilityBalance(
    params: RecordLiabilityBalanceParams
  ): Promise<Result<LiabilityBalanceDto>> {
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

  async listLiabilityBalances(
    liabilityId: string,
    userId: string
  ): Promise<Result<readonly LiabilityBalanceDto[]>> {
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
        }>(
          'SELECT * FROM liability_balances WHERE liability_id = ? AND user_id = ? ORDER BY as_of_date DESC;'
        )
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

  async recordAssetValuation(
    params: RecordAssetValuationParams
  ): Promise<Result<AssetValuationDto>> {
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

  async listAssetValuations(
    assetId: string,
    userId: string
  ): Promise<Result<readonly AssetValuationDto[]>> {
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
        }>(
          'SELECT * FROM asset_valuations WHERE asset_id = ? AND user_id = ? ORDER BY as_of_date DESC;'
        )
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

  async unlinkAssetLiability(
    userId: string,
    assetId: string,
    liabilityId: string
  ): Promise<Result<void>> {
    try {
      this.db
        .prepare(
          'DELETE FROM asset_liability_links WHERE user_id = ? AND asset_id = ? AND liability_id = ?;'
        )
        .run(userId, assetId, liabilityId);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}
