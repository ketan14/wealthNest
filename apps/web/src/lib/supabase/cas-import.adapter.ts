import { Result, ok, err } from '@wealthnest/shared';
import {
  CasImportRepositoryPort,
  ConfirmCasImportParams,
} from '@wealthnest/application';
import { ImportSummaryResult } from '@wealthnest/domain';
import { supabase } from './client';

export class SupabaseCasImportAdapter implements CasImportRepositoryPort {
  async upsertHoldingsFromCas(params: ConfirmCasImportParams): Promise<Result<ImportSummaryResult>> {
    try {
      let imported = 0;
      let updated = 0;
      let failed = 0;

      for (const item of params.items) {
        try {
          // 1. Check if asset already exists for user (match by ISIN first, then fallback to name)
          let existingAssetId: string | null = null;

          if (item.isin) {
            const { data: assetByIsin } = await supabase
              .from('assets')
              .select('id')
              .eq('user_id', params.userId)
              .eq('isin', item.isin)
              .maybeSingle();

            if (assetByIsin) {
              existingAssetId = assetByIsin.id;
            }
          }

          if (!existingAssetId) {
            const { data: assetByName } = await supabase
              .from('assets')
              .select('id')
              .eq('user_id', params.userId)
              .ilike('name', item.name)
              .maybeSingle();

            if (assetByName) {
              existingAssetId = assetByName.id;
              // If found by name but missing ISIN, backfill the ISIN
              if (item.isin) {
                await supabase.from('assets').update({ isin: item.isin }).eq('id', existingAssetId);
              }
            }
          }

          // 2. If asset does not exist, create asset record
          if (!existingAssetId) {
            const { data: newAsset, error: assetErr } = await supabase
              .from('assets')
              .insert({
                user_id: params.userId,
                name: item.name,
                ticker: item.ticker || null,
                isin: item.isin || null,
                asset_class_id: item.assetClassId,
                currency: item.currency || 'INR',
              })
              .select('id')
              .single();

            if (assetErr || !newAsset) {
              failed++;
              continue;
            }
            existingAssetId = newAsset.id;
          }

          // 3. Check if holding already exists for this asset
          const { data: existingHolding } = await supabase
            .from('holdings')
            .select('id')
            .eq('user_id', params.userId)
            .eq('asset_id', existingAssetId)
            .maybeSingle();

          if (existingHolding) {
            // Update existing holding (idempotent statement refresh)
            const { error: updateErr } = await supabase
              .from('holdings')
              .update({
                quantity: item.quantity,
                unit_cost_cents: item.unitCostCents,
                current_value_cents: item.currentValueCents,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingHolding.id);

            if (updateErr) {
              failed++;
            } else {
              updated++;
            }
          } else {
            // Insert new holding position
            const { error: insertErr } = await supabase.from('holdings').insert({
              user_id: params.userId,
              asset_id: existingAssetId,
              quantity: item.quantity,
              unit_cost_cents: item.unitCostCents,
              current_value_cents: item.currentValueCents,
            });

            if (insertErr) {
              failed++;
            } else {
              imported++;
            }
          }
        } catch {
          failed++;
        }
      }

      // 4. Create audit entry in import_batches table
      let batchId = `batch-${Date.now()}`;
      try {
        const { data: batchData } = await supabase
          .from('import_batches')
          .insert({
            user_id: params.userId,
            provider: params.provider,
            statement_date: params.statementDate,
            total_records: params.items.length,
            imported_records: imported,
            updated_records: updated,
            skipped_records: 0,
            failed_records: failed,
            status: failed > 0 ? (imported + updated > 0 ? 'partial' : 'failed') : 'completed',
          })
          .select('id')
          .single();

        if (batchData) {
          batchId = batchData.id;
        }
      } catch {
        // Non-blocking if audit batch insert encounters issues
      }

      return ok({
        batchId,
        total: params.items.length,
        imported,
        updated,
        skipped: 0,
        failed,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
