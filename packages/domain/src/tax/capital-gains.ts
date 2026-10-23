import { Money } from '../money/money.js';

export type CapitalGainsTerm = 'long_term' | 'short_term';

export interface HoldingTaxAssessment {
  readonly holdingId: string;
  readonly assetName: string;
  readonly assetClassId: string;
  readonly isin?: string;
  readonly quantity: number;
  readonly costBasis: Money;
  readonly currentValue: Money;
  readonly unrealizedGainLoss: Money;
  readonly isGain: boolean;
  readonly holdingPeriodDays: number;
  readonly term: CapitalGainsTerm;
  readonly taxRatePercentage: number;
  readonly taxableAmount: Money;
  readonly estimatedTax: Money;
  readonly harvestableLoss: Money;
}

export interface PortfolioTaxSummary {
  readonly asOfDate: string;
  readonly fiscalYear: string; // e.g. "FY 2025-26"
  readonly grossUnrealizedGains: Money;
  readonly grossUnrealizedLosses: Money;
  readonly netUnrealizedGainLoss: Money;
  readonly ltcgGains: Money;
  readonly ltcgLosses: Money;
  readonly netLtcg: Money;
  readonly stcgGains: Money;
  readonly stcgLosses: Money;
  readonly netStcg: Money;
  readonly annualLtcgExemption: Money; // ₹1,25,000 under Budget 2024
  readonly taxableLtcg: Money;
  readonly estimatedLtcgTax: Money; // 12.5% on excess
  readonly estimatedStcgTax: Money; // 20% flat
  readonly totalEstimatedTax: Money;
  readonly harvestableLossPotential: Money;
  readonly potentialTaxSavings: Money;
  readonly holdings: readonly HoldingTaxAssessment[];
}

/**
 * Budget 2024 Indian Capital Gains Constants
 */
export const BUDGET_2024_TAX_RULES = {
  /** Section 112A annual exemption threshold for equity LTCG: ₹1,25,000 (125,000,00 paise) */
  EQUITY_LTCG_EXEMPTION_PAISE: 12500000n,
  /** Equity LTCG tax rate (holding period > 365 days): 12.5% */
  EQUITY_LTCG_RATE: 0.125,
  /** Equity STCG tax rate (holding period <= 365 days): 20% */
  EQUITY_STCG_RATE: 0.20,
  /** Holding period in days to qualify as Long Term for Listed Equity and Mutual Funds */
  EQUITY_LONG_TERM_DAYS: 365,
};

export interface RawHoldingTaxInput {
  readonly holdingId: string;
  readonly name: string;
  readonly assetClassId: string;
  readonly isin?: string;
  readonly quantity: number;
  readonly unitCostCents: number | bigint;
  readonly currentValueCents: number | bigint;
  readonly purchaseDate?: string; // ISO date string (YYYY-MM-DD)
}

/**
 * Calculates India-First Capital Gains and Tax-Loss Harvesting metrics under Budget 2024 rules.
 */
