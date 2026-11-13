import { Result, ok, err } from '@wealthnest/shared';
import {
  LiabilityBalanceDto,
  AssetValuationDto,
  AssetLiabilityLinkDto,
  RecordLiabilityBalanceParams,
  RecordAssetValuationParams,
} from '@wealthnest/application';
import { supabase } from './client';

export async function recordLiabilityBalance(
  params: RecordLiabilityBalanceParams
): Promise<Result<LiabilityBalanceDto>> {
  try {
    const { data, error } = await supabase
      .from('liability_balances')
      .upsert(
        {
          liability_id: params.liabilityId,
          user_id: params.userId,
          balance_cents: Number(params.balanceCents),
          as_of_date: params.asOfDate,
          source: params.source || 'manual',
          notes: params.notes || null,
        },
        { onConflict: 'liability_id, as_of_date' }
      )
      .select()
      .single();

    if (error || !data) {
      return err(
        new Error(`Failed to record liability balance: ${error?.message || 'Unknown error'}`)
      );
    }

    return ok({
      id: data.id,
      liabilityId: data.liability_id,
      userId: data.user_id,
      balanceCents: BigInt(Math.round(Number(data.balance_cents))),
      asOfDate: data.as_of_date,
      source: data.source,
      notes: data.notes || undefined,
      createdAt: data.created_at,
    });
  } catch (e: any) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

export async function listLiabilityBalances(
  liabilityId: string,
  userId: string
): Promise<Result<readonly LiabilityBalanceDto[]>> {
  try {
    const { data, error } = await supabase
      .from('liability_balances')
      .select('*')
      .eq('liability_id', liabilityId)
      .eq('user_id', userId)
      .order('as_of_date', { ascending: false });

    if (error) {
      return err(new Error(`Failed to list liability balances: ${error.message}`));
    }

    const balances: LiabilityBalanceDto[] = (data || []).map((b) => ({
      id: b.id,
      liabilityId: b.liability_id,
      userId: b.user_id,
      balanceCents: BigInt(Math.round(Number(b.balance_cents))),
      asOfDate: b.as_of_date,
      source: b.source,
      notes: b.notes || undefined,
      createdAt: b.created_at,
    }));

    return ok(balances);
  } catch (e: any) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

export async function recordAssetValuation(
  params: RecordAssetValuationParams
): Promise<Result<AssetValuationDto>> {
  try {
    const { data, error } = await supabase
      .from('asset_valuations')
      .upsert(
        {
          asset_id: params.assetId,
          user_id: params.userId,
          valuation_cents: Number(params.valuationCents),
          currency: params.currency || 'INR',
          as_of_date: params.asOfDate,
          source: params.source || 'manual_appraisal',
          notes: params.notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, asset_id, as_of_date' }
      )
      .select()
      .single();

    if (error || !data) {
      return err(
        new Error(`Failed to record asset valuation: ${error?.message || 'Unknown error'}`)
      );
    }

    // Also update holdings current_value_cents if this valuation is current/latest
    await supabase
      .from('holdings')
      .update({
        current_value_cents: Number(params.valuationCents),
        updated_at: new Date().toISOString(),
      })
      .eq('asset_id', params.assetId)
      .eq('user_id', params.userId);

    return ok({
      id: data.id,
      assetId: data.asset_id,
      userId: data.user_id,
      valuationCents: BigInt(Math.round(Number(data.valuation_cents))),
      currency: data.currency,
      asOfDate: data.as_of_date,
      source: data.source,
      notes: data.notes || undefined,
      createdAt: data.created_at,
    });
  } catch (e: any) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

export async function listAssetValuations(
  assetId: string,
  userId: string
): Promise<Result<readonly AssetValuationDto[]>> {
  try {
    const { data, error } = await supabase
      .from('asset_valuations')
      .select('*')
      .eq('asset_id', assetId)
      .eq('user_id', userId)
      .order('as_of_date', { ascending: false });

    if (error) {
      return err(new Error(`Failed to list asset valuations: ${error.message}`));
    }

    const valuations: AssetValuationDto[] = (data || []).map((v) => ({
      id: v.id,
      assetId: v.asset_id,
      userId: v.user_id,
      valuationCents: BigInt(Math.round(Number(v.valuation_cents))),
      currency: v.currency,
      asOfDate: v.as_of_date,
      source: v.source,
      notes: v.notes || undefined,
      createdAt: v.created_at,
    }));

    return ok(valuations);
  } catch (e: any) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

export async function listAssetLiabilityLinks(
  userId: string
): Promise<Result<readonly AssetLiabilityLinkDto[]>> {
  try {
    const { data, error } = await supabase
      .from('asset_liability_links')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      return err(new Error(`Failed to list asset liability links: ${error.message}`));
    }

    const links: AssetLiabilityLinkDto[] = (data || []).map((l) => ({
      id: l.id,
      userId: l.user_id,
      assetId: l.asset_id,
      liabilityId: l.liability_id,
      linkType: l.link_type as any,
      ownershipSharePercentage: Number(l.ownership_share_percentage) || 100,
      createdAt: l.created_at,
    }));

    return ok(links);
  } catch (e: any) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

export async function linkAssetLiability(params: {
  userId: string;
  assetId: string;
  liabilityId: string;
  linkType?: any;
  ownershipSharePercentage?: number;
}): Promise<Result<void>> {
  try {
    const { error } = await supabase.from('asset_liability_links').upsert(
      {
        user_id: params.userId,
        asset_id: params.assetId,
        liability_id: params.liabilityId,
        link_type: params.linkType || 'mortgage',
        ownership_share_percentage: params.ownershipSharePercentage || 100,
      },
      { onConflict: 'asset_id, liability_id' }
    );

    if (error) {
      return err(new Error(`Failed to link asset and liability: ${error.message}`));
    }
    return ok(undefined);
  } catch (e: any) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

export async function unlinkAssetLiability(
  userId: string,
  assetId: string,
  liabilityId: string
): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('asset_liability_links')
      .delete()
      .eq('user_id', userId)
      .eq('asset_id', assetId)
      .eq('liability_id', liabilityId);

    if (error) {
      return err(new Error(`Failed to unlink asset and liability: ${error.message}`));
    }
    return ok(undefined);
  } catch (e: any) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}
