import { Result, ok, err } from '@wealthnest/shared';
import { CasImportRepositoryPort, ConfirmCasImportParams } from '@wealthnest/application';
import { ImportSummaryResult } from '@wealthnest/domain';
import { supabase } from './client';

export class SupabaseCasImportAdapter implements CasImportRepositoryPort {
  async upsertHoldingsFromCas(
    params: ConfirmCasImportParams
  ): Promise<Result<ImportSummaryResult>> {
    try {
      let imported = 0;
      let updated = 0;
      let failed = 0;
      let equitiesImported = 0;
      let equitiesUpdated = 0;
      let mutualFundsImported = 0;
      let mutualFundsUpdated = 0;

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
              // Ensure security name, ticker, and AMC are attached/updated on the existing asset
              await supabase
                .from('assets')
                .update({
                  name: item.name,
                  ...(item.ticker ? { ticker: item.ticker } : {}),
                  ...(item.amcName ? { amc_name: item.amcName } : {}),
                  ...(item.instrumentType ? { instrument_type: item.instrumentType } : {}),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingAssetId);
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
              // Ensure security name, ISIN, ticker, and AMC are attached/updated on the existing asset
              await supabase
                .from('assets')
                .update({
                  name: item.name,
                  ...(item.isin ? { isin: item.isin } : {}),
                  ...(item.ticker ? { ticker: item.ticker } : {}),
                  ...(item.amcName ? { amc_name: item.amcName } : {}),
                  ...(item.instrumentType ? { instrument_type: item.instrumentType } : {}),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingAssetId);
            }
          }

          // 2. If asset does not exist, create asset record
          if (!existingAssetId) {
            let assetClassToUse = item.assetClassId;
            let { data: newAsset, error: assetErr } = await supabase
              .from('assets')
              .insert({
                user_id: params.userId,
                name: item.name,
                ticker: item.ticker || null,
                isin: item.isin || null,
                asset_class_id: assetClassToUse,
                instrument_type:
                  item.instrumentType ||
                  (assetClassToUse === 'mutual_fund' ? 'mutual_fund_scheme' : 'equity_share'),
                amc_name: item.amcName || null,
                currency: item.currency || 'INR',
              })
              .select('id')
              .single();

            // Resilient fallback: If custom asset_class_id foreign key constraint fails, fallback to 'equity'
            if (assetErr && assetClassToUse !== 'equity') {
              console.warn(
                `Asset class '${assetClassToUse}' rejected by database for ${item.name}, falling back to 'equity'`
              );
              const retryRes = await supabase
                .from('assets')
                .insert({
                  user_id: params.userId,
                  name: item.name,
                  ticker: item.ticker || null,
                  isin: item.isin || null,
                  asset_class_id: 'equity',
                  instrument_type: 'equity_share',
                  amc_name: item.amcName || null,
                  currency: item.currency || 'INR',
                })
                .select('id')
                .single();

              newAsset = retryRes.data;
              assetErr = retryRes.error;
            }

            if (assetErr || !newAsset) {
              console.error(`Failed to insert asset ${item.name} (${item.isin}):`, assetErr);
              failed++;
              continue;
            }
            existingAssetId = newAsset.id;
          }

          // 3. Check if holding already exists for this asset AND specific folio / demat account
          let holdingQuery = supabase
            .from('holdings')
            .select('id, unit_cost_cents, cost_basis_verified')
            .eq('user_id', params.userId)
            .eq('asset_id', existingAssetId);

          if (item.folioNumber) {
            holdingQuery = holdingQuery.eq('folio_number', item.folioNumber);
          } else {
            holdingQuery = holdingQuery.is('folio_number', null);
          }

          if (item.dematAccountId) {
            holdingQuery = holdingQuery.eq('demat_account_id', item.dematAccountId);
          } else {
            holdingQuery = holdingQuery.is('demat_account_id', null);
          }

          const { data: existingHolding } = await holdingQuery.maybeSingle();

          const isMutualFund = item.assetClassId === 'mutual_fund';

          if (existingHolding) {
            // Update existing holding (idempotent statement refresh, preserving historical valuations if verified)
            const shouldPreserveUnitCost =
              existingHolding.cost_basis_verified && !item.costBasisVerified;

            const { error: updateErr } = await supabase
              .from('holdings')
              .update({
                quantity: item.quantity,
                ...(!shouldPreserveUnitCost ? { unit_cost_cents: item.unitCostCents } : {}),
                current_value_cents: item.currentValueCents,
                amc_name: item.amcName || null,
                scheme_plan: item.schemePlan || null,
                cost_basis_verified: Boolean(
                  item.costBasisVerified || existingHolding.cost_basis_verified
                ),
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingHolding.id);

            if (updateErr) {
              console.error(`Failed to update holding ${item.name}:`, updateErr);
              failed++;
            } else {
              updated++;
              if (isMutualFund) {
                mutualFundsUpdated++;
              } else {
                equitiesUpdated++;
              }
            }
          } else {
            // Insert new holding position
            const { error: insertErr } = await supabase.from('holdings').insert({
              user_id: params.userId,
              asset_id: existingAssetId,
              quantity: item.quantity,
              unit_cost_cents: item.unitCostCents,
              current_value_cents: item.currentValueCents,
              demat_account_id: item.dematAccountId || null,
              folio_number: item.folioNumber || null,
              amc_name: item.amcName || null,
              scheme_plan: item.schemePlan || null,
              cost_basis_verified: Boolean(item.costBasisVerified),
              source: 'cas_import',
            });

            if (insertErr) {
              console.error(`Failed to insert holding ${item.name}:`, insertErr);
              failed++;
            } else {
              imported++;
              if (isMutualFund) {
                mutualFundsImported++;
              } else {
                equitiesImported++;
              }
            }
          }
        } catch (err) {
          console.error(`Exception while importing holding ${item.name}:`, err);
          failed++;
        }
      }

      // 3.5. Import transactions if provided
      let transactionsImported = 0;
      if (params.transactions && params.transactions.length > 0) {
        for (const tx of params.transactions) {
          try {
            // Find or create asset for transaction
            let assetId: string | null = null;
            if (tx.isin) {
              const { data: assetByIsin } = await supabase
                .from('assets')
                .select('id')
                .eq('user_id', params.userId)
                .eq('isin', tx.isin)
                .maybeSingle();

              if (assetByIsin) {
                assetId = assetByIsin.id;
              }
            }

            if (!assetId && tx.schemeName) {
              const { data: assetByName } = await supabase
                .from('assets')
                .select('id')
                .eq('user_id', params.userId)
                .ilike('name', tx.schemeName)
                .maybeSingle();

              if (assetByName) {
                assetId = assetByName.id;
              }
            }

            if (!assetId) {
              let { data: newAsset, error: assetErr } = await supabase
                .from('assets')
                .insert({
                  user_id: params.userId,
                  name: tx.schemeName,
                  ticker: tx.ticker || null,
                  isin: tx.isin || null,
                  asset_class_id: 'mutual_fund',
                  currency: tx.currency || 'INR',
                })
                .select('id')
                .single();

              if (assetErr) {
                const retry = await supabase
                  .from('assets')
                  .insert({
                    user_id: params.userId,
                    name: tx.schemeName,
                    ticker: tx.ticker || null,
                    isin: tx.isin || null,
                    asset_class_id: 'equity',
                    currency: tx.currency || 'INR',
                  })
                  .select('id')
                  .single();
                newAsset = retry.data;
              }

              if (newAsset) {
                assetId = newAsset.id;
              }
            }

            if (assetId) {
              // Deduplicate check: avoid double inserting exact same transaction
              const { data: existingTx } = await supabase
                .from('transactions')
                .select('id')
                .eq('user_id', params.userId)
                .eq('asset_id', assetId)
                .eq('transaction_date', tx.date)
                .eq('amount_cents', tx.amountCents)
                .eq('type', tx.type)
                .maybeSingle();

              if (!existingTx) {
                const { error: txErr } = await supabase.from('transactions').insert({
                  user_id: params.userId,
                  asset_id: assetId,
                  type: tx.type,
                  quantity: tx.units ?? null,
                  amount_cents: tx.amountCents,
                  currency: tx.currency || 'INR',
                  transaction_date: tx.date,
                  notes: tx.description || null,
                });

                if (!txErr) {
                  transactionsImported++;
                }
              }
            }
          } catch {
            // Non-blocking per transaction
          }
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
            total_records: params.items.length + (params.transactions?.length || 0),
            imported_records: imported + transactionsImported,
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
        equitiesImported,
        equitiesUpdated,
        mutualFundsImported,
        mutualFundsUpdated,
        transactionsImported,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
