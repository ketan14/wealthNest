import {
  CurrencyCode,
  Money,
  PortfolioSummary,
  HoldingValuationItem,
  calculatePortfolioSummary,
} from '@wealthnest/domain';
import { HoldingDetailDto } from '@wealthnest/application';
import { ASSET_CLASS_META_MAP } from './portfolio-demo-data';
import { NewHoldingFormValues } from './AddHoldingModal';
import { EquitiesSubtotals, GroupedHoldingBucket, MfSubtotals } from './portfolio-table-shared';

/**
 * Computes the domain PortfolioSummary from active holdings using Money value objects.
 */
export function computePortfolioSummary(
  activeHoldings: readonly HoldingDetailDto[]
): PortfolioSummary {
  const valuationItems: HoldingValuationItem[] = activeHoldings.map((h) => {
    const holdingCurrency = (h.currency as CurrencyCode) || 'INR';
    const totalCostCents = BigInt(
      Math.round((Number(h.quantity) || 0) * (Number(h.unitCostCents) || 0))
    );
    const costBasis = Money.fromCents(totalCostCents, holdingCurrency);
    const currentValue = Money.fromCents(
      BigInt(Math.round(Number(h.currentValueCents) || 0)),
      holdingCurrency
    );

    return {
      holdingId: h.holdingId,
      assetClassId: h.assetClassId,
      assetClassName: h.assetClassName,
      colorHex: h.assetClassColor,
      quantity: h.quantity,
      costBasis,
      currentValue,
    };
  });

  return calculatePortfolioSummary(valuationItems, 'INR');
}

/**
 * Filters holdings by search query and optional asset class filter.
 */
export function filterHoldingsByCriteria(
  activeHoldings: readonly HoldingDetailDto[],
  searchQuery: string,
  selectedClassFilter: string | null
): HoldingDetailDto[] {
  const normalizedQuery = searchQuery.toLowerCase();
  return activeHoldings.filter((h) => {
    const matchesSearch =
      h.name.toLowerCase().includes(normalizedQuery) ||
      (h.ticker && h.ticker.toLowerCase().includes(normalizedQuery)) ||
      (h.isin && h.isin.toLowerCase().includes(normalizedQuery)) ||
      (h.folioNumber && h.folioNumber.toLowerCase().includes(normalizedQuery)) ||
      (h.amcName && h.amcName.toLowerCase().includes(normalizedQuery));
    const matchesClass = !selectedClassFilter || h.assetClassId === selectedClassFilter;
    return matchesSearch && matchesClass;
  });
}

/**
 * Groups filtered holdings into asset-class buckets with aggregated cost and value totals.
 */
export function groupHoldingsByAssetClass(
  filteredHoldings: readonly HoldingDetailDto[]
): GroupedHoldingBucket[] {
  const map = new Map<
    string,
    {
      meta: { name: string; color: string };
      holdings: HoldingDetailDto[];
      totalValueCents: number;
      totalCostCents: number;
    }
  >();

  for (const h of filteredHoldings) {
    const classId = h.assetClassId || 'equity';
    if (!map.has(classId)) {
      map.set(classId, {
        meta: ASSET_CLASS_META_MAP[classId] || {
          name: h.assetClassName || classId.toUpperCase(),
          color: h.assetClassColor || '#3b82f6',
        },
        holdings: [],
        totalValueCents: 0,
        totalCostCents: 0,
      });
    }
    const grp = map.get(classId)!;
    grp.holdings.push(h);
    grp.totalValueCents += h.currentValueCents;
    grp.totalCostCents += Math.round(h.quantity * h.unitCostCents);
  }

  return Array.from(map.entries()).map(([classId, data]) => ({
    classId,
    ...data,
  }));
}

/**
 * Computes aggregate share count, cost, value, and return metrics for direct equities.
 */
export function computeEquitiesSubtotals(
  equitiesHoldings: readonly HoldingDetailDto[]
): EquitiesSubtotals {
  const totalShares = equitiesHoldings.reduce((acc, h) => acc + h.quantity, 0);
  const totalValueCents = equitiesHoldings.reduce((acc, h) => acc + h.currentValueCents, 0);
  const totalCostCents = equitiesHoldings.reduce(
    (acc, h) => acc + Math.round(h.quantity * h.unitCostCents),
    0
  );
  const gainLossCents = totalValueCents - totalCostCents;
  const returnPct = totalCostCents > 0 ? (gainLossCents / totalCostCents) * 100 : 0;
  return { totalShares, totalValueCents, totalCostCents, gainLossCents, returnPct };
}

