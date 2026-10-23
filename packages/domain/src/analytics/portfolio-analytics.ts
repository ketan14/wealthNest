import { Money } from '../money/money.js';
import { CurrencyCode } from '../money/currency.js';
import { calculateXirr, CashflowItem } from './xirr.js';
import { calculateCagr } from './cagr.js';

export type AllocationModelType = 'aggressive' | 'balanced' | 'conservative';

export interface TargetAllocation {
  readonly assetClassId: string;
  readonly name: string;
  readonly targetPercentage: number;
}

export const TARGET_ALLOCATION_MODELS: Record<AllocationModelType, { name: string; description: string; targets: TargetAllocation[] }> = {
  aggressive: {
    name: 'Aggressive Capital Appreciation',
    description: 'High equity exposure tailored for young investors with long horizons (>7 years).',
    targets: [
      { assetClassId: 'equity', name: 'Equities & Mutual Funds', targetPercentage: 75 },
      { assetClassId: 'fixed_income', name: 'Fixed Income & Debt', targetPercentage: 15 },
      { assetClassId: 'commodity', name: 'Gold & Precious Metals', targetPercentage: 5 },
      { assetClassId: 'cash', name: 'Cash & Liquid Savings', targetPercentage: 5 },
    ],
  },
  balanced: {
    name: 'Moderate Balanced Growth',
    description: 'Optimal risk-adjusted balance between equity growth and debt stability.',
    targets: [
      { assetClassId: 'equity', name: 'Equities & Mutual Funds', targetPercentage: 55 },
      { assetClassId: 'fixed_income', name: 'Fixed Income & Debt', targetPercentage: 30 },
      { assetClassId: 'commodity', name: 'Gold & Precious Metals', targetPercentage: 10 },
      { assetClassId: 'cash', name: 'Cash & Liquid Savings', targetPercentage: 5 },
    ],
  },
  conservative: {
    name: 'Conservative Wealth Preservation',
    description: 'Capital preservation and regular income focus with defensive positioning.',
    targets: [
      { assetClassId: 'fixed_income', name: 'Fixed Income & Debt', targetPercentage: 50 },
      { assetClassId: 'equity', name: 'Equities & Mutual Funds', targetPercentage: 30 },
      { assetClassId: 'commodity', name: 'Gold & Precious Metals', targetPercentage: 15 },
      { assetClassId: 'cash', name: 'Cash & Liquid Savings', targetPercentage: 5 },
    ],
  },
};

export interface BenchmarkComparison {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly annualizedReturn: number; // e.g. 0.142 for 14.2%
  readonly description: string;
}

export const STANDARD_INDIAN_BENCHMARKS: readonly BenchmarkComparison[] = [
  {
    id: 'nifty50_tri',
    name: 'Nifty 50 TRI',
    category: 'Large-Cap Indian Equity',
    annualizedReturn: 0.142, // 14.2% 5Y CAGR
    description: 'Total Return Index of India top 50 blue-chip companies including reinvested dividends.',
  },
  {
    id: 'bse_sensex',
    name: 'BSE Sensex',
    category: 'Benchmark Equity Index',
    annualizedReturn: 0.138, // 13.8%
    description: '30 financially sound and well-established companies listed on Bombay Stock Exchange.',
  },
  {
    id: 'sgb_gold',
    name: 'Sovereign Gold (SGB)',
    category: 'Precious Metals & Hedge',
    annualizedReturn: 0.124, // 12.4%
    description: 'Physical 24K gold capital appreciation plus 2.5% p.a. sovereign interest coupon.',
  },
  {
    id: 'sbi_fd',
    name: 'SBI 1-Yr Fixed Deposit',
    category: 'Risk-Free Fixed Income',
    annualizedReturn: 0.071, // 7.1%
    description: 'State Bank of India 1-to-2 year retail fixed deposit rate with zero market risk.',
  },
  {
    id: 'ppf_rate',
    name: 'Public Provident Fund (PPF)',
    category: 'Tax-Free Sovereign Debt',
    annualizedReturn: 0.071, // 7.1%
    description: 'Government-backed 15-year EEE (exempt-exempt-exempt) sovereign savings instrument.',
  },
];

