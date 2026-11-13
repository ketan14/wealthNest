import { Money } from '../money/money.js';
import { CurrencyCode } from '../money/currency.js';
import { BUDGET_2024_TAX_RULES } from './capital-gains.js';

export interface HarvestablePosition {
  readonly holdingId: string;
  readonly assetName: string;
  readonly ticker?: string;
  readonly isin?: string;
  readonly memberId?: string;
  readonly memberName: string;
  readonly isHuf: boolean;
  readonly quantity: number;
  readonly costBasis: Money;
  readonly currentValue: Money;
  readonly unrealizedGainLoss: Money;
  readonly holdingDays: number;
  readonly isLongTerm: boolean;
  /** Max tax-free harvestable gains under Section 112A ₹1.25L exemption */
  readonly harvestableExemptionCapacity: Money;
  /** Recommended units / quantity to sell to harvest exactly within exemption */
  readonly recommendedUnitsToHarvest: number;
  /** Capital gains harvested if recommended units sold */
  readonly harvestedGainsAmount: Money;
  /** Direct tax savings realized (12.5% on harvested gains) */
  readonly taxSavedAmount: Money;
}

export interface EntityHarvestingBreakdown {
  readonly memberId: string;
  readonly memberName: string;
  readonly relationship: string;
  readonly isHuf: boolean;
  readonly totalUnrealizedLtcg: Money;
  readonly annualExemptionLimit: Money; // ₹1,25,000 (12500000n paise)
  readonly exemptionAlreadyUtilized: Money;
  readonly remainingExemptionHeadroom: Money;
  readonly optimalHarvestAmount: Money;
  readonly estimatedTaxShield: Money; // 12.5% of optimalHarvestAmount
  readonly positions: readonly HarvestablePosition[];
}

export interface Section112aHarvestingPlan {
  readonly fiscalYear: string;
  readonly asOfDate: string;
  readonly totalFamilyExemptionCapacity: Money; // Sum of ₹1.25L across distinct PAN entities
  readonly totalUnrealizedLtcg: Money;
  readonly totalOptimalHarvestAmount: Money;
  readonly totalEstimatedTaxSaved: Money;
  readonly entityBreakdowns: readonly EntityHarvestingBreakdown[];
}

export interface RawHarvestInputHolding {
  readonly holdingId: string;
  readonly assetName: string;
  readonly ticker?: string;
  readonly isin?: string;
  readonly memberId?: string;
  readonly memberName?: string;
  readonly isHuf?: boolean;
  readonly quantity: number;
  readonly unitCostCents: number | bigint;
  readonly currentValueCents: number | bigint;
  readonly purchaseDate?: string;
}

export interface HarvestPlanOptions {
  readonly fiscalYear?: string;
  readonly asOfDate?: string;
  readonly currency?: CurrencyCode;
}

/**
 * Calculates the Section 112A Capital Gains Tax Harvesting Plan.
 * Under Budget 2024, every distinct PAN entity (including Hindu Undivided Family - HUF)
 * receives an independent annual ₹1,25,000 exemption on listed equity LTCG.
 *
 * Harvesting Strategy:
 * Selling and instantly repurchasing up to ₹1,25,000 of LTCG resets the cost basis tax-free,
 * saving 12.5% (up to ₹15,625 per PAN entity) in future capital gains tax.
 */
