import { ParsedCasHolding } from '../cas/cas-types.js';
import { ParsedBrokerHolding, ParsedBrokerTrade } from '../importers/broker-csv-types.js';

export type ReconciliationStatus =
  | 'matched'
  | 'quantity_mismatch'
  | 'cost_basis_unverified'
  | 'missing_in_broker'
  | 'missing_in_cas';

export interface ReconciledHoldingRecord {
  readonly key: string;
  readonly isin?: string;
  readonly symbol?: string;
  readonly name: string;
  readonly casQuantity: number;
  readonly brokerQuantity: number;
  readonly quantityDelta: number;
  readonly casCostBasisVerified: boolean;
  readonly casUnitCostPaise?: bigint;
  readonly brokerUnitCostPaise?: bigint;
  readonly marketValuePaise: bigint;
  readonly status: ReconciliationStatus;
  readonly recommendation: string;
}

export interface ReconciliationSummary {
  readonly totalRecords: number;
  readonly totalMatched: number;
  readonly quantityMismatchCount: number;
  readonly unverifiedCostBasisCount: number;
  readonly missingInBrokerCount: number;
  readonly missingInCasCount: number;
  readonly reconciliationScorePct: number;
  readonly totalReconciledValuePaise: bigint;
  readonly records: readonly ReconciledHoldingRecord[];
}

export interface ReconcileCasWithBrokerParams {
  readonly casHoldings: readonly ParsedCasHolding[];
  readonly brokerHoldings?: readonly ParsedBrokerHolding[];
  readonly brokerTrades?: readonly ParsedBrokerTrade[];
}

interface AggregatedBrokerPosition {
  key: string;
  isin?: string;
  symbol: string;
  name: string;
  quantity: number;
  unitCostPaise: bigint;
  marketValuePaise: bigint;
}

const QUANTITY_TOLERANCE = 0.001;

function normalizeKey(isin?: string, symbol?: string): string {
  if (isin && isin.trim().length > 0) {
    return `ISIN:${isin.trim().toUpperCase()}`;
  }
  if (symbol && symbol.trim().length > 0) {
    return `SYM:${symbol.trim().toUpperCase()}`;
  }
  return '';
}

function aggregateBrokerPositions(
  brokerHoldings: readonly ParsedBrokerHolding[],
  brokerTrades: readonly ParsedBrokerTrade[]
): Map<string, AggregatedBrokerPosition> {
  const map = new Map<string, AggregatedBrokerPosition>();

  for (const bh of brokerHoldings) {
    const key = normalizeKey(bh.isin, bh.symbol);
    if (!key) continue;

    const existing = map.get(key);
    const unitCostPaise = bh.unitCost.cents;
    const marketValuePaise = bh.currentValue?.cents ?? 0n;

    if (!existing) {
      map.set(key, {
        key,
        isin: bh.isin?.trim().toUpperCase(),
        symbol: bh.symbol.trim().toUpperCase(),
        name: bh.name,
        quantity: bh.quantity,
        unitCostPaise,
        marketValuePaise,
      });
    } else {
      const totalQty = existing.quantity + bh.quantity;
      const weightedCost =
        totalQty > 0
          ? BigInt(
              Math.round(
                (existing.quantity * Number(existing.unitCostPaise) +
                  bh.quantity * Number(unitCostPaise)) /
                  totalQty
              )
            )
          : 0n;
      existing.quantity = totalQty;
      existing.unitCostPaise = weightedCost;
      existing.marketValuePaise += marketValuePaise;
    }
  }

  // If no brokerHoldings were provided for a symbol/ISIN, derive net position from tradebook
  if (brokerTrades.length > 0) {
    const tradeBuckets = new Map<
      string,
      {
        isin?: string;
        symbol: string;
        name: string;
        buyQty: number;
        sellQty: number;
        totalBuyCostPaise: bigint;
      }
    >();

    for (const tr of brokerTrades) {
      const key = normalizeKey(tr.isin, tr.symbol);
      if (!key || map.has(key)) continue;

      let bucket = tradeBuckets.get(key);
      if (!bucket) {
        bucket = {
          isin: tr.isin?.trim().toUpperCase(),
          symbol: tr.symbol.trim().toUpperCase(),
          name: tr.name,
          buyQty: 0,
          sellQty: 0,
          totalBuyCostPaise: 0n,
        };
        tradeBuckets.set(key, bucket);
      }

      if (tr.tradeType === 'BUY') {
        bucket.buyQty += tr.quantity;
        bucket.totalBuyCostPaise += tr.totalAmount.cents;
      } else {
        bucket.sellQty += tr.quantity;
      }
    }

    for (const [key, bucket] of tradeBuckets.entries()) {
      const netQty = Math.max(0, bucket.buyQty - bucket.sellQty);
      const avgUnitCostPaise =
        bucket.buyQty > 0
          ? BigInt(Math.round(Number(bucket.totalBuyCostPaise) / bucket.buyQty))
          : 0n;

      map.set(key, {
        key,
        isin: bucket.isin,
        symbol: bucket.symbol,
        name: bucket.name,
        quantity: netQty,
        unitCostPaise: avgUnitCostPaise,
        marketValuePaise: 0n,
      });
    }
  }

  return map;
}

