export type PropertyType = 'residential' | 'commercial' | 'land' | 'reit';

export type LtvHealthBand = 'debt_free' | 'healthy' | 'moderate' | 'high_leverage';

export interface RealEstatePropertyInput {
  readonly id: string;
  readonly name: string;
  readonly propertyType: PropertyType;
  readonly location?: string;
  readonly memberId?: string;
  readonly purchaseDate?: string; // ISO YYYY-MM-DD
  readonly purchasePricePaise: bigint;
  readonly currentValuePaise: bigint;
  readonly monthlyRentPaise: bigint;
  readonly annualMaintenancePaise: bigint;
  readonly propertyTaxPaise: bigint;
  readonly linkedLoanBalancePaise: bigint;
  readonly linkedMonthlyEmiPaise: bigint;
  readonly linkedLoanName?: string;
  readonly linkedDeedDocId?: string;
}

export interface RealEstatePropertyMetrics {
  readonly input: RealEstatePropertyInput;
  readonly netPropertyEquityPaise: bigint;
  readonly isNegativeEquity: boolean;
  readonly ltvRatioPct: number;
  readonly ltvHealthBand: LtvHealthBand;
  readonly grossAnnualRentPaise: bigint;
  readonly netAnnualRentPaise: bigint;
  readonly grossRentalYieldPct: number;
  readonly netRentalYieldPct: number;
  readonly totalAppreciationPaise: bigint;
  readonly appreciationPct: number;
  readonly appreciationCagrPct: number | null;
  readonly monthlyNetCashflowPaise: bigint;
}

export interface RealEstatePortfolioSummary {
  readonly propertyCount: number;
  readonly totalPropertyValuePaise: bigint;
  readonly totalLinkedDebtPaise: bigint;
  readonly totalNetEquityPaise: bigint;
  readonly weightedLtvPct: number;
  readonly totalMonthlyRentPaise: bigint;
  readonly totalGrossAnnualRentPaise: bigint;
  readonly totalNetAnnualRentPaise: bigint;
  readonly averageGrossYieldPct: number;
  readonly averageNetYieldPct: number;
  readonly totalMonthlyNetCashflowPaise: bigint;
  readonly properties: readonly RealEstatePropertyMetrics[];
}

function classifyLtvHealth(ltvRatioPct: number): LtvHealthBand {
  if (ltvRatioPct <= 0) return 'debt_free';
  if (ltvRatioPct <= 50) return 'healthy';
  if (ltvRatioPct <= 75) return 'moderate';
  return 'high_leverage';
}

function roundTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeYearsBetween(startDateIso: string, endDate: Date): number | null {
  const startMs = new Date(startDateIso).getTime();
  const endMs = endDate.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return null;
  }
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  return (endMs - startMs) / msPerYear;
}

/**
 * Computes LTV, net property equity, rental yields, appreciation, and monthly net cashflow
 * using integer paise (BigInt) for all monetary amounts to prevent floating-point drift.
 */
