import { Result, ok, err } from '@wealthnest/shared';
import {
  HoldingRepositoryPort,
  HoldingDetailDto,
  CreateHoldingParams,
  UpdateHoldingValuesParams,
} from '@wealthnest/application';
import { supabase } from './client';

interface JoinedHoldingQueryRow {
  id: string;
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
  async listDetailsByUser(userId: string): Promise<Result<HoldingDetailDto[]>> {
    try {
      const { data, error } = await supabase
        .from('holdings')
        .select(
          `
          id,
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
        .eq('user_id', userId)
        .order('current_value_cents', { ascending: false });

      if (error) {
        return err(new Error(error.message));
      }

      const rows = (data || []) as unknown as JoinedHoldingQueryRow[];
      const mapped: HoldingDetailDto[] = [];

      for (const row of rows) {
        if (!row.assets) continue;

        const assetClass = row.assets.asset_classes;
        mapped.push({
          holdingId: row.id,
          assetId: row.assets.id,
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
        });
      }

      return ok(mapped);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async createHoldingWithAsset(params: CreateHoldingParams): Promise<Result<HoldingDetailDto>> {
    try {
      // 1. Insert into assets table
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .insert({
          user_id: params.userId,
          name: params.name,
          ticker: params.ticker ? params.ticker.toUpperCase() : null,
          isin: params.isin || null,
          asset_class_id: params.assetClassId,
          amc_name: params.amcName || null,
          currency: params.currency,
        })
        .select('id')
        .single();

      if (assetError) {
        return err(new Error(`Failed to create asset: ${assetError.message}`));
      }

      const assetId = assetData.id;

      // 2. Insert into holdings table
      const { data: holdingData, error: holdingError } = await supabase
        .from('holdings')
        .insert({
          user_id: params.userId,
          asset_id: assetId,
          quantity: params.quantity,
          unit_cost_cents: params.unitCostCents,
          current_value_cents: params.currentValueCents,
          demat_account_id: params.dematAccountId || null,
          folio_number: params.folioNumber || null,
          amc_name: params.amcName || null,
          scheme_plan: params.schemePlan || null,
          cost_basis_verified: Boolean(params.costBasisVerified),
          member_id: params.memberId || null,
          account_id: params.accountId || null,
        })
        .select('id, updated_at')
        .single();

      if (holdingError) {
        return err(new Error(`Failed to create holding: ${holdingError.message}`));
      }

      // 3. Query asset class metadata for complete DTO
      const { data: classData } = await supabase
        .from('asset_classes')
        .select('name, color_hex')
        .eq('id', params.assetClassId)
        .single();

      const created: HoldingDetailDto = {
        holdingId: holdingData.id,
        assetId,
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
        memberId: params.memberId,
        accountId: params.accountId,
      };

      return ok(created);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async deleteHolding(holdingId: string, userId: string): Promise<Result<void>> {
    try {
      // Demo holdings do not exist in PostgreSQL
      if (holdingId.startsWith('demo-')) {
        return ok(undefined);
      }

      // Find asset ID to cascade delete
      const { data: holding } = await supabase
        .from('holdings')
        .select('asset_id')
        .eq('id', holdingId)
        .eq('user_id', userId)
        .maybeSingle();

      const { error: deleteHoldingError } = await supabase
        .from('holdings')
        .delete()
        .eq('id', holdingId)
        .eq('user_id', userId);

      if (deleteHoldingError) {
        return err(new Error(deleteHoldingError.message));
      }

      if (holding?.asset_id) {
        try {
          await supabase.from('assets').delete().eq('id', holding.asset_id).eq('user_id', userId);
        } catch {
          // Non-blocking asset cleanup
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

      const { error } = await supabase
        .from('holdings')
        .update({
          quantity: params.quantity,
          unit_cost_cents: params.unitCostCents,
          current_value_cents: params.currentValueCents,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.holdingId)
        .eq('user_id', params.userId);

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

