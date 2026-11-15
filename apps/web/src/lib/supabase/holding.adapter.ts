import { Result, ok, err } from '@wealthnest/shared';
import { HoldingOwnerShareInput, RecordVisibility } from '@wealthnest/domain';
import {
  HoldingRepositoryPort,
  HoldingDetailDto,
  CreateHoldingParams,
  UpdateHoldingValuesParams,
} from '@wealthnest/application';
import { supabase } from './client';
import { toValidUuidOrNull } from './uuid-utils';
import { resolveHouseholdIdForWrite, syncRestrictedRecordGrants } from './household-scope';

interface JoinedHoldingOwnerRow {
  family_member_id: string;
  ownership_share: number | string;
  is_primary_owner: boolean;
}

interface JoinedHoldingQueryRow {
  id: string;
  household_id: string;
  visibility: RecordVisibility;
  created_by: string | null;
  quantity: number | string;
  unit_cost_cents: number | string;
  current_value_cents: number | string;
  updated_at: string;
  demat_account_id: string | null;
  folio_number: string | null;
  amc_name: string | null;
  scheme_plan: string | null;
  cost_basis_verified: boolean | null;
  member_id: string | null;
  account_id: string | null;
  holding_owners?: JoinedHoldingOwnerRow[] | null;
  assets: {
    id: string;
    name: string;
    ticker: string | null;
    isin: string | null;
    currency: string;
    asset_class_id: string;
    amc_name: string | null;
    asset_classes: {
      id: string;
      name: string;
      color_hex: string;
    } | null;
  } | null;
}