export function calculateSection112aHarvestingPlan(
  holdings: readonly RawHarvestInputHolding[],
  options: HarvestPlanOptions = {}
): Section112aHarvestingPlan {
  const currency: CurrencyCode = options.currency || 'INR';
  const asOfDateStr = options.asOfDate || new Date().toISOString().slice(0, 10);
  const asOfDate = new Date(asOfDateStr);

  const year = asOfDate.getFullYear();
  const month = asOfDate.getMonth() + 1;
  const fiscalYear =
    options.fiscalYear ||
    (month >= 4
      ? `FY ${year}-${String(year + 1).slice(2)}`
      : `FY ${year - 1}-${String(year).slice(2)}`);

  const EXEMPTION_CENTS = BUDGET_2024_TAX_RULES.EQUITY_LTCG_EXEMPTION_PAISE; // 12,500,000 paise (₹1,25,000)
  const LTCG_TAX_RATE = BUDGET_2024_TAX_RULES.EQUITY_LTCG_RATE; // 12.5%

  // Group holdings by family entity
  const entityMap = new Map<
    string,
    {
      memberName: string;
      isHuf: boolean;
      holdings: RawHarvestInputHolding[];
    }
  >();

  for (const h of holdings) {
    const memId = h.memberId || 'mem-self';
    const isHuf = Boolean(h.isHuf || memId === 'mem-huf');
    const memName = h.memberName || (isHuf ? 'Shamalbhai Vaghela HUF' : 'Ketan Vaghela');

    if (!entityMap.has(memId)) {
      entityMap.set(memId, {
        memberName: memName,
        isHuf,
        holdings: [],
      });
    }
    entityMap.get(memId)!.holdings.push(h);
  }

  const entityBreakdowns: EntityHarvestingBreakdown[] = [];
  let totalFamilyExemptionCents = 0n;
  let totalFamilyUnrealizedLtcgCents = 0n;
  let totalFamilyOptimalHarvestCents = 0n;
  let totalFamilyTaxSavedCents = 0n;

  for (const [memberId, entityData] of entityMap.entries()) {
    let entityTotalLtcgCents = 0n;
    const positions: HarvestablePosition[] = [];

    // Each legal PAN entity has its own ₹1.25L annual exemption
    totalFamilyExemptionCents += EXEMPTION_CENTS;

    for (const h of entityData.holdings) {
      const totalCostCents = BigInt(Math.round(Number(h.quantity) * Number(h.unitCostCents)));
      const curValCents = BigInt(Math.round(Number(h.currentValueCents)));
      const gainLossCents = curValCents - totalCostCents;

      // Determine holding period
      const buyDate = h.purchaseDate
        ? new Date(h.purchaseDate)
        : new Date(asOfDate.getTime() - 400 * 86400000);
      const diffTime = Math.max(0, asOfDate.getTime() - buyDate.getTime());
      const holdingDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const isLongTerm = holdingDays > BUDGET_2024_TAX_RULES.EQUITY_LONG_TERM_DAYS;

      // Only long term gains are eligible for Section 112A exemption
      if (isLongTerm && gainLossCents > 0n) {
        entityTotalLtcgCents += gainLossCents;

        // Calculate gain per unit
        const gainPerUnit = h.quantity > 0 ? Number(gainLossCents) / h.quantity : 0;

        // Compute recommended units to harvest to max out remaining entity headroom
        positions.push({
          holdingId: h.holdingId,
          assetName: h.assetName,
          ticker: h.ticker,
          isin: h.isin,
          memberId,
          memberName: entityData.memberName,
          isHuf: entityData.isHuf,
          quantity: h.quantity,
          costBasis: Money.fromCents(totalCostCents, currency),
          currentValue: Money.fromCents(curValCents, currency),
          unrealizedGainLoss: Money.fromCents(gainLossCents, currency),
          holdingDays,
          isLongTerm: true,
          harvestableExemptionCapacity: Money.fromCents(
            gainLossCents > EXEMPTION_CENTS ? EXEMPTION_CENTS : gainLossCents,
            currency
          ),
          recommendedUnitsToHarvest:
            gainPerUnit > 0
              ? Math.min(
                  h.quantity,
                  Math.round((Number(EXEMPTION_CENTS) / gainPerUnit) * 100) / 100
                )
              : 0,
          harvestedGainsAmount: Money.fromCents(
            gainLossCents > EXEMPTION_CENTS ? EXEMPTION_CENTS : gainLossCents,
            currency
          ),
          taxSavedAmount: Money.fromCents(
            BigInt(
              Math.round(
                Number(gainLossCents > EXEMPTION_CENTS ? EXEMPTION_CENTS : gainLossCents) *
                  LTCG_TAX_RATE
              )
            ),
            currency
          ),
        });
      }
    }

    // Entity-level optimal harvest amount (capped at ₹1.25L)
    const optimalHarvestCents =
      entityTotalLtcgCents > EXEMPTION_CENTS ? EXEMPTION_CENTS : entityTotalLtcgCents;
    const remainingHeadroomCents =
      EXEMPTION_CENTS > entityTotalLtcgCents ? EXEMPTION_CENTS - entityTotalLtcgCents : 0n;
    const taxShieldCents = BigInt(Math.round(Number(optimalHarvestCents) * LTCG_TAX_RATE));

    totalFamilyUnrealizedLtcgCents += entityTotalLtcgCents;
    totalFamilyOptimalHarvestCents += optimalHarvestCents;
    totalFamilyTaxSavedCents += taxShieldCents;

    entityBreakdowns.push({
      memberId,
      memberName: entityData.memberName,
      relationship: entityData.isHuf ? 'huf' : 'self',
      isHuf: entityData.isHuf,
      totalUnrealizedLtcg: Money.fromCents(entityTotalLtcgCents, currency),
      annualExemptionLimit: Money.fromCents(EXEMPTION_CENTS, currency),
      exemptionAlreadyUtilized: Money.zero(currency),
      remainingExemptionHeadroom: Money.fromCents(remainingHeadroomCents, currency),
      optimalHarvestAmount: Money.fromCents(optimalHarvestCents, currency),
      estimatedTaxShield: Money.fromCents(taxShieldCents, currency),
      positions,
    });
  }

  return {
    fiscalYear,
    asOfDate: asOfDateStr,
    totalFamilyExemptionCapacity: Money.fromCents(totalFamilyExemptionCents, currency),
    totalUnrealizedLtcg: Money.fromCents(totalFamilyUnrealizedLtcgCents, currency),
    totalOptimalHarvestAmount: Money.fromCents(totalFamilyOptimalHarvestCents, currency),
    totalEstimatedTaxSaved: Money.fromCents(totalFamilyTaxSavedCents, currency),
    entityBreakdowns,
  };
}
