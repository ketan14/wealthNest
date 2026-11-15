import { Result, ok, err } from '@wealthnest/shared';
import { CasImportRepositoryPort, ConfirmCasImportParams } from '@wealthnest/application';
import { ImportSummaryResult, RecordVisibility } from '@wealthnest/domain';
import { supabase } from './client';
import { toValidUuidOrNull } from './uuid-utils';
import { resolveHouseholdIdForWrite } from './household-scope';

export class SupabaseCasImportAdapter implements CasImportRepositoryPort {
  async upsertHoldingsFromCas(
    params: ConfirmCasImportParams
  ): Promise<Result<ImportSummaryResult>> {
    try {
      const householdId = await resolveHouseholdIdForWrite(params.householdId, params.userId);
      const visibility: RecordVisibility = params.visibility ?? 'household_shared';
      const actorId = toValidUuidOrNull(params.userId);
      const validMemberId = toValidUuidOrNull(params.memberId);
      const validAccountId = toValidUuidOrNull(params.accountId);

      let imported = 0;
      let updated = 0;
      let failed = 0;
      let equitiesImported = 0;
      let equitiesUpdated = 0;
      let mutualFundsImported = 0;
      let mutualFundsUpdated = 0;

      for (const item of params.items) {
        try {
          let existingAssetId: string | null = null;

          if (item.isin) {
            const { data: assetByIsin } = await supabase
              .from('assets')
              .select('id')
              .eq('household_id', householdId)
              .eq('isin', item.isin)
              .maybeSingle();

            if (assetByIsin) {
              existingAssetId = assetByIsin.id;
              await supabase
                .from('assets')
                .update({
                  name: item.name,
                  ...(item.ticker ? { ticker: item.ticker } : {}),
                  ...(item.amcName ? { amc_name: item.amcName } : {}),
                  ...(item.instrumentType ? { instrument_type: item.instrumentType } : {}),
                  ...(actorId ? { updated_by: actorId } : {}),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingAssetId);
            }
          }

          if (!existingAssetId) {
            const { data: assetByName } = await supabase
              .from('assets')
              .select('id')
              .eq('household_id', householdId)
              .ilike('name', item.name)
              .maybeSingle();

            if (assetByName) {
              existingAssetId = assetByName.id;
              await supabase
                .from('assets')
                .update({
                  name: item.name,
                  ...(item.isin ? { isin: item.isin } : {}),
                  ...(item.ticker ? { ticker: item.ticker } : {}),
                  ...(item.amcName ? { amc_name: item.amcName } : {}),
                  ...(item.instrumentType ? { instrument_type: item.instrumentType } : {}),
                  ...(actorId ? { updated_by: actorId } : {}),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingAssetId);
            }
          }

          if (!existingAssetId) {
            const assetClassToUse = item.assetClassId;
            let { data: newAsset, error: assetErr } = await supabase
              .from('assets')
              .insert({
                household_id: householdId,
                visibility,
                ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
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

            if (assetErr && assetClassToUse !== 'equity') {
              console.warn(
                `Asset class '${assetClassToUse}' rejected by database for ${item.name}, falling back to 'equity'`
              );
              const retryRes = await supabase
                .from('assets')
                .insert({
                  household_id: householdId,
                  visibility,
                  ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
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

          let holdingQuery = supabase
            .from('holdings')
            .select('id, unit_cost_cents, cost_basis_verified')
            .eq('household_id', householdId)
            .eq('asset_id', existingAssetId);

          if (validMemberId) {
            holdingQuery = holdingQuery.eq('member_id', validMemberId);
          } else {
            holdingQuery = holdingQuery.is('member_id', null);
          }

          if (validAccountId) {
            holdingQuery = holdingQuery.eq('account_id', validAccountId);
          } else {
            holdingQuery = holdingQuery.is('account_id', null);
          }

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
                ...(validMemberId ? { member_id: validMemberId } : {}),
                ...(validAccountId ? { account_id: validAccountId } : {}),
                ...(actorId ? { updated_by: actorId } : {}),
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
            const { data: insertedHolding, error: insertErr } = await supabase
              .from('holdings')
              .insert({
                household_id: householdId,
                visibility,
                ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
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
                member_id: validMemberId,
                account_id: validAccountId,
              })
              .select('id')
              .single();

            if (insertErr || !insertedHolding) {
              console.error(`Failed to insert holding ${item.name}:`, insertErr);
              failed++;
            } else {
              if (validMemberId) {
                await supabase.rpc('set_holding_owners', {
                  p_holding_id: insertedHolding.id,
                  p_owners: [
                    {
                      family_member_id: validMemberId,
                      ownership_share: 100,
                      is_primary_owner: true,
                    },
                  ],
                });
              }

              imported++;
              if (isMutualFund) {
                mutualFundsImported++;
              } else {
                equitiesImported++;
              }
            }
          }
        } catch (errEx) {
          console.error(`Exception while importing holding ${item.name}:`, errEx);
          failed++;
        }
      }

      let transactionsImported = 0;
      if (params.transactions && params.transactions.length > 0) {
        for (const tx of params.transactions) {
          try {
            let assetId: string | null = null;
            if (tx.isin) {
              const { data: assetByIsin } = await supabase
                .from('assets')
                .select('id')
                .eq('household_id', householdId)
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
                .eq('household_id', householdId)
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
                  household_id: householdId,
                  visibility,
                  ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
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
                    household_id: householdId,
                    visibility,
                    ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
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
              const { data: existingTx } = await supabase
                .from('transactions')
                .select('id')
                .eq('household_id', householdId)
                .eq('asset_id', assetId)
                .eq('transaction_date', tx.date)
                .eq('amount_cents', tx.amountCents)
                .eq('type', tx.type)
                .maybeSingle();

              if (!existingTx) {
                const { error: txErr } = await supabase.from('transactions').insert({
                  household_id: householdId,
                  visibility,
                  ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
                  asset_id: assetId,
                  type: tx.type,
                  quantity: tx.units ?? null,
                  amount_cents: tx.amountCents,
                  currency: tx.currency || 'INR',
                  transaction_date: tx.date,
                  notes: tx.description || null,
                  member_id: validMemberId,
                  account_id: validAccountId,
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

      let batchId = `batch-${Date.now()}`;
      try {
        const { data: batchData } = await supabase
          .from('import_batches')
          .insert({
            household_id: householdId,
            member_id: validMemberId,
            visibility,
            ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
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
        // Non-blocking audit batch insert
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