export function calculateCapitalGainsTaxSummary(
  holdings: readonly RawHoldingTaxInput[],
  currentDateStr: string = new Date().toISOString().slice(0, 10)
): PortfolioTaxSummary {
  const currentDate = new Date(currentDateStr);
  const assessments: HoldingTaxAssessment[] = [];

  let totalLtcgGainsCents = 0n;
  let totalLtcgLossesCents = 0n;
  let totalStcgGainsCents = 0n;
  let totalStcgLossesCents = 0n;
  let grossGainsCents = 0n;
  let grossLossesCents = 0n;
  let harvestableLossCents = 0n;

  for (const h of holdings) {
    const totalCostCents = BigInt(Math.round(Number(h.quantity) * Number(h.unitCostCents)));
    const curValCents = BigInt(Math.round(Number(h.currentValueCents)));
    const gainLossCents = curValCents - totalCostCents;
    const isGain = gainLossCents >= 0n;

    // Determine holding period
    const buyDate = h.purchaseDate ? new Date(h.purchaseDate) : new Date(currentDate.getTime() - 400 * 86400000);
    const diffTime = Math.max(0, currentDate.getTime() - buyDate.getTime());
    const holdingDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const isLongTerm = holdingDays > BUDGET_2024_TAX_RULES.EQUITY_LONG_TERM_DAYS;
    const term: CapitalGainsTerm = isLongTerm ? 'long_term' : 'short_term';
    const taxRate = isLongTerm
      ? BUDGET_2024_TAX_RULES.EQUITY_LTCG_RATE
      : BUDGET_2024_TAX_RULES.EQUITY_STCG_RATE;

    const absGainLoss = gainLossCents < 0n ? -gainLossCents : gainLossCents;

    if (isGain) {
      grossGainsCents += gainLossCents;
      if (isLongTerm) {
        totalLtcgGainsCents += gainLossCents;
      } else {
        totalStcgGainsCents += gainLossCents;
      }
    } else {
      grossLossesCents += absGainLoss;
      harvestableLossCents += absGainLoss;
      if (isLongTerm) {
        totalLtcgLossesCents += absGainLoss;
      } else {
        totalStcgLossesCents += absGainLoss;
      }
    }

    const estimatedHoldingTax = isGain
      ? BigInt(Math.round(Number(gainLossCents) * taxRate))
      : 0n;

    assessments.push({
      holdingId: h.holdingId,
      assetName: h.name,
      assetClassId: h.assetClassId,
      isin: h.isin,
      quantity: h.quantity,
      costBasis: Money.fromCents(totalCostCents, 'INR'),
      currentValue: Money.fromCents(curValCents, 'INR'),
      unrealizedGainLoss: Money.fromCents(gainLossCents, 'INR'),
      isGain,
      holdingPeriodDays: holdingDays,
      term,
      taxRatePercentage: taxRate * 100,
      taxableAmount: isGain ? Money.fromCents(gainLossCents, 'INR') : Money.zero('INR'),
      estimatedTax: Money.fromCents(estimatedHoldingTax, 'INR'),
      harvestableLoss: isGain ? Money.zero('INR') : Money.fromCents(absGainLoss, 'INR'),
    });
  }

  // Net LTCG after setting off LTCG losses
  const netLtcgCents = totalLtcgGainsCents > totalLtcgLossesCents
    ? totalLtcgGainsCents - totalLtcgLossesCents
    : 0n;

  // Net STCG after setting off STCG losses
  const netStcgCents = totalStcgGainsCents > totalStcgLossesCents
    ? totalStcgGainsCents - totalStcgLossesCents
    : 0n;

  // Under Section 112A, the first ₹1.25 Lakh of LTCG is tax-exempt
  const exemptionCents = BUDGET_2024_TAX_RULES.EQUITY_LTCG_EXEMPTION_PAISE;
  const taxableLtcgCents = netLtcgCents > exemptionCents ? netLtcgCents - exemptionCents : 0n;

  const estimatedLtcgTaxCents = BigInt(
    Math.round(Number(taxableLtcgCents) * BUDGET_2024_TAX_RULES.EQUITY_LTCG_RATE)
  );
  const estimatedStcgTaxCents = BigInt(
    Math.round(Number(netStcgCents) * BUDGET_2024_TAX_RULES.EQUITY_STCG_RATE)
  );
  const totalTaxCents = estimatedLtcgTaxCents + estimatedStcgTaxCents;

  // Potential tax savings from harvesting: 20% on short-term losses + 12.5% on long-term losses
  const potentialSavingsCents = BigInt(
    Math.round(
      Number(totalStcgLossesCents) * BUDGET_2024_TAX_RULES.EQUITY_STCG_RATE +
      Number(totalLtcgLossesCents) * BUDGET_2024_TAX_RULES.EQUITY_LTCG_RATE
    )
  );

  // Compute Indian Fiscal Year
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-indexed
  const fyString = month >= 4 ? `FY ${year}-${String(year + 1).slice(2)}` : `FY ${year - 1}-${String(year).slice(2)}`;

  return {
    asOfDate: currentDateStr,
    fiscalYear: fyString,
    grossUnrealizedGains: Money.fromCents(grossGainsCents, 'INR'),
    grossUnrealizedLosses: Money.fromCents(grossLossesCents, 'INR'),
    netUnrealizedGainLoss: Money.fromCents(grossGainsCents - grossLossesCents, 'INR'),
    ltcgGains: Money.fromCents(totalLtcgGainsCents, 'INR'),
    ltcgLosses: Money.fromCents(totalLtcgLossesCents, 'INR'),
    netLtcg: Money.fromCents(netLtcgCents, 'INR'),
    stcgGains: Money.fromCents(totalStcgGainsCents, 'INR'),
    stcgLosses: Money.fromCents(totalStcgLossesCents, 'INR'),
    netStcg: Money.fromCents(netStcgCents, 'INR'),
    annualLtcgExemption: Money.fromCents(exemptionCents, 'INR'),
    taxableLtcg: Money.fromCents(taxableLtcgCents, 'INR'),
    estimatedLtcgTax: Money.fromCents(estimatedLtcgTaxCents, 'INR'),
    estimatedStcgTax: Money.fromCents(estimatedStcgTaxCents, 'INR'),
    totalEstimatedTax: Money.fromCents(totalTaxCents, 'INR'),
    harvestableLossPotential: Money.fromCents(harvestableLossCents, 'INR'),
    potentialTaxSavings: Money.fromCents(potentialSavingsCents, 'INR'),
    holdings: assessments,
  };
}