/**
 * Reconciles CDSL/NSDL/CAMS CAS holdings against Zerodha/Groww broker holdings or tradebooks.
 * Identifies quantity mismatches, missing records, and unverified Section 112A cost-basis lots.
 */
export function reconcileCasWithBroker({
  casHoldings,
  brokerHoldings = [],
  brokerTrades = [],
}: ReconcileCasWithBrokerParams): ReconciliationSummary {
  const brokerMap = aggregateBrokerPositions(brokerHoldings, brokerTrades);
  const matchedBrokerKeys = new Set<string>();
  const records: ReconciledHoldingRecord[] = [];

  for (const cas of casHoldings) {
    const isinKey = normalizeKey(cas.isin, undefined);
    const symKey = normalizeKey(undefined, cas.ticker);
    const broker =
      (isinKey && brokerMap.get(isinKey)) || (symKey && brokerMap.get(symKey)) || undefined;

    if (broker) {
      matchedBrokerKeys.add(broker.key);
    }

    const casQty = cas.quantity;
    const brokerQty = broker ? broker.quantity : 0;
    const delta = Math.round((casQty - brokerQty) * 10000) / 10000;
    const casUnitCostPaise = cas.unitCost?.cents;
    const brokerUnitCostPaise = broker?.unitCostPaise;
    const marketValuePaise = cas.reportedMarketValue.cents;

    let status: ReconciliationStatus;
    let recommendation: string;

    if (!broker) {
      status = 'missing_in_broker';
      recommendation =
        'Present in CAS but not in uploaded broker CSV. Verify secondary demat/AMC folio or upload additional broker file.';
    } else if (Math.abs(delta) > QUANTITY_TOLERANCE) {
      status = 'quantity_mismatch';
      recommendation = `Quantity delta of ${delta > 0 ? '+' : ''}${delta} units (CAS: ${casQty}, Broker: ${brokerQty}). Check corporate splits/bonus or pending T+1 settlement.`;
    } else if (!cas.costBasisVerified) {
      status = 'cost_basis_unverified';
      recommendation =
        brokerUnitCostPaise && brokerUnitCostPaise > 0n
          ? 'Quantities match. Apply verified broker average cost basis for accurate Section 112A LTCG.'
          : 'Quantities match, but CAS cost basis is unverified. Upload broker tradebook CSV to verify acquisition cost.';
    } else {
      status = 'matched';
      recommendation = 'CAS and broker positions match with verified cost basis.';
    }

    records.push({
      key: isinKey || symKey || cas.name,
      isin: cas.isin,
      symbol: cas.ticker || broker?.symbol,
      name: cas.name,
      casQuantity: casQty,
      brokerQuantity: brokerQty,
      quantityDelta: delta,
      casCostBasisVerified: cas.costBasisVerified,
      casUnitCostPaise,
      brokerUnitCostPaise,
      marketValuePaise,
      status,
      recommendation,
    });
  }

  for (const [key, broker] of brokerMap.entries()) {
    if (matchedBrokerKeys.has(key)) continue;
    if (broker.quantity <= QUANTITY_TOLERANCE) continue;

    records.push({
      key,
      isin: broker.isin,
      symbol: broker.symbol,
      name: broker.name,
      casQuantity: 0,
      brokerQuantity: broker.quantity,
      quantityDelta: -broker.quantity,
      casCostBasisVerified: true,
      brokerUnitCostPaise: broker.unitCostPaise,
      marketValuePaise: broker.marketValuePaise,
      status: 'missing_in_cas',
      recommendation:
        'Present in broker CSV but missing in CAS statement. Recent purchase may post in next monthly CAS.',
    });
  }

  let totalMatched = 0;
  let quantityMismatchCount = 0;
  let unverifiedCostBasisCount = 0;
  let missingInBrokerCount = 0;
  let missingInCasCount = 0;
  let totalReconciledValuePaise = 0n;

  for (const rec of records) {
    totalReconciledValuePaise += rec.marketValuePaise;
    switch (rec.status) {
      case 'matched':
        totalMatched += 1;
        break;
      case 'quantity_mismatch':
        quantityMismatchCount += 1;
        break;
      case 'cost_basis_unverified':
        unverifiedCostBasisCount += 1;
        break;
      case 'missing_in_broker':
        missingInBrokerCount += 1;
        break;
      case 'missing_in_cas':
        missingInCasCount += 1;
        break;
    }
  }

  const reconciliationScorePct =
    records.length > 0 ? Math.round((totalMatched / records.length) * 1000) / 10 : 100;

  return {
    totalRecords: records.length,
    totalMatched,
    quantityMismatchCount,
    unverifiedCostBasisCount,
    missingInBrokerCount,
    missingInCasCount,
    reconciliationScorePct,
    totalReconciledValuePaise,
    records,
  };
}

