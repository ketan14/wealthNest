import { Result, ok, err } from '@wealthnest/shared';
import {
  LiabilityPartyRole,
  LiabilityPartyShareInput,
  RecordVisibility,
} from '@wealthnest/domain';
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
} from '@wealthnest/application';
import { supabase } from './client';
import { toValidUuidOrNull } from './uuid-utils';
import { resolveHouseholdIdForWrite, syncRestrictedRecordGrants } from './household-scope';
import {
  recordLiabilityBalance as recordLiabilityBalanceOp,
  listLiabilityBalances as listLiabilityBalancesOp,
  recordAssetValuation as recordAssetValuationOp,
  listAssetValuations as listAssetValuationsOp,
  listAssetLiabilityLinks as listAssetLiabilityLinksOp,
  linkAssetLiability as linkAssetLiabilityOp,
  unlinkAssetLiability as unlinkAssetLiabilityOp,
} from './liability-valuations-links';

interface JoinedLiabilityPartyRow {
  family_member_id: string;
  party_role: LiabilityPartyRole;
  liability_share: number | string;
}

interface JoinedLiabilityRow {
  id: string;
  household_id: string;
  visibility: RecordVisibility;
  created_by: string | null;
  name: string;
  loan_type: string;
  lender: string;
  account_number: string | null;
  original_principal_cents: string | number;
  interest_rate: string | number;
  interest_type: string;
  tenure_months: number | null;
  emi_amount_cents: string | number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  linked_asset_id: string | null;
  member_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  liability_parties?: JoinedLiabilityPartyRow[] | null;
  assets: {
    id: string;
    name: string;
  } | null;
}