export class SupabaseHoldingAdapter implements HoldingRepositoryPort {
  async listDetailsByHousehold(householdId: string): Promise<Result<HoldingDetailDto[]>> {
    try {
      const validHouseholdId = toValidUuidOrNull(householdId);
      if (!validHouseholdId) {
        return ok([]);
      }

      const { data, error } = await supabase
        .from('holdings')
        .select(
          `
          id,
          household_id,
          visibility,
          created_by,
          quantity,
          unit_cost_cents,
          current_value_cents,
          updated_at,
          demat_account_id,
          folio_number,
          amc_name,
          scheme_plan,
          cost_basis_verified,
          member_id,
          account_id,
          holding_owners (
            family_member_id,
            ownership_share,
            is_primary_owner
          ),
          assets (
            id,
            name,
            ticker,
            isin,
            currency,
            asset_class_id,
            amc_name,
            asset_classes (
              id,
              name,
              color_hex
            )
          )
        `
        )
        .eq('household_id', validHouseholdId)
        .order('current_value_cents', { ascending: false });

      if (error) {
        return err(new Error(error.message));
      }

      const rows = (data || []) as unknown as JoinedHoldingQueryRow[];
      const mapped: HoldingDetailDto[] = [];

      for (const row of rows) {
        if (!row.assets) continue;

        const assetClass = row.assets.asset_classes;
        const owners: HoldingOwnerShareInput[] | undefined =
          row.holding_owners && row.holding_owners.length > 0
            ? row.holding_owners.map((o) => ({
                familyMemberId: o.family_member_id,
                ownershipShare: Number(o.ownership_share),
                isPrimaryOwner: Boolean(o.is_primary_owner),
              }))
            : undefined;

        mapped.push({
          holdingId: row.id,
          assetId: row.assets.id,
          householdId: row.household_id,
          visibility: row.visibility,
          createdBy: row.created_by ?? undefined,
          name: row.assets.name,
          ticker: row.assets.ticker ?? undefined,
          isin: row.assets.isin ?? undefined,
          assetClassId: row.assets.asset_class_id,
          assetClassName: assetClass?.name ?? 'Unknown',
          assetClassColor: assetClass?.color_hex ?? '#94a3b8',
          quantity: Number(row.quantity),
          unitCostCents: Number(row.unit_cost_cents),
          currentValueCents: Number(row.current_value_cents),
          currency: row.assets.currency,
          updatedAt: row.updated_at,
          dematAccountId: row.demat_account_id ?? undefined,
          folioNumber: row.folio_number ?? undefined,
          amcName: row.amc_name ?? row.assets.amc_name ?? undefined,
          schemePlan: row.scheme_plan ?? undefined,
          costBasisVerified: Boolean(row.cost_basis_verified),
          memberId: row.member_id ?? undefined,
          accountId: row.account_id ?? undefined,
          owners,
        });
      }

      return ok(mapped);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async listDetailsByUser(scopeId: string): Promise<Result<HoldingDetailDto[]>> {
    return this.listDetailsByHousehold(scopeId);
  }

  async setHoldingOwners(
    holdingId: string,
    owners: readonly HoldingOwnerShareInput[]
  ): Promise<Result<void>> {
    try {
      const payload = owners.map((o) => ({
        family_member_id: o.familyMemberId,
        ownership_share: o.ownershipShare,
        is_primary_owner: Boolean(o.isPrimaryOwner),
      }));

      const { error } = await supabase.rpc('set_holding_owners', {
        p_holding_id: holdingId,
        p_owners: payload,
      });

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async createHoldingWithAsset(params: CreateHoldingParams): Promise<Result<HoldingDetailDto>> {
    try {
      const householdId = await resolveHouseholdIdForWrite(params.householdId, params.userId);
      const visibility: RecordVisibility = params.visibility ?? 'household_shared';
      const actorId = toValidUuidOrNull(params.userId);
      const validMemberId = toValidUuidOrNull(params.memberId);
      const primaryOwnerId =
        params.ownerShares?.find((o) => o.isPrimaryOwner)?.familyMemberId ??
        params.ownerShares?.[0]?.familyMemberId ??
        validMemberId ??
        undefined;

      // 1. Insert into assets table
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .insert({
          household_id: householdId,
          visibility,
          ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
          name: params.name,
          ticker: params.ticker ? params.ticker.toUpperCase() : null,
          isin: params.isin || null,
          asset_class_id: params.assetClassId,
          amc_name: params.amcName || null,
          currency: params.currency,
        })
        .select('id')
        .single();

      if (assetError || !assetData) {
        return err(new Error(`Failed to create asset: ${assetError?.message || 'Unknown error'}`));
      }

      const assetId = assetData.id;

      // 2. Insert into holdings table
      const { data: holdingData, error: holdingError } = await supabase
        .from('holdings')
        .insert({
          household_id: householdId,
          visibility,
          ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
          asset_id: assetId,
          quantity: params.quantity,
          unit_cost_cents: params.unitCostCents,
          current_value_cents: params.currentValueCents,
          demat_account_id: params.dematAccountId || null,
          folio_number: params.folioNumber || null,
          amc_name: params.amcName || null,
          scheme_plan: params.schemePlan || null,
          cost_basis_verified: Boolean(params.costBasisVerified),
          member_id: toValidUuidOrNull(primaryOwnerId),
          account_id: toValidUuidOrNull(params.accountId),
        })
        .select('id, updated_at')
        .single();

      if (holdingError || !holdingData) {
        return err(
          new Error(`Failed to create holding: ${holdingError?.message || 'Unknown error'}`)
        );
      }

      // 3. Persist joint ownership shares when provided (or single owner row when member is assigned)
      const normalizedOwners: HoldingOwnerShareInput[] | undefined =
        params.ownerShares && params.ownerShares.length > 0
          ? [...params.ownerShares]
          : validMemberId
            ? [{ familyMemberId: validMemberId, ownershipShare: 100, isPrimaryOwner: true }]
            : undefined;

      if (normalizedOwners && normalizedOwners.length > 0) {
        const ownersRes = await this.setHoldingOwners(holdingData.id, normalizedOwners);
        if (!ownersRes.success) {
          return err(ownersRes.error);
        }
      }

      // 4. Persist explicit restricted visibility grants on asset and holding if applicable
      if (visibility === 'restricted' && params.restrictedGranteeUserIds?.length) {
        await syncRestrictedRecordGrants({
          householdId,
          recordType: 'asset',
          recordId: assetId,
          visibility,
          granteeUserIds: params.restrictedGranteeUserIds,
        });
        await syncRestrictedRecordGrants({
          householdId,
          recordType: 'holding',
          recordId: holdingData.id,
          visibility,
          granteeUserIds: params.restrictedGranteeUserIds,
        });
      }

      // 5. Query asset class metadata for complete DTO
      const { data: classData } = await supabase
        .from('asset_classes')
        .select('name, color_hex')
        .eq('id', params.assetClassId)
        .single();

      const created: HoldingDetailDto = {
        holdingId: holdingData.id,
        assetId,
        householdId,
        visibility,
        createdBy: actorId ?? undefined,
        name: params.name,
        ticker: params.ticker ? params.ticker.toUpperCase() : undefined,
        isin: params.isin,
        assetClassId: params.assetClassId,
        assetClassName: classData?.name ?? params.assetClassId,
        assetClassColor: classData?.color_hex ?? '#3b82f6',
        quantity: params.quantity,
        unitCostCents: params.unitCostCents,
        currentValueCents: params.currentValueCents,
        currency: params.currency,
        updatedAt: holdingData.updated_at,
        dematAccountId: params.dematAccountId,
        folioNumber: params.folioNumber,
        amcName: params.amcName,
        schemePlan: params.schemePlan,
        costBasisVerified: params.costBasisVerified,
        memberId: primaryOwnerId,
        accountId: params.accountId,
        owners: normalizedOwners,
      };

      return ok(created);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async deleteHolding(holdingId: string, _scopeId: string): Promise<Result<void>> {
    try {
      if (holdingId.startsWith('demo-')) {
        return ok(undefined);
      }

      const { data: holding } = await supabase
        .from('holdings')
        .select('asset_id')
        .eq('id', holdingId)
        .maybeSingle();

      const { error: deleteHoldingError } = await supabase
        .from('holdings')
        .delete()
        .eq('id', holdingId);

      if (deleteHoldingError) {
        return err(new Error(deleteHoldingError.message));
      }

      if (holding?.asset_id) {
        try {
          await supabase.from('assets').delete().eq('id', holding.asset_id);
        } catch {
          // Non-blocking asset cleanup if shared with another holding
        }
      }

      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async updateHoldingValues(params: UpdateHoldingValuesParams): Promise<Result<void>> {
    try {
      if (params.holdingId.startsWith('demo-')) {
        return ok(undefined);
      }

      const updates: Record<string, unknown> = {
        quantity: params.quantity,
        unit_cost_cents: params.unitCostCents,
        current_value_cents: params.currentValueCents,
        updated_at: new Date().toISOString(),
      };
      if (params.visibility !== undefined) {
        updates.visibility = params.visibility;
      }

      const { error } = await supabase
        .from('holdings')
        .update(updates)
        .eq('id', params.holdingId);

      if (error) {
        return err(new Error(error.message));
      }

      if (params.ownerShares && params.ownerShares.length > 0) {
        const ownersRes = await this.setHoldingOwners(params.holdingId, params.ownerShares);
        if (!ownersRes.success) {
          return err(ownersRes.error);
        }
      }

      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
