import { Result, ok, err } from '@wealthnest/shared';
import {
  HoldingRepositoryPort,
  HoldingDetailDto,
  CreateHoldingParams,
} from '@wealthnest/application';
import { supabase } from './client';

interface JoinedHoldingQueryRow {
  id: string;
  quantity: number | string;
  unit_cost_cents: number | string;
  current_value_cents: number | string;
  updated_at: string;
  assets: {
    id: string;
    name: string;
    ticker: string | null;
    currency: string;
    asset_class_id: string;
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
        .select(`
          id,
          quantity,
          unit_cost_cents,
          current_value_cents,
          updated_at,
          assets (
            id,
            name,
            ticker,
            currency,
            asset_class_id,
            asset_classes (
              id,
              name,
              color_hex
            )
          )
        `)
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
          assetClassId: row.assets.asset_class_id,
          assetClassName: assetClass?.name ?? 'Unknown',
          assetClassColor: assetClass?.color_hex ?? '#94a3b8',
          quantity: Number(row.quantity),
          unitCostCents: Number(row.unit_cost_cents),
          currentValueCents: Number(row.current_value_cents),
          currency: row.assets.currency,
          updatedAt: row.updated_at,
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
          asset_class_id: params.assetClassId,
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
        assetClassId: params.assetClassId,
        assetClassName: classData?.name ?? params.assetClassId,
        assetClassColor: classData?.color_hex ?? '#3b82f6',
        quantity: params.quantity,
        unitCostCents: params.unitCostCents,
        currentValueCents: params.currentValueCents,
        currency: params.currency,
        updatedAt: holdingData.updated_at,
      };

      return ok(created);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async deleteHolding(holdingId: string, userId: string): Promise<Result<void>> {
    try {
      // Find asset ID to cascade delete
      const { data: holding } = await supabase
        .from('holdings')
        .select('asset_id')
        .eq('id', holdingId)
        .eq('user_id', userId)
        .single();

      const { error: deleteHoldingError } = await supabase
        .from('holdings')
        .delete()
        .eq('id', holdingId)
        .eq('user_id', userId);

      if (deleteHoldingError) {
        return err(new Error(deleteHoldingError.message));
      }

      if (holding?.asset_id) {
        await supabase
          .from('assets')
          .delete()
          .eq('id', holding.asset_id)
          .eq('user_id', userId);
      }

      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