function mapJoinedLiability(
  r: JoinedLiabilityRow,
  currentBalanceCents: bigint,
  lastBalanceDate?: string
): LiabilityDto {
  const parties: LiabilityPartyShareInput[] | undefined =
    r.liability_parties && r.liability_parties.length > 0
      ? r.liability_parties.map((p) => ({
          familyMemberId: p.family_member_id,
          partyRole: p.party_role,
          liabilityShare: Number(p.liability_share),
        }))
      : undefined;

  const coBorrowerIds = parties
    ?.filter((p) => p.partyRole === 'co_borrower')
    .map((p) => p.familyMemberId);

  return {
    id: r.id,
    householdId: r.household_id,
    userId: r.created_by || r.household_id,
    visibility: r.visibility,
    createdBy: r.created_by ?? undefined,
    name: r.name,
    loanType: r.loan_type as any,
    lender: r.lender,
    accountNumber: r.account_number || undefined,
    originalPrincipalCents: BigInt(Math.round(Number(r.original_principal_cents) || 0)),
    currentBalanceCents,
    interestRate: Number(r.interest_rate) || 0,
    interestType: (r.interest_type as any) || 'floating',
    tenureMonths: r.tenure_months || undefined,
    emiAmountCents: BigInt(Math.round(Number(r.emi_amount_cents) || 0)),
    currency: r.currency || 'INR',
    startDate: r.start_date || undefined,
    endDate: r.end_date || undefined,
    status: (r.status as any) || 'active',
    linkedAssetId: r.linked_asset_id || undefined,
    linkedAssetName: r.assets?.name || undefined,
    memberId:
      r.member_id ||
      parties?.find((p) => p.partyRole === 'primary_borrower')?.familyMemberId ||
      undefined,
    coBorrowerMemberIds: coBorrowerIds && coBorrowerIds.length > 0 ? coBorrowerIds : undefined,
    parties,
    notes: r.notes || undefined,
    lastBalanceDate,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function buildDefaultParties(
  primaryMemberId: string | null,
  coBorrowerMemberIds?: readonly string[]
): LiabilityPartyShareInput[] | undefined {
  if (!primaryMemberId) return undefined;
  const coIds = Array.from(
    new Set(
      (coBorrowerMemberIds || [])
        .map((id) => toValidUuidOrNull(id))
        .filter((id): id is string => id !== null && id !== primaryMemberId)
    )
  );
  const memberIds = [primaryMemberId, ...coIds];
  if (memberIds.length === 1) {
    return [{ familyMemberId: primaryMemberId, partyRole: 'primary_borrower', liabilityShare: 100 }];
  }

  const baseShare = Number((100 / memberIds.length).toFixed(2));
  const assignedRemainder = Number((100 - baseShare * (memberIds.length - 1)).toFixed(2));
  return memberIds.map((id, idx) => ({
    familyMemberId: id,
    partyRole: idx === 0 ? 'primary_borrower' : 'co_borrower',
    liabilityShare: idx === 0 ? assignedRemainder : baseShare,
  }));
}

export class SupabaseLiabilityAdapter implements LiabilityRepositoryPort {
  async listLiabilitiesByHousehold(householdId: string): Promise<Result<readonly LiabilityDto[]>> {
    try {
      const validHouseholdId = toValidUuidOrNull(householdId);
      if (!validHouseholdId) {
        return ok([]);
      }

      const { data, error } = await supabase
        .from('liabilities')
        .select(
          `
          id,
          household_id,
          visibility,
          created_by,
          name,
          loan_type,
          lender,
          account_number,
          original_principal_cents,
          interest_rate,
          interest_type,
          tenure_months,
          emi_amount_cents,
          currency,
          start_date,
          end_date,
          status,
          linked_asset_id,
          member_id,
          notes,
          created_at,
          updated_at,
          liability_parties (
            family_member_id,
            party_role,
            liability_share
          ),
          assets (
            id,
            name
          )
        `
        )
        .eq('household_id', validHouseholdId)
        .order('created_at', { ascending: false });

      if (error) {
        return err(new Error(`Failed to list liabilities: ${error.message}`));
      }

      const rows = (data || []) as unknown as JoinedLiabilityRow[];

      const { data: balanceData } = await supabase
        .from('liability_balances')
        .select('liability_id, balance_cents, as_of_date')
        .eq('household_id', validHouseholdId)
        .order('as_of_date', { ascending: false });

      const latestBalanceMap = new Map<string, { balanceCents: bigint; asOfDate: string }>();
      if (balanceData) {
        for (const b of balanceData) {
          if (!latestBalanceMap.has(b.liability_id)) {
            latestBalanceMap.set(b.liability_id, {
              balanceCents: BigInt(Math.round(Number(b.balance_cents) || 0)),
              asOfDate: b.as_of_date,
            });
          }
        }
      }

      const result: LiabilityDto[] = rows.map((r) => {
        const origPrincipal = BigInt(Math.round(Number(r.original_principal_cents) || 0));
        const latestBal = latestBalanceMap.get(r.id);
        return mapJoinedLiability(
          r,
          latestBal ? latestBal.balanceCents : origPrincipal,
          latestBal?.asOfDate
        );
      });

      return ok(result);
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async listLiabilitiesByUser(scopeId: string): Promise<Result<readonly LiabilityDto[]>> {
    return this.listLiabilitiesByHousehold(scopeId);
  }

  async getLiabilityById(id: string, _scopeId: string): Promise<Result<LiabilityDto | null>> {
    try {
      const { data, error } = await supabase
        .from('liabilities')
        .select(
          `
          id,
          household_id,
          visibility,
          created_by,
          name,
          loan_type,
          lender,
          account_number,
          original_principal_cents,
          interest_rate,
          interest_type,
          tenure_months,
          emi_amount_cents,
          currency,
          start_date,
          end_date,
          status,
          linked_asset_id,
          member_id,
          notes,
          created_at,
          updated_at,
          liability_parties (
            family_member_id,
            party_role,
            liability_share
          ),
          assets (
            id,
            name
          )
        `
        )
        .eq('id', id)
        .maybeSingle();

      if (error) {
        return err(new Error(`Failed to get liability: ${error.message}`));
      }
      if (!data) {
        return ok(null);
      }

      const r = data as unknown as JoinedLiabilityRow;
      const origPrincipal = BigInt(Math.round(Number(r.original_principal_cents) || 0));

      const { data: latestBalRow } = await supabase
        .from('liability_balances')
        .select('balance_cents, as_of_date')
        .eq('liability_id', id)
        .order('as_of_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentBalance = latestBalRow
        ? BigInt(Math.round(Number(latestBalRow.balance_cents) || 0))
        : origPrincipal;

      return ok(mapJoinedLiability(r, currentBalance, latestBalRow?.as_of_date));
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async setLiabilityParties(
    liabilityId: string,
    parties: readonly LiabilityPartyShareInput[]
  ): Promise<Result<void>> {
    try {
      const payload = parties.map((p) => ({
        family_member_id: p.familyMemberId,
        party_role: p.partyRole,
        liability_share: p.liabilityShare,
      }));

      const { error } = await supabase.rpc('set_liability_parties', {
        p_liability_id: liabilityId,
        p_parties: payload,
      });

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async createLiability(params: CreateLiabilityParams): Promise<Result<LiabilityDto>> {
    try {
      const householdId = await resolveHouseholdIdForWrite(params.householdId, params.userId);
      const visibility: RecordVisibility = params.visibility ?? 'household_shared';
      const actorId = toValidUuidOrNull(params.userId);
      const validMemberId = toValidUuidOrNull(params.memberId);

      const normalizedParties =
        params.parties && params.parties.length > 0
          ? [...params.parties]
          : buildDefaultParties(validMemberId, params.coBorrowerMemberIds);

      const primaryBorrowerId =
        normalizedParties?.find((p) => p.partyRole === 'primary_borrower')?.familyMemberId ??
        normalizedParties?.[0]?.familyMemberId ??
        validMemberId;

      const { data, error } = await supabase
        .from('liabilities')
        .insert({
          household_id: householdId,
          visibility,
          ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
          name: params.name,
          loan_type: params.loanType,
          lender: params.lender,
          account_number: params.accountNumber || null,
          original_principal_cents: Number(params.originalPrincipalCents),
          interest_rate: params.interestRate,
          interest_type: params.interestType || 'floating',
          tenure_months: params.tenureMonths || null,
          emi_amount_cents: Number(params.emiAmountCents || 0n),
          currency: params.currency || 'INR',
          start_date: params.startDate || null,
          end_date: params.endDate || null,
          status: params.status || 'active',
          linked_asset_id: toValidUuidOrNull(params.linkedAssetId),
          member_id: toValidUuidOrNull(primaryBorrowerId),
          notes: params.notes || null,
        })
        .select('*')
        .single();

      if (error || !data) {
        return err(new Error(`Failed to create liability: ${error?.message || 'Unknown error'}`));
      }

      if (normalizedParties && normalizedParties.length > 0) {
        const partiesRes = await this.setLiabilityParties(data.id, normalizedParties);
        if (!partiesRes.success) {
          return err(partiesRes.error);
        }
      }

      if (visibility === 'restricted' && params.restrictedGranteeUserIds?.length) {
        await syncRestrictedRecordGrants({
          householdId,
          recordType: 'liability',
          recordId: data.id,
          visibility,
          granteeUserIds: params.restrictedGranteeUserIds,
        });
      }

      return ok({
        id: data.id,
        householdId: data.household_id,
        userId: actorId ?? householdId,
        visibility,
        createdBy: actorId ?? undefined,
        name: data.name,
        loanType: data.loan_type as any,
        lender: data.lender,
        accountNumber: data.account_number || undefined,
        originalPrincipalCents: BigInt(Math.round(Number(data.original_principal_cents))),
        currentBalanceCents: BigInt(
          Math.round(Number(params.initialBalanceCents ?? data.original_principal_cents))
        ),
        interestRate: Number(data.interest_rate),
        interestType: data.interest_type as any,
        tenureMonths: data.tenure_months || undefined,
        emiAmountCents: BigInt(Math.round(Number(data.emi_amount_cents))),
        currency: data.currency,
        startDate: data.start_date || undefined,
        endDate: data.end_date || undefined,
        status: data.status as any,
        linkedAssetId: data.linked_asset_id || undefined,
        memberId: primaryBorrowerId || undefined,
        coBorrowerMemberIds: normalizedParties
          ?.filter((p) => p.partyRole === 'co_borrower')
          .map((p) => p.familyMemberId),
        parties: normalizedParties,
        notes: data.notes || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async updateLiability(params: UpdateLiabilityParams): Promise<Result<LiabilityDto>> {
    try {
      const actorId = toValidUuidOrNull(params.userId);
      const updateData: Record<string, any> = {
        ...(actorId ? { updated_by: actorId } : {}),
        updated_at: new Date().toISOString(),
      };

      if (params.name !== undefined) updateData.name = params.name;
      if (params.loanType !== undefined) updateData.loan_type = params.loanType;
      if (params.lender !== undefined) updateData.lender = params.lender;
      if (params.accountNumber !== undefined) updateData.account_number = params.accountNumber;
      if (params.originalPrincipalCents !== undefined)
        updateData.original_principal_cents = Number(params.originalPrincipalCents);
      if (params.interestRate !== undefined) updateData.interest_rate = params.interestRate;
      if (params.interestType !== undefined) updateData.interest_type = params.interestType;
      if (params.tenureMonths !== undefined) updateData.tenure_months = params.tenureMonths;
      if (params.emiAmountCents !== undefined)
        updateData.emi_amount_cents = Number(params.emiAmountCents);
      if (params.startDate !== undefined) updateData.start_date = params.startDate || null;
      if (params.endDate !== undefined) updateData.end_date = params.endDate || null;
      if (params.status !== undefined) updateData.status = params.status;
      if (params.linkedAssetId !== undefined)
        updateData.linked_asset_id = toValidUuidOrNull(params.linkedAssetId);
      if (params.memberId !== undefined) updateData.member_id = toValidUuidOrNull(params.memberId);
      if (params.notes !== undefined) updateData.notes = params.notes;
      if (params.visibility !== undefined) updateData.visibility = params.visibility;

      const { data, error } = await supabase
        .from('liabilities')
        .update(updateData)
        .eq('id', params.id)
        .select('id')
        .single();

      if (error || !data) {
        return err(new Error(`Failed to update liability: ${error?.message || 'Unknown error'}`));
      }

      if (params.currentBalanceCents !== undefined) {
        const todayIso = new Date().toISOString().split('T')[0]!;
        const { data: latestRow } = await supabase
          .from('liability_balances')
          .select('as_of_date')
          .eq('liability_id', data.id)
          .order('as_of_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        const latestDate = latestRow?.as_of_date ? String(latestRow.as_of_date) : '';
        const asOfDate = latestDate > todayIso ? latestDate : todayIso;

        const balRes = await this.recordLiabilityBalance({
          liabilityId: data.id,
          householdId: params.householdId,
          userId: params.userId,
          balanceCents: params.currentBalanceCents,
          asOfDate,
          source: 'manual',
          notes: 'Updated via Edit Loan / Part-payment',
        });
        if (!balRes.success) {
          return err(balRes.error);
        }
      }

      if (params.parties && params.parties.length > 0) {
        const partiesRes = await this.setLiabilityParties(data.id, params.parties);
        if (!partiesRes.success) {
          return err(partiesRes.error);
        }
      }

      const refreshed = await this.getLiabilityById(data.id, params.householdId || params.userId);
      if (!refreshed.success) {
        return err(refreshed.error);
      }
      if (!refreshed.value) {
        return err(new Error('Updated liability could not be reloaded'));
      }
      return ok(refreshed.value);
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async deleteLiability(id: string, _scopeId: string): Promise<Result<void>> {
    try {
      const { error } = await supabase.from('liabilities').delete().eq('id', id);

      if (error) {
        return err(new Error(`Failed to delete liability: ${error.message}`));
      }
      return ok(undefined);
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async recordLiabilityBalance(
    params: RecordLiabilityBalanceParams
  ): Promise<Result<LiabilityBalanceDto>> {
    return recordLiabilityBalanceOp(params);
  }

  async recordEmiPaymentAtomic(params: {
    readonly liabilityId: string;
    readonly paymentDate: string;
    readonly totalAmountCents: bigint;
    readonly principalCents: bigint;
    readonly interestCents: bigint;
    readonly extraPaymentCents?: bigint;
    readonly newBalanceCents?: bigint;
    readonly notes?: string;
  }): Promise<
    Result<{
      readonly success: boolean;
      readonly paymentId: string;
      readonly balanceId: string;
      readonly remainingBalanceCents: bigint;
      readonly status: string;
    }>
  > {
    try {
      const { data, error } = await supabase.rpc('record_emi_payment_atomic', {
        p_liability_id: params.liabilityId,
        p_payment_date: params.paymentDate,
        p_total_amount_cents: Number(params.totalAmountCents),
        p_principal_cents: Number(params.principalCents),
        p_interest_cents: Number(params.interestCents),
        p_extra_payment_cents: Number(params.extraPaymentCents || 0n),
        p_new_balance_cents:
          params.newBalanceCents !== undefined ? Number(params.newBalanceCents) : null,
        p_notes: params.notes || null,
      });

      if (error || !data) {
        return err(
          new Error(`Failed to record atomic EMI payment: ${error?.message || 'Unknown error'}`)
        );
      }

      return ok({
        success: Boolean(data.success),
        paymentId: data.payment_id,
        balanceId: data.balance_id,
        remainingBalanceCents: BigInt(data.remaining_balance_cents ?? 0),
        status: data.status,
      });
    } catch (e: any) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async listLiabilityBalances(
    liabilityId: string,
    scopeId: string
  ): Promise<Result<readonly LiabilityBalanceDto[]>> {
    return listLiabilityBalancesOp(liabilityId, scopeId);
  }

  async recordAssetValuation(
    params: RecordAssetValuationParams
  ): Promise<Result<AssetValuationDto>> {
    return recordAssetValuationOp(params);
  }

  async listAssetValuations(
    assetId: string,
    scopeId: string
  ): Promise<Result<readonly AssetValuationDto[]>> {
    return listAssetValuationsOp(assetId, scopeId);
  }

  async listAssetLiabilityLinks(scopeId: string): Promise<Result<readonly AssetLiabilityLinkDto[]>> {
    return listAssetLiabilityLinksOp(scopeId);
  }

  async linkAssetLiability(params: {
    userId: string;
    householdId?: string;
    assetId: string;
    liabilityId: string;
    linkType?: any;
    ownershipSharePercentage?: number;
  }): Promise<Result<void>> {
    return linkAssetLiabilityOp(params);
  }

  async unlinkAssetLiability(
    scopeId: string,
    assetId: string,
    liabilityId: string
  ): Promise<Result<void>> {
    return unlinkAssetLiabilityOp(scopeId, assetId, liabilityId);
  }
}