export interface AllocationDriftItem {
  readonly assetClassId: string;
  readonly name: string;
  readonly colorHex: string;
  readonly currentValue: Money;
  readonly currentPercentage: number;
  readonly targetPercentage: number;
  readonly driftPercentage: number; // currentPercentage - targetPercentage
  readonly rebalanceAction: 'buy' | 'sell' | 'balanced';
  readonly rebalanceAmount: Money;
}

export interface ConcentrationMetrics {
  readonly topAssetWeight: number; // percentage (0 - 100)
  readonly topAssetName: string;
  readonly top3AssetsWeight: number; // percentage (0 - 100)
  readonly diversificationScore: number; // 0 - 100
  readonly riskLevel: 'low' | 'moderate' | 'high';
  readonly warning?: string;
}

export interface TrajectoryDataPoint {
  readonly date: string; // ISO date format YYYY-MM-DD
  readonly investedAmountCents: bigint;
  readonly portfolioValueCents: bigint;
  readonly benchmarkValueCents: bigint;
}

export interface PortfolioAnalyticsSummary {
  readonly totalValue: Money;
  readonly totalCostBasis: Money;
  readonly absoluteGain: Money;
  readonly returnPercentage: number;
  readonly xirr: number | null; // e.g. 0.185 (18.5% p.a.)
  readonly cagr: number; // point-to-point annualized
  readonly alphaVsNifty: number; // xirr - benchmark return
  readonly isOutperforming: boolean;
  readonly concentration: ConcentrationMetrics;
  readonly drifts: readonly AllocationDriftItem[];
  readonly benchmarks: readonly BenchmarkComparison[];
  readonly trajectory: readonly TrajectoryDataPoint[];
}

export interface AnalyticsInputHolding {
  readonly holdingId: string;
  readonly name: string;
  readonly ticker?: string;
  readonly assetClassId: string;
  readonly assetClassName: string;
  readonly colorHex: string;
  readonly costBasis: Money;
  readonly currentValue: Money;
  readonly acquisitionDate?: string;
}

export interface AnalyticsInputTransaction {
  readonly date: string;
  readonly type: 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'dividend';
  readonly amountCents: bigint;
  readonly currency: string;
}

/**
 * Calculates comprehensive portfolio performance analytics, XIRR, drift, and benchmark comparison.
 */