export function computeRealEstatePropertyMetrics(
  input: RealEstatePropertyInput,
  asOfDate: Date = new Date()
): RealEstatePropertyMetrics {
  const netPropertyEquityPaise = input.currentValuePaise - input.linkedLoanBalancePaise;
  const isNegativeEquity = netPropertyEquityPaise < 0n;

  const ltvRatioPct =
    input.currentValuePaise > 0n
      ? roundTwoDecimals(
          (Number(input.linkedLoanBalancePaise) / Number(input.currentValuePaise)) * 100
        )
      : 0;

  const grossAnnualRentPaise = input.monthlyRentPaise * 12n;
  const netAnnualRentPaise =
    grossAnnualRentPaise - input.annualMaintenancePaise - input.propertyTaxPaise;

  const grossRentalYieldPct =
    input.currentValuePaise > 0n
      ? roundTwoDecimals((Number(grossAnnualRentPaise) / Number(input.currentValuePaise)) * 100)
      : 0;

  const netRentalYieldPct =
    input.currentValuePaise > 0n
      ? roundTwoDecimals((Number(netAnnualRentPaise) / Number(input.currentValuePaise)) * 100)
      : 0;

  const totalAppreciationPaise = input.currentValuePaise - input.purchasePricePaise;
  const appreciationPct =
    input.purchasePricePaise > 0n
      ? roundTwoDecimals((Number(totalAppreciationPaise) / Number(input.purchasePricePaise)) * 100)
      : 0;

  let appreciationCagrPct: number | null = null;
  if (input.purchaseDate && input.purchasePricePaise > 0n && input.currentValuePaise > 0n) {
    const years = computeYearsBetween(input.purchaseDate, asOfDate);
    if (years !== null && years >= 0.25) {
      const ratio = Number(input.currentValuePaise) / Number(input.purchasePricePaise);
      const cagr = (Math.pow(ratio, 1 / years) - 1) * 100;
      if (Number.isFinite(cagr)) {
        appreciationCagrPct = roundTwoDecimals(cagr);
      }
    }
  }

  const monthlyExpensesPaise = (input.annualMaintenancePaise + input.propertyTaxPaise) / 12n;
  const monthlyNetCashflowPaise =
    input.monthlyRentPaise - monthlyExpensesPaise - input.linkedMonthlyEmiPaise;

  return {
    input,
    netPropertyEquityPaise,
    isNegativeEquity,
    ltvRatioPct,
    ltvHealthBand: classifyLtvHealth(ltvRatioPct),
    grossAnnualRentPaise,
    netAnnualRentPaise,
    grossRentalYieldPct,
    netRentalYieldPct,
    totalAppreciationPaise,
    appreciationPct,
    appreciationCagrPct,
    monthlyNetCashflowPaise,
  };
}

/**
 * Aggregates portfolio-level real estate metrics across all household properties.
 */
export function summarizeRealEstatePortfolio(
  inputs: readonly RealEstatePropertyInput[],
  asOfDate: Date = new Date()
): RealEstatePortfolioSummary {
  const properties = inputs.map((item) => computeRealEstatePropertyMetrics(item, asOfDate));

  let totalPropertyValuePaise = 0n;
  let totalLinkedDebtPaise = 0n;
  let totalNetEquityPaise = 0n;
  let totalMonthlyRentPaise = 0n;
  let totalGrossAnnualRentPaise = 0n;
  let totalNetAnnualRentPaise = 0n;
  let totalMonthlyNetCashflowPaise = 0n;

  for (const prop of properties) {
    totalPropertyValuePaise += prop.input.currentValuePaise;
    totalLinkedDebtPaise += prop.input.linkedLoanBalancePaise;
    totalNetEquityPaise += prop.netPropertyEquityPaise;
    totalMonthlyRentPaise += prop.input.monthlyRentPaise;
    totalGrossAnnualRentPaise += prop.grossAnnualRentPaise;
    totalNetAnnualRentPaise += prop.netAnnualRentPaise;
    totalMonthlyNetCashflowPaise += prop.monthlyNetCashflowPaise;
  }

  const weightedLtvPct =
    totalPropertyValuePaise > 0n
      ? roundTwoDecimals((Number(totalLinkedDebtPaise) / Number(totalPropertyValuePaise)) * 100)
      : 0;

  const averageGrossYieldPct =
    totalPropertyValuePaise > 0n
      ? roundTwoDecimals(
          (Number(totalGrossAnnualRentPaise) / Number(totalPropertyValuePaise)) * 100
        )
      : 0;

  const averageNetYieldPct =
    totalPropertyValuePaise > 0n
      ? roundTwoDecimals((Number(totalNetAnnualRentPaise) / Number(totalPropertyValuePaise)) * 100)
      : 0;

  return {
    propertyCount: properties.length,
    totalPropertyValuePaise,
    totalLinkedDebtPaise,
    totalNetEquityPaise,
    weightedLtvPct,
    totalMonthlyRentPaise,
    totalGrossAnnualRentPaise,
    totalNetAnnualRentPaise,
    averageGrossYieldPct,
    averageNetYieldPct,
    totalMonthlyNetCashflowPaise,
    properties,
  };
}
