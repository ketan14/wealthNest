import { Result, ok, err } from '@wealthnest/shared';
import {
  LoanType,
  InterestType,
  LiabilityStatus,
  AssetLiabilityLinkType,
  RecordVisibility,
  LiabilityPartyShareInput,
  LiabilityPartyRole,
  validateOwnershipShares,
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
import { generateId, isHouseholdScope } from './sqlite-utils.js';

interface LiabilityRow {
  id: string;
  user_id: string;
  household_id?: string | null;
  visibility?: string | null;
  created_by?: string | null;
  name: string;
  loan_type: string;
  lender: string;
  account_number?: string | null;
  original_principal_paise: number;
  interest_rate: number;
  interest_type: string;
  tenure_months?: number | null;
  emi_amount_paise: number;
  currency: string;
  start_date?: string | null;
  end_date?: string | null;
  status: string;
  linked_asset_id?: string | null;
  member_id?: string | null;
  notes?: string | null;
  created_at: string;
}

export class SqliteLiabilityAdapter implements LiabilityRepositoryPort {
  constructor(private readonly db: SqliteDatabase) {}

  private loadParties(
    liabilityId: string,
    fallbackMemberId?: string
  ): LiabilityPartyShareInput[] | undefined {
    const rows = this.db
      .prepare<{
        family_member_id: string;
        party_role: LiabilityPartyRole;
        liability_share: number;
      }>(
        `SELECT family_member_id, party_role, liability_share
         FROM liability_parties
         WHERE liability_id = ?
         ORDER BY liability_share DESC;`
      )
      .all(liabilityId);

    if (rows.length > 0) {
      return rows.map((p) => ({
        familyMemberId: p.family_member_id,
        partyRole: p.party_role,
        liabilityShare: Number(p.liability_share),
      }));
    }

    if (fallbackMemberId) {
      return [
        {
          familyMemberId: fallbackMemberId,
          partyRole: 'primary_borrower',
          liabilityShare: 100,
        },
      ];
    }

    return undefined;
  }

  private mapLiabilities(rows: LiabilityRow[]): LiabilityDto[] {
    return rows.map((r) => {
      const latestBalance = this.db
        .prepare<{ balance_paise: number; as_of_date: string }>(
          'SELECT balance_paise, as_of_date FROM liability_balances WHERE liability_id = ? ORDER BY as_of_date DESC LIMIT 1;'
        )
        .get(r.id);

      const currentBalanceCents = latestBalance
        ? BigInt(latestBalance.balance_paise)
        : BigInt(r.original_principal_paise);

      const parties = this.loadParties(r.id, r.member_id || undefined);
      const coBorrowerMemberIds =
        parties
          ?.filter((p) => p.partyRole !== 'primary_borrower')
          .map((p) => p.familyMemberId) ?? undefined;

      return {
        id: r.id,
        householdId: r.household_id || undefined,
        userId: r.user_id,
        visibility: (r.visibility as RecordVisibility) || 'household_shared',
        createdBy: r.created_by || undefined,
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
        coBorrowerMemberIds:
          coBorrowerMemberIds && coBorrowerMemberIds.length > 0 ? coBorrowerMemberIds : undefined,
        parties,
        notes: r.notes || undefined,
        lastBalanceDate: latestBalance?.as_of_date,
        createdAt: r.created_at,
        updatedAt: r.created_at,
      };
    });
  }

  async listLiabilitiesByUser(scopeId: string): Promise<Result<readonly LiabilityDto[]>> {
    try {
      const rows = this.db
        .prepare<LiabilityRow>('SELECT * FROM liabilities WHERE user_id = ? ORDER BY created_at DESC;')
        .all(scopeId);

      return ok(this.mapLiabilities(rows));
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async listLiabilitiesByHousehold(householdId: string): Promise<Result<readonly LiabilityDto[]>> {
    if (!isHouseholdScope(this.db, householdId)) {
      return this.listLiabilitiesByUser(householdId);
    }
    try {
      const rows = this.db
        .prepare<LiabilityRow>(
          'SELECT * FROM liabilities WHERE household_id = ? ORDER BY created_at DESC;'
        )
        .all(householdId);

      return ok(this.mapLiabilities(rows));
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async getLiabilityById(id: string, scopeId: string): Promise<Result<LiabilityDto | null>> {
    try {
      const rows = this.db
        .prepare<LiabilityRow>(
          'SELECT * FROM liabilities WHERE id = ? AND (user_id = ? OR household_id = ?);'
        )
        .all(id, scopeId, scopeId);
      const mapped = this.mapLiabilities(rows);
      return ok(mapped[0] || null);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  private writeLiabilityPartiesInternal(
    liabilityId: string,
    householdId: string | null,
    parties: readonly LiabilityPartyShareInput[],
    syncPrimaryMember: boolean = true
  ): void {
    this.db.prepare('DELETE FROM liability_parties WHERE liability_id = ?;').run(liabilityId);

    for (const p of parties) {
      this.db
        .prepare(
          `INSERT INTO liability_parties (id, household_id, liability_id, family_member_id, party_role, liability_share)
           VALUES (?, ?, ?, ?, ?, ?);`
        )
        .run(
          generateId('lp'),
          householdId,
          liabilityId,
          p.familyMemberId,
          p.partyRole,
          p.liabilityShare
        );
    }

    if (syncPrimaryMember) {
      const primaryId =
        parties.find((p) => p.partyRole === 'primary_borrower')?.familyMemberId ??
        parties[0]?.familyMemberId ??
        null;
      this.db
        .prepare('UPDATE liabilities SET member_id = ? WHERE id = ?;')
        .run(primaryId, liabilityId);
    }
  }

  async setLiabilityParties(
    liabilityId: string,
    parties: readonly LiabilityPartyShareInput[]
  ): Promise<Result<void>> {
    try {
      const validation = validateOwnershipShares(
        parties.map((p) => ({
          familyMemberId: p.familyMemberId,
          sharePercentage: p.liabilityShare,
          isPrimary: p.partyRole === 'primary_borrower',
        }))
      );
      if (!validation.valid) {
        return err(new Error(validation.error ?? 'Invalid liability party shares.'));
      }

      const row = this.db
        .prepare<{ household_id?: string | null }>(
          'SELECT household_id FROM liabilities WHERE id = ?;'
        )
        .get(liabilityId);

      this.writeLiabilityPartiesInternal(liabilityId, row?.household_id ?? null, parties, true);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async createLiability(params: CreateLiabilityParams): Promise<Result<LiabilityDto>> {
    try {
      const resolvedParties: LiabilityPartyShareInput[] | undefined =
        params.parties && params.parties.length > 0
          ? [...params.parties]
          : params.memberId
            ? [
                {
                  familyMemberId: params.memberId,
                  partyRole: 'primary_borrower',
                  liabilityShare: 100,
                },
              ]
            : undefined;

      if (resolvedParties && resolvedParties.length > 0) {
        const validation = validateOwnershipShares(
          resolvedParties.map((p) => ({
            familyMemberId: p.familyMemberId,
            sharePercentage: p.liabilityShare,
            isPrimary: p.partyRole === 'primary_borrower',
          }))
        );
        if (!validation.valid) {
          return err(new Error(validation.error ?? 'Invalid liability party shares.'));
        }
      }

      const primaryMemberId =
        resolvedParties?.find((p) => p.partyRole === 'primary_borrower')?.familyMemberId ??
        resolvedParties?.[0]?.familyMemberId ??
        params.memberId ??
        null;

      if (params.householdId) {
        this.db
          .prepare('INSERT OR IGNORE INTO profiles (id, display_name) VALUES (?, ?);')
          .run(params.userId, 'User');
        this.db
          .prepare('INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, ?, ?);')
          .run(params.householdId, 'My Household', params.userId);
      }

      const id = generateId('lia');
      const visibility = params.visibility ?? 'household_shared';

      this.db
        .prepare(
          `INSERT INTO liabilities (
             id, user_id, name, loan_type, lender, account_number, original_principal_paise,
             interest_rate, interest_type, tenure_months, emi_amount_paise, currency,
             start_date, end_date, status, linked_asset_id, member_id, notes,
             household_id, visibility, created_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
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
          primaryMemberId,
          params.notes ?? null,
          params.householdId ?? null,
          visibility,
          params.userId
        );

      if (resolvedParties && resolvedParties.length > 0) {
        this.writeLiabilityPartiesInternal(id, params.householdId ?? null, resolvedParties, false);
      }

      if (params.initialBalanceCents !== undefined) {
        await this.recordLiabilityBalance({
          liabilityId: id,
          userId: params.userId,
          householdId: params.householdId,
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
             original_principal_paise = COALESCE(?, original_principal_paise),
             interest_rate = COALESCE(?, interest_rate),
             interest_type = COALESCE(?, interest_type),
             tenure_months = COALESCE(?, tenure_months),
             emi_amount_paise = COALESCE(?, emi_amount_paise),
             start_date = COALESCE(?, start_date),
             end_date = COALESCE(?, end_date),
             status = COALESCE(?, status),
             linked_asset_id = COALESCE(?, linked_asset_id),
             member_id = COALESCE(?, member_id),
             notes = COALESCE(?, notes)
           WHERE id = ? AND (user_id = ? OR household_id = ?);`
        )
        .run(
          params.name ?? null,
          params.loanType ?? null,
          params.lender ?? null,
          params.accountNumber ?? null,
          params.originalPrincipalCents !== undefined
            ? Number(params.originalPrincipalCents)
            : null,
          params.interestRate ?? null,
          params.interestType ?? null,
          params.tenureMonths ?? null,
          params.emiAmountCents !== undefined ? Number(params.emiAmountCents) : null,
          params.startDate ?? null,
          params.endDate ?? null,
          params.status ?? null,
          params.linkedAssetId !== undefined ? params.linkedAssetId : null,
          params.memberId ?? null,
          params.notes ?? null,
          params.id,
          params.userId,
          params.householdId ?? params.userId
        );

      if (params.currentBalanceCents !== undefined) {
        const todayIso = new Date().toISOString().split('T')[0]!;
        const latestBal = this.db
          .prepare<{ as_of_date: string }>(
            'SELECT as_of_date FROM liability_balances WHERE liability_id = ? ORDER BY as_of_date DESC LIMIT 1;'
          )
          .get(params.id);
        const asOfDate =
          latestBal?.as_of_date && latestBal.as_of_date > todayIso ? latestBal.as_of_date : todayIso;
        const balRes = await this.recordLiabilityBalance({
          liabilityId: params.id,
          userId: params.userId,
          householdId: params.householdId,
          balanceCents: params.currentBalanceCents,
          asOfDate,
          source: 'manual',
          notes: 'Updated via Edit Loan / Part-payment',
        });
        if (!balRes.success) return err(balRes.error);
      }

      if (params.visibility) {
        this.db
          .prepare('UPDATE liabilities SET visibility = ? WHERE id = ?;')
          .run(params.visibility, params.id);
      }

      if (params.parties && params.parties.length > 0) {
        const partyRes = await this.setLiabilityParties(params.id, params.parties);
        if (!partyRes.success) return partyRes;
      }

      const res = await this.getLiabilityById(params.id, params.householdId ?? params.userId);
      if (!res.success || !res.value) return err(new Error('Failed to retrieve updated liability'));
      return ok(res.value);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async deleteLiability(id: string, scopeId: string): Promise<Result<void>> {
    try {
      this.db
        .prepare('DELETE FROM liabilities WHERE id = ? AND (user_id = ? OR household_id = ?);')
        .run(id, scopeId, scopeId);
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
          `INSERT INTO liability_balances (id, user_id, liability_id, balance_paise, as_of_date, source, notes, household_id, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          params.notes ?? null,
          params.householdId ?? null,
          params.userId
        );

      return ok({
        id,
        householdId: params.householdId,
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
    scopeId: string
  ): Promise<Result<readonly LiabilityBalanceDto[]>> {
    try {
      const rows = this.db
        .prepare<{
          id: string;
          household_id?: string | null;
          liability_id: string;
          user_id: string;
          balance_paise: number;
          as_of_date: string;
          source: string;
          notes?: string;
          created_at: string;
        }>(
          'SELECT * FROM liability_balances WHERE liability_id = ? AND (user_id = ? OR household_id = ?) ORDER BY as_of_date DESC;'
        )
        .all(liabilityId, scopeId, scopeId);

      const mapped: LiabilityBalanceDto[] = rows.map((r) => ({
        id: r.id,
        householdId: r.household_id || undefined,
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
          `INSERT INTO asset_valuations (id, user_id, asset_id, valuation_paise, currency, as_of_date, source, notes, household_id, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          params.notes ?? null,
          params.householdId ?? null,
          params.userId
        );

      return ok({
        id,
        householdId: params.householdId,
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
    scopeId: string
  ): Promise<Result<readonly AssetValuationDto[]>> {
    try {
      const rows = this.db
        .prepare<{
          id: string;
          household_id?: string | null;
          asset_id: string;
          user_id: string;
          valuation_paise: number;
          currency: string;
          as_of_date: string;
          source: string;
          notes?: string;
          created_at: string;
        }>(
          'SELECT * FROM asset_valuations WHERE asset_id = ? AND (user_id = ? OR household_id = ?) ORDER BY as_of_date DESC;'
        )
        .all(assetId, scopeId, scopeId);

      const mapped: AssetValuationDto[] = rows.map((r) => ({
        id: r.id,
        householdId: r.household_id || undefined,
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

  async listAssetLiabilityLinks(
    scopeId: string
  ): Promise<Result<readonly AssetLiabilityLinkDto[]>> {
    try {
      const rows = this.db
        .prepare<{
          id: string;
          household_id?: string | null;
          user_id: string;
          asset_id: string;
          liability_id: string;
          link_type: string;
          ownership_share_percentage: number;
          created_at: string;
        }>('SELECT * FROM asset_liability_links WHERE user_id = ? OR household_id = ?;')
        .all(scopeId, scopeId);

      const mapped: AssetLiabilityLinkDto[] = rows.map((r) => ({
        id: r.id,
        householdId: r.household_id || undefined,
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
    householdId?: string;
  }): Promise<Result<void>> {
    try {
      const id = generateId('all');
      this.db
        .prepare(
          `INSERT INTO asset_liability_links (id, user_id, asset_id, liability_id, link_type, ownership_share_percentage, household_id, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
          params.ownershipSharePercentage ?? 100.0,
          params.householdId ?? null,
          params.userId
        );

      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async unlinkAssetLiability(
    scopeId: string,
    assetId: string,
    liabilityId: string
  ): Promise<Result<void>> {
    try {
      this.db
        .prepare(
          'DELETE FROM asset_liability_links WHERE (user_id = ? OR household_id = ?) AND asset_id = ? AND liability_id = ?;'
        )
        .run(scopeId, scopeId, assetId, liabilityId);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}