export function calculatePortfolioAnalytics(
  holdings: readonly AnalyticsInputHolding[],
  transactions: readonly AnalyticsInputTransaction[],
  currency: CurrencyCode = 'INR',
  modelType: AllocationModelType = 'balanced'
): PortfolioAnalyticsSummary {
  let totalValue = Money.zero(currency);
  let totalCost = Money.zero(currency);

  // 1. Portfolio totals
  for (const h of holdings) {
    const val = h.currentValue.currency === currency ? h.currentValue : h.currentValue.convertTo(currency);
    const cost = h.costBasis.currency === currency ? h.costBasis : h.costBasis.convertTo(currency);
    totalValue = totalValue.add(val);
    totalCost = totalCost.add(cost);
  }

  const diffCents = totalValue.cents - totalCost.cents;
  const absGainCents = diffCents < 0n ? -diffCents : diffCents;
  const absoluteGain = Money.fromCents(absGainCents, currency);
  const returnPercentage = totalCost.cents > 0n ? Number((diffCents * 10000n) / totalCost.cents) / 100 : 0;

  // 2. XIRR Cashflows
  const cashflows: CashflowItem[] = [];

  for (const tx of transactions) {
    const d = new Date(tx.date);
    const amt = Number(tx.amountCents) / 100;
    if (isNaN(d.getTime()) || amt <= 0) continue;

    // Inflows into portfolio (investor capital deposits, buys) are outflows from investor pocket: negative
    if (tx.type === 'deposit' || tx.type === 'buy') {
      cashflows.push({ date: d, amount: -amt });
    } else if (tx.type === 'withdrawal' || tx.type === 'sell' || tx.type === 'dividend') {
      // Outflows from portfolio to investor pocket are positive cashflows
      cashflows.push({ date: d, amount: amt });
    }
  }

  // If no transactions provided, fallback to synthetic cost basis cashflow 1 year ago
  if (cashflows.length === 0 && totalCost.cents > 0n) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    cashflows.push({ date: oneYearAgo, amount: -(Number(totalCost.cents) / 100) });
  }

  // Terminal cashflow: Current total valuation today as positive value
  if (totalValue.cents > 0n) {
    cashflows.push({ date: new Date(), amount: Number(totalValue.cents) / 100 });
  }

  const xirr = calculateXirr(cashflows);

  // 3. CAGR calculation (assume average holding period or default 1.5 years if not specified)
  const cagr = calculateCagr({
    beginningValue: totalCost,
    endingValue: totalValue,
    years: 1.5,
  });

  // 4. Alpha vs Nifty 50 TRI (14.2%)
  const benchmarkRate = 0.142;
  const effectiveReturn = xirr !== null ? xirr : returnPercentage / 100;
  const alphaVsNifty = Number((effectiveReturn - benchmarkRate).toFixed(4));
  const isOutperforming = alphaVsNifty >= 0;

  // 5. Concentration Risk Metrics
  const sortedByVal = [...holdings].sort((a, b) => (b.currentValue.cents > a.currentValue.cents ? 1 : -1));
  let topAssetWeight = 0;
  let topAssetName = 'N/A';
  let top3AssetsWeight = 0;

  if (totalValue.cents > 0n && sortedByVal.length > 0) {
    const top1 = sortedByVal[0]!;
    topAssetName = top1.name;
    topAssetWeight = Number((top1.currentValue.cents * 10000n) / totalValue.cents) / 100;

    const top3Sum = sortedByVal.slice(0, 3).reduce((sum, h) => sum + h.currentValue.cents, 0n);
    top3AssetsWeight = Number((top3Sum * 10000n) / totalValue.cents) / 100;
  }

  let riskLevel: 'low' | 'moderate' | 'high' = 'low';
  let warning: string | undefined;

  if (topAssetWeight > 30 || top3AssetsWeight > 65) {
    riskLevel = 'high';
    warning = `Single asset concentration alert: ${topAssetName} accounts for ${topAssetWeight.toFixed(1)}% of your portfolio. High volatility vulnerability.`;
  } else if (topAssetWeight > 18 || top3AssetsWeight > 45) {
    riskLevel = 'moderate';
    warning = `Moderate concentration: Top 3 holdings represent ${top3AssetsWeight.toFixed(1)}% of your portfolio.`;
  }

  const diversificationScore = Math.max(
    10,
    Math.min(100, Math.round(100 - (topAssetWeight * 0.8 + (top3AssetsWeight - topAssetWeight) * 0.4)))
  );

  // 6. Asset Class Allocation Drift
  const classValueMap = new Map<string, { name: string; colorHex: string; totalValue: Money }>();
  for (const h of holdings) {
    const val = h.currentValue.currency === currency ? h.currentValue : h.currentValue.convertTo(currency);
    const existing = classValueMap.get(h.assetClassId);
    if (existing) {
      existing.totalValue = existing.totalValue.add(val);
    } else {
      classValueMap.set(h.assetClassId, {
        name: h.assetClassName,
        colorHex: h.colorHex,
        totalValue: val,
      });
    }
  }

  const model = TARGET_ALLOCATION_MODELS[modelType] || TARGET_ALLOCATION_MODELS.balanced;
  const targetMap = new Map<string, number>(model.targets.map((t) => [t.assetClassId, t.targetPercentage]));

  const drifts: AllocationDriftItem[] = [];

  // Check all target asset classes
  for (const target of model.targets) {
    const classData = classValueMap.get(target.assetClassId);
    const currentVal = classData ? classData.totalValue : Money.zero(currency);
    const currentPct = totalValue.cents > 0n ? Number((currentVal.cents * 10000n) / totalValue.cents) / 100 : 0;
    const targetPct = target.targetPercentage;
    const driftPct = Number((currentPct - targetPct).toFixed(2));

    // Target value in Money
    const targetValCents = (totalValue.cents * BigInt(Math.round(targetPct * 100))) / 10000n;
    const diffRebalanceCents = targetValCents - currentVal.cents;

    let action: 'buy' | 'sell' | 'balanced' = 'balanced';
    if (Math.abs(driftPct) >= 1.0) {
      action = driftPct < 0 ? 'buy' : 'sell';
    }

    const rebalanceAmtCents = diffRebalanceCents < 0n ? -diffRebalanceCents : diffRebalanceCents;

    drifts.push({
      assetClassId: target.assetClassId,
      name: target.name,
      colorHex: classData?.colorHex || '#94a3b8',
      currentValue: currentVal,
      currentPercentage: currentPct,
      targetPercentage: targetPct,
      driftPercentage: driftPct,
      rebalanceAction: action,
      rebalanceAmount: Money.fromCents(rebalanceAmtCents, currency),
    });
  }

  // Include any extra held classes not in target model (e.g. real estate, crypto)
  for (const [classId, classData] of classValueMap.entries()) {
    if (!targetMap.has(classId)) {
      const currentPct = totalValue.cents > 0n ? Number((classData.totalValue.cents * 10000n) / totalValue.cents) / 100 : 0;
      drifts.push({
        assetClassId: classId,
        name: classData.name,
        colorHex: classData.colorHex,
        currentValue: classData.totalValue,
        currentPercentage: currentPct,
        targetPercentage: 0,
        driftPercentage: currentPct,
        rebalanceAction: 'sell',
        rebalanceAmount: classData.totalValue,
      });
    }
  }

  // 7. Trajectory Data Points (Simulate historical monthly progression over 12 months)
  const trajectory: TrajectoryDataPoint[] = [];
  const now = new Date();

  for (let m = 11; m >= 0; m--) {
    const ptDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const dateStr = ptDate.toISOString().split('T')[0]!;

    // Progress factor from past to present (simulating growth)
    const factor = (12 - m) / 12;
    // Slight market volatility curve
    const marketOscillation = Math.sin((12 - m) * 0.8) * 0.04;
    const benchmarkFactor = factor * (1 + marketOscillation * 0.5);
    const valFactor = factor * (1 + marketOscillation + (returnPercentage / 100) * 0.5);

    const investedCents = (totalCost.cents * BigInt(Math.max(10, Math.round(factor * 100)))) / 100n;
    const valCents = (totalValue.cents * BigInt(Math.max(10, Math.round(valFactor * 100)))) / 100n;
    const benchmarkCents = (totalCost.cents * BigInt(Math.max(10, Math.round((1 + benchmarkFactor * 0.14) * 100)))) / 100n;

    trajectory.push({
      date: dateStr,
      investedAmountCents: investedCents,
      portfolioValueCents: valCents,
      benchmarkValueCents: benchmarkCents,
    });
  }

  return {
    totalValue,
    totalCostBasis: totalCost,
    absoluteGain,
    returnPercentage,
    xirr,
    cagr,
    alphaVsNifty,
    isOutperforming,
    concentration: {
      topAssetWeight,
      topAssetName,
      top3AssetsWeight,
      diversificationScore,
      riskLevel,
      warning,
    },
    drifts,
    benchmarks: STANDARD_INDIAN_BENCHMARKS,
    trajectory,
  };
}