/**
 * Computes aggregate unit count, verified cost, value, and return metrics for mutual funds.
 */
export function computeMfSubtotals(
  mutualFundHoldings: readonly HoldingDetailDto[]
): MfSubtotals & { readonly hasUnverified: boolean } {
  const totalUnits = mutualFundHoldings.reduce((acc, h) => acc + h.quantity, 0);
  const totalValueCents = mutualFundHoldings.reduce((acc, h) => acc + h.currentValueCents, 0);
  const verifiedHoldings = mutualFundHoldings.filter((h) => h.costBasisVerified);
  const totalVerifiedCostCents = verifiedHoldings.reduce(
    (acc, h) => acc + Math.round(h.quantity * h.unitCostCents),
    0
  );
  const verifiedValueCents = verifiedHoldings.reduce((acc, h) => acc + h.currentValueCents, 0);
  const verifiedGainLossCents = verifiedValueCents - totalVerifiedCostCents;
  const verifiedReturnPct =
    totalVerifiedCostCents > 0 ? (verifiedGainLossCents / totalVerifiedCostCents) * 100 : 0;

  return {
    totalUnits,
    totalValueCents,
    totalVerifiedCostCents,
    verifiedGainLossCents,
    verifiedReturnPct,
    hasUnverified: mutualFundHoldings.some((h) => !h.costBasisVerified),
  };
}

/**
 * Builds a local demo HoldingDetailDto from AddHoldingModal form values.
 */
export function buildDemoHolding(
  values: NewHoldingFormValues,
  unitCostCents: number,
  currentValueCents: number
): HoldingDetailDto {
  return {
    holdingId: `demo-${Date.now()}`,
    assetId: `asset-${Date.now()}`,
    name: values.name,
    ticker: values.ticker,
    isin: values.isin,
    dematAccountId: values.dematAccountId,
    folioNumber: values.folioNumber,
    amcName: values.amcName,
    schemePlan: values.schemePlan,
    costBasisVerified: values.costBasisVerified,
    memberId: values.memberId,
    accountId: values.accountId,
    assetClassId: values.assetClassId,
    assetClassName:
      values.assetClassId === 'mutual_fund'
        ? 'Mutual Funds'
        : ASSET_CLASS_META_MAP[values.assetClassId]?.name || values.assetClassId.toUpperCase(),
    assetClassColor: ASSET_CLASS_META_MAP[values.assetClassId]?.color || '#3b82f6',
    quantity: values.quantity,
    unitCostCents,
    currentValueCents,
    currency: values.currency || 'INR',
    updatedAt: new Date().toISOString(),
  };
}

export interface DemoImportedHoldingInput {
  readonly name: string;
  readonly ticker?: string;
  readonly isin?: string;
  readonly dematAccountId?: string;
  readonly folioNumber?: string;
  readonly amcName?: string;
  readonly schemePlan?: string;
  readonly costBasisVerified?: boolean;
  readonly assetClassId: string;
  readonly quantity: number;
  readonly unitCostCents: number;
  readonly currentValueCents: number;
}

/**
 * Maps CAS-imported items into local demo HoldingDetailDto records.
 */
export function buildDemoImportedHoldings(
  importedItems: readonly DemoImportedHoldingInput[],
  chosenMemberId: string,
  chosenAccountId?: string
): HoldingDetailDto[] {
  return importedItems.map((item, idx) => ({
    holdingId: `demo-imported-${idx}-${Date.now()}`,
    assetId: `asset-imported-${idx}`,
    name: item.name,
    ticker: item.ticker,
    isin: item.isin,
    dematAccountId: item.dematAccountId || chosenAccountId,
    folioNumber: item.folioNumber,
    amcName: item.amcName,
    schemePlan: item.schemePlan,
    costBasisVerified: item.costBasisVerified,
    assetClassId: item.assetClassId,
    assetClassName:
      item.assetClassId === 'mutual_fund'
        ? 'Mutual Funds'
        : ASSET_CLASS_META_MAP[item.assetClassId]?.name || 'Equities & Stocks',
    assetClassColor: ASSET_CLASS_META_MAP[item.assetClassId]?.color || '#3b82f6',
    quantity: item.quantity,
    unitCostCents: item.unitCostCents,
    currentValueCents: item.currentValueCents,
    currency: 'INR',
    updatedAt: new Date().toISOString(),
    memberId: chosenMemberId,
    accountId: chosenAccountId,
  }));
}
