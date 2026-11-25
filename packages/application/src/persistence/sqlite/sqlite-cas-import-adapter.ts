import { Result, ok, err } from '@wealthnest/shared';
import { ImportSummaryResult } from '@wealthnest/domain';
import { SqliteDatabase } from './sqlite-connection.js';
import { CasImportRepositoryPort, ConfirmCasImportParams } from '../../ports/cas-import.port.js';
import { generateId } from './sqlite-utils.js';

export class SqliteCasImportAdapter implements CasImportRepositoryPort {
  constructor(private readonly db: SqliteDatabase) {}

  async upsertHoldingsFromCas(
    params: ConfirmCasImportParams
  ): Promise<Result<ImportSummaryResult>> {
    try {
      // Ensure user profile (and optional household) exist for foreign key integrity
      this.db
        .prepare(
          `INSERT OR IGNORE INTO profiles (id, display_name, default_currency) VALUES (?, 'Local Investor', 'INR');`
        )
        .run(params.userId);
      if (params.householdId) {
        this.db
          .prepare('INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, ?, ?);')
          .run(params.householdId, 'My Household', params.userId);
      }

      const visibility = params.visibility ?? 'household_shared';

      // Verify optional memberId / accountId exist for this user or household in SQLite
      let validMemberId: string | null = null;
      if (params.memberId) {
        const memRow = this.db
          .prepare<{ id: string }>(
            'SELECT id FROM family_members WHERE id = ? AND (user_id = ? OR household_id = ?);'
          )
          .get(params.memberId, params.userId, params.householdId ?? params.userId);
        if (memRow) {
          validMemberId = memRow.id;
        }
      }

      let validAccountId: string | null = null;
      if (params.accountId) {
        const accRow = this.db
          .prepare<{ id: string }>(
            'SELECT id FROM portfolio_accounts WHERE id = ? AND (user_id = ? OR household_id = ?);'
          )
          .get(params.accountId, params.userId, params.householdId ?? params.userId);
        if (accRow) {
          validAccountId = accRow.id;
        }
      }

      let imported = 0;
      let updated = 0;
      let failed = 0;
      let wiped = 0;
      let equitiesImported = 0;
      let equitiesUpdated = 0;
      let mutualFundsImported = 0;
      let mutualFundsUpdated = 0;

      if (params.wipeExistingForMember) {
        const allUserHoldings = this.db
          .prepare<{ holdingId: string; memberId?: string | null }>(
            `SELECT h.id as holdingId, h.member_id as memberId FROM holdings h JOIN assets a ON h.asset_id = a.id WHERE h.user_id = ?;`
          )
          .all(params.userId);

        const targetMemberId = validMemberId ?? params.memberId ?? null;
        for (const h of allUserHoldings) {
          const matchesMember = targetMemberId
            ? h.memberId === targetMemberId || !h.memberId
            : !h.memberId;
          if (matchesMember) {
            this.db
              .prepare('DELETE FROM holding_owners WHERE holding_id = ?;')
              .run(h.holdingId);
            const delRes = this.db
              .prepare('DELETE FROM holdings WHERE id = ? AND user_id = ?;')
              .run(h.holdingId, params.userId);
            if (delRes.changes > 0) {
              wiped += 1;
            }
          }
        }
      }

      for (const item of params.items) {
        try {
          // 1. Resolve existing asset by ISIN first, then case-insensitive name
          let existingAssetId: string | null = null;

          if (item.isin) {
            const byIsin = this.db
              .prepare<{ id: string }>('SELECT id FROM assets WHERE user_id = ? AND isin = ?;')
              .get(params.userId, item.isin);

            if (byIsin) {
              existingAssetId = byIsin.id;
              this.db
                .prepare(
                  `UPDATE assets SET name = ?, ticker = COALESCE(?, ticker) WHERE id = ? AND user_id = ?;`
                )
                .run(item.name, item.ticker ?? null, existingAssetId, params.userId);
            }
          }

          if (!existingAssetId) {
            const byName = this.db
              .prepare<{ id: string }>(
                'SELECT id FROM assets WHERE user_id = ? AND LOWER(name) = LOWER(?);'
              )
              .get(params.userId, item.name);

            if (byName) {
              existingAssetId = byName.id;
              this.db
                .prepare(
                  `UPDATE assets SET name = ?, isin = COALESCE(?, isin), ticker = COALESCE(?, ticker) WHERE id = ? AND user_id = ?;`
                )
                .run(
                  item.name,
                  item.isin || null,
                  item.ticker ?? null,
                  existingAssetId,
                  params.userId
                );
            }
          }

          // 2. Create asset if it does not exist
          if (!existingAssetId) {
            const classExists = this.db
              .prepare<{ id: string }>('SELECT id FROM asset_classes WHERE id = ?;')
              .get(item.assetClassId);
            const assetClassToUse = classExists ? item.assetClassId : 'equity';
            const newAssetId = generateId('ast');

            this.db
              .prepare(
                `INSERT INTO assets (id, user_id, name, ticker, isin, asset_class_id, currency, household_id, visibility, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
              )
              .run(
                newAssetId,
                params.userId,
                item.name,
                item.ticker || null,
                item.isin || null,
                assetClassToUse,
                item.currency || 'INR',
                params.householdId ?? null,
                visibility,
                params.userId
              );

            existingAssetId = newAssetId;
          }

          // 3. Check if holding already exists for (user_id, asset_id)
          const existingHolding = this.db
            .prepare<{
              id: string;
              unit_cost_paise: number;
              cost_basis_verified: number;
            }>(
              'SELECT id, unit_cost_paise, cost_basis_verified FROM holdings WHERE user_id = ? AND asset_id = ?;'
            )
            .get(params.userId, existingAssetId);

          const isMutualFund = item.assetClassId === 'mutual_fund';

          if (existingHolding) {
            const shouldPreserveUnitCost =
              Boolean(existingHolding.cost_basis_verified) && !item.costBasisVerified;
            const nextUnitCost = shouldPreserveUnitCost
              ? existingHolding.unit_cost_paise
              : item.unitCostCents;
            const nextVerified =
              Boolean(item.costBasisVerified) || Boolean(existingHolding.cost_basis_verified)
                ? 1
                : 0;

            this.db
              .prepare(
                `UPDATE holdings
                 SET quantity = ?,
                     unit_cost_paise = ?,
                     current_value_paise = ?,
                     demat_account_id = COALESCE(?, demat_account_id),
                     folio_number = COALESCE(?, folio_number),
                     amc_name = COALESCE(?, amc_name),
                     scheme_plan = COALESCE(?, scheme_plan),
                     cost_basis_verified = ?,
                     member_id = COALESCE(?, member_id),
                     account_id = COALESCE(?, account_id),
                     updated_at = datetime('now')
                 WHERE id = ? AND user_id = ?;`
              )
              .run(
                item.quantity,
                nextUnitCost,
                item.currentValueCents,
                item.dematAccountId ?? null,
                item.folioNumber ?? null,
                item.amcName ?? null,
                item.schemePlan ?? null,
                nextVerified,
                validMemberId,
                validAccountId,
                existingHolding.id,
                params.userId
              );

            updated++;
            if (isMutualFund) {
              mutualFundsUpdated++;
            } else {
              equitiesUpdated++;
            }
          } else {
            const newHoldingId = generateId('hld');
            this.db
              .prepare(
                `INSERT INTO holdings (
                   id, user_id, asset_id, quantity, unit_cost_paise, current_value_paise,
                   member_id, account_id, demat_account_id, folio_number, amc_name, scheme_plan, cost_basis_verified,
                   household_id, visibility, created_by
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
              )
              .run(
                newHoldingId,
                params.userId,
                existingAssetId,
                item.quantity,
                item.unitCostCents,
                item.currentValueCents,
                validMemberId,
                validAccountId,
                item.dematAccountId ?? null,
                item.folioNumber ?? null,
                item.amcName ?? null,
                item.schemePlan ?? null,
                item.costBasisVerified ? 1 : 0,
                params.householdId ?? null,
                visibility,
                params.userId
              );

            if (validMemberId) {
              this.db
                .prepare(
                  `INSERT INTO holding_owners (id, household_id, holding_id, family_member_id, ownership_share, is_primary_owner)
                   VALUES (?, ?, ?, ?, 100, 1);`
                )
                .run(generateId('ho'), params.householdId ?? null, newHoldingId, validMemberId);
            }

            imported++;
            if (isMutualFund) {
              mutualFundsImported++;
            } else {
              equitiesImported++;
            }
          }
        } catch {
          failed++;
        }
      }

      // 4. Import transactions if provided
      let transactionsImported = 0;
      if (params.transactions && params.transactions.length > 0) {
        for (const tx of params.transactions) {
          try {
            let assetId: string | null = null;
            if (tx.isin) {
              const byIsin = this.db
                .prepare<{ id: string }>('SELECT id FROM assets WHERE user_id = ? AND isin = ?;')
                .get(params.userId, tx.isin);
              if (byIsin) {
                assetId = byIsin.id;
              }
            }

            if (!assetId && tx.schemeName) {
              const byName = this.db
                .prepare<{ id: string }>(
                  'SELECT id FROM assets WHERE user_id = ? AND LOWER(name) = LOWER(?);'
                )
                .get(params.userId, tx.schemeName);
              if (byName) {
                assetId = byName.id;
              }
            }

            if (!assetId) {
              const newAssetId = generateId('ast');
              this.db
                .prepare(
                  `INSERT INTO assets (id, user_id, name, ticker, isin, asset_class_id, currency, household_id, visibility, created_by)
                   VALUES (?, ?, ?, ?, ?, 'mutual_fund', ?, ?, ?, ?);`
                )
                .run(
                  newAssetId,
                  params.userId,
                  tx.schemeName || 'Imported Security',
                  tx.ticker || null,
                  tx.isin || null,
                  tx.currency || 'INR',
                  params.householdId ?? null,
                  visibility,
                  params.userId
                );
              assetId = newAssetId;
            }

            const existingTx = this.db
              .prepare<{ id: string }>(
                `SELECT id FROM transactions
                 WHERE user_id = ? AND asset_id = ? AND transaction_date = ? AND amount_paise = ? AND type = ?;`
              )
              .get(params.userId, assetId, tx.date, tx.amountCents, tx.type);

            if (!existingTx) {
              const newTxId = generateId('txn');
              this.db
                .prepare(
                  `INSERT INTO transactions (
                     id, user_id, asset_id, type, quantity, amount_paise, currency,
                     transaction_date, notes, member_id, account_id, household_id, visibility, created_by
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
                )
                .run(
                  newTxId,
                  params.userId,
                  assetId,
                  tx.type,
                  tx.units ?? null,
                  tx.amountCents,
                  tx.currency || 'INR',
                  tx.date,
                  tx.description || null,
                  validMemberId,
                  validAccountId,
                  params.householdId ?? null,
                  visibility,
                  params.userId
                );
              transactionsImported++;
            }
          } catch {
            // Non-blocking per transaction
          }
        }
      }

      return ok({
        batchId: `sqlite-batch-${Date.now()}`,
        total: params.items.length,
        imported,
        updated,
        skipped: 0,
        failed,
        wiped,
        equitiesImported,
        equitiesUpdated,
        mutualFundsImported,
        mutualFundsUpdated,
        transactionsImported,
      });
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}
