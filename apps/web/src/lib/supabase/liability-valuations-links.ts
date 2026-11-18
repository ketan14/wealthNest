import { Result, ok, err } from '@wealthnest/shared';
import {
  LiabilityBalanceDto,
  AssetValuationDto,
  AssetLiabilityLinkDto,
  RecordLiabilityBalanceParams,
  RecordAssetValuationParams,
} from '@wealthnest/application';
import { supabase } from './client';
import { toValidUuidOrNull } from './uuid-utils';
import { resolveHouseholdIdForWrite } from './household-scope';

async function resolveEntityHouseholdId(
  explicitHouseholdId: string | undefined,
  table: 'liabilities' | 'assets',
  entityId: string,
  userId?: string
): Promise<string> {
  const direct = toValidUuidOrNull(explicitHouseholdId);
  if (direct) return direct;

  const validEntityId = toValidUuidOrNull(entityId);
  if (validEntityId) {
    const { data } = await supabase
      .from(table)
      .select('household_id')
      .eq('id', validEntityId)
      .maybeSingle();
    if (data?.household_id) {
      return String(data.household_id);
    }
  }

  return resolveHouseholdIdForWrite(undefined, userId);
}

export async function recordLiabilityBalance(
  params: RecordLiabilityBalanceParams
): Promise<Result<LiabilityBalanceDto>> {
  try {
    const householdId = await resolveEntityHouseholdId(
      params.householdId,
      'liabilities',
      params.liabilityId,
      params.userId
    );
    const actorId = toValidUuidOrNull(params.userId);

    const { data, error } = await supabase
      .from('liability_balances')
      .upsert(
        {
          household_id: householdId,
          liability_id: params.liabilityId,
          ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
          balance_cents: Number(params.balanceCents),
          as_of_date: params.asOfDate,
          source: params.source || 'manual',
          notes: params.notes || null,
        },
        { onConflict: 'liability_id, as_of_date' }
      )
      .select('*')
      .single();

    if (error || !data) {
      return err(
        new Error(`Failed to record liability balance: ${error?.message || 'Unknown error'}`)
      );
    }

    return ok({
      id: data.id,
      householdId: data.household_id,
      liabilityId: data.liability_id,
      userId: data.created_by || data.household_id,
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
  _scopeId: string
): Promise<Result<readonly LiabilityBalanceDto[]>> {
  try {
    const { data, error } = await supabase
      .from('liability_balances')
      .select('*')
      .eq('liability_id', liabilityId)
      .order('as_of_date', { ascending: false });

    if (error) {
      return err(new Error(`Failed to list liability balances: ${error.message}`));
    }

    const balances: LiabilityBalanceDto[] = (data || []).map((b) => ({
      id: b.id,
      householdId: b.household_id,
      liabilityId: b.liability_id,
      userId: b.created_by || b.household_id,
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
    const validAssetId = toValidUuidOrNull(params.assetId);

    // Call atomic RPC function record_asset_valuation_atomic (FIN-06)
    if (validAssetId) {
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        'record_asset_valuation_atomic',
        {
          p_asset_id: validAssetId,
          p_valuation_cents: Number(params.valuationCents),
          p_as_of_date: params.asOfDate,
          p_source: params.source || 'manual_appraisal',
          p_notes: params.notes || null,
        }
      );

      if (!rpcErr && rpcData?.success) {
        return ok({
          id: rpcData.valuation_id,
          householdId: params.householdId || '',
          assetId: validAssetId,
          userId: params.userId,
          valuationCents: params.valuationCents,
          currency: params.currency || 'INR',
          asOfDate: params.asOfDate,
          source: params.source || 'manual_appraisal',
          notes: params.notes,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const householdId = await resolveEntityHouseholdId(
      params.householdId,
      'assets',
      params.assetId,
      params.userId
    );
    const actorId = toValidUuidOrNull(params.userId);

    const { data, error } = await supabase
      .from('asset_valuations')
      .upsert(
        {
          household_id: householdId,
          asset_id: params.assetId,
          ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
          valuation_cents: Number(params.valuationCents),
          currency: params.currency || 'INR',
          as_of_date: params.asOfDate,
          source: params.source || 'manual_appraisal',
          notes: params.notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'asset_id, as_of_date' }
      )
      .select('*')
      .single();

    if (error || !data) {
      return err(
        new Error(`Failed to record asset valuation: ${error?.message || 'Unknown error'}`)
      );
    }

    await supabase
      .from('holdings')
      .update({
        current_value_cents: Number(params.valuationCents),
        ...(actorId ? { updated_by: actorId } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('asset_id', params.assetId)
      .eq('household_id', householdId);

    return ok({
      id: data.id,
      householdId: data.household_id,
      assetId: data.asset_id,
      userId: data.created_by || data.household_id,
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
  _scopeId: string
): Promise<Result<readonly AssetValuationDto[]>> {
  try {
    const { data, error } = await supabase
      .from('asset_valuations')
      .select('*')
      .eq('asset_id', assetId)
      .order('as_of_date', { ascending: false });

    if (error) {
      return err(new Error(`Failed to list asset valuations: ${error.message}`));
    }

    const valuations: AssetValuationDto[] = (data || []).map((v) => ({
      id: v.id,
      householdId: v.household_id,
      assetId: v.asset_id,
      userId: v.created_by || v.household_id,
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
  scopeId: string
): Promise<Result<readonly AssetLiabilityLinkDto[]>> {
  try {
    const validHouseholdId = toValidUuidOrNull(scopeId);
    if (!validHouseholdId) {
      return ok([]);
    }

    const { data, error } = await supabase
      .from('asset_liability_links')
      .select('*')
      .eq('household_id', validHouseholdId);

    if (error) {
      return err(new Error(`Failed to list asset liability links: ${error.message}`));
    }

    const links: AssetLiabilityLinkDto[] = (data || []).map((l) => ({
      id: l.id,
      householdId: l.household_id,
      userId: l.created_by || l.household_id,
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
  householdId?: string;
  assetId: string;
  liabilityId: string;
  linkType?: any;
  ownershipSharePercentage?: number;
}): Promise<Result<void>> {
  try {
    const householdId = await resolveEntityHouseholdId(
      params.householdId,
      'assets',
      params.assetId,
      params.userId
    );
    const actorId = toValidUuidOrNull(params.userId);

    const { error } = await supabase.from('asset_liability_links').upsert(
      {
        household_id: householdId,
        asset_id: params.assetId,
        liability_id: params.liabilityId,
        ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
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
  _scopeId: string,
  assetId: string,
  liabilityId: string
): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('asset_liability_links')
      .delete()
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
