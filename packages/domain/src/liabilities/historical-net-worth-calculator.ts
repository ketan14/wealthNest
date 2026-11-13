import { CurrencyCode } from '../money/currency.js';
import { Money } from '../money/money.js';
import { projectAmortizedBalanceAsOf } from '../models/loan-amortization.js';
import {
  AssetHistoricalInput,
  AssetLiabilityLinkInput,
  LiabilityHistoricalInput,
  NetWorthSummary,
  PropertyEquityDetail,
  ResolvedAssetValuation,
  ResolvedLiabilityBalance,
  calculateDebtToAssetsRatio,
  calculateLtvRatio,
  calculateNetWorth,
  calculatePropertyEquity,
  calculateTotalAssets,
  calculateTotalLiabilities,
  calculateTotalMonthlyEmi,
} from './net-worth-calculator.js';

export interface HistoricalNetWorthParams {
  readonly asOfDate: string; // ISO YYYY-MM-DD
  readonly assets: readonly AssetHistoricalInput[];
  readonly liabilities: readonly LiabilityHistoricalInput[];
  readonly links?: readonly AssetLiabilityLinkInput[];
  readonly currency?: CurrencyCode;
}

/**
 * Resolves historical net worth as of a specific date.
 * - Strictly ignores all future records (valuation.asOfDate > reportingDate).
 * - Takes the latest record on or before asOfDate.
 * - Does not silently treat missing values as zero; reports missingAssetValuations and missingLiabilityBalances.
 * - Guarantees loans are counted once in total liabilities, even when linked to multiple assets.
 */
export function calculateHistoricalNetWorth(params: HistoricalNetWorthParams): NetWorthSummary {
  const currency = params.currency || 'INR';
  const asOfDate = params.asOfDate;

  const resolvedAssets: ResolvedAssetValuation[] = [];
  const missingAssetValuations: string[] = [];

  for (const asset of params.assets) {
    // Filter to valuations on or before asOfDate
    const validValuations = asset.valuations
      .filter((v) => v.asOfDate <= asOfDate)
      .sort((a, b) => (b.asOfDate > a.asOfDate ? 1 : b.asOfDate < a.asOfDate ? -1 : 0));

    if (validValuations.length > 0) {
      resolvedAssets.push({
        assetId: asset.assetId,
        assetName: asset.name,
        assetClassId: asset.assetClassId,
        valuation: validValuations[0]!.value,
        asOfDate: validValuations[0]!.asOfDate,
      });
    } else if (asset.fallbackCurrentValue) {
      // If allowed by explicit fallback
      resolvedAssets.push({
        assetId: asset.assetId,
        assetName: asset.name,
        assetClassId: asset.assetClassId,
        valuation: asset.fallbackCurrentValue,
        asOfDate,
      });
    } else {
      missingAssetValuations.push(asset.name || asset.assetId);
    }
  }

  const resolvedLiabilities: ResolvedLiabilityBalance[] = [];
  const missingLiabilityBalances: string[] = [];

  for (const l of params.liabilities) {
    // If loan starts after reporting date, it was not an obligation as of that date
    if (l.startDate && l.startDate > asOfDate) {
      continue;
    }

    // Filter to balances on or before asOfDate
    const validBalances = l.balances
      .filter((b) => b.asOfDate <= asOfDate)
      .sort((a, b) => (b.asOfDate > a.asOfDate ? 1 : b.asOfDate < a.asOfDate ? -1 : 0));

    if (validBalances.length > 0) {
      const checkpoint = validBalances[0]!;
      const resolvedBalance =
        l.interestRate !== undefined && checkpoint.asOfDate < asOfDate
          ? projectAmortizedBalanceAsOf({
              checkpointBalance: checkpoint.balance,
              checkpointDate: checkpoint.asOfDate,
              targetDate: asOfDate,
              annualInterestRate: l.interestRate,
              monthlyEmi: l.emiAmount,
              prepayments: l.prepayments,
            }).outstandingBalance
          : checkpoint.balance;

      resolvedLiabilities.push({
        liabilityId: l.liabilityId,
        name: l.name,
        loanType: l.loanType,
        lender: l.lender,
        status: l.status,
        emiAmount: l.emiAmount,
        originalPrincipal: l.originalPrincipal,
        outstandingBalance: resolvedBalance,
        asOfDate:
          l.interestRate !== undefined && checkpoint.asOfDate < asOfDate
            ? asOfDate
            : checkpoint.asOfDate,
        linkedAssetId: l.linkedAssetId,
      });
    } else if (l.startDate && l.startDate <= asOfDate) {
      // Loan had started but has no balance snapshot yet; compound from original principal if rate is provided
      const resolvedBalance =
        l.interestRate !== undefined && l.startDate < asOfDate
          ? projectAmortizedBalanceAsOf({
              checkpointBalance: l.originalPrincipal,
              checkpointDate: l.startDate,
              targetDate: asOfDate,
              annualInterestRate: l.interestRate,
              monthlyEmi: l.emiAmount,
              prepayments: l.prepayments,
            }).outstandingBalance
          : l.originalPrincipal;

      resolvedLiabilities.push({
        liabilityId: l.liabilityId,
        name: l.name,
        loanType: l.loanType,
        lender: l.lender,
        status: l.status,
        emiAmount: l.emiAmount,
        originalPrincipal: l.originalPrincipal,
        outstandingBalance: resolvedBalance,
        asOfDate: l.interestRate !== undefined && l.startDate < asOfDate ? asOfDate : l.startDate,
        linkedAssetId: l.linkedAssetId,
      });
    } else {
      missingLiabilityBalances.push(l.name || l.liabilityId);
    }
  }

  // 1. Calculate totals
  const totalAssets = calculateTotalAssets(resolvedAssets, currency);
  const totalLiabilities = calculateTotalLiabilities(resolvedLiabilities, currency);
  const { netWorth, isSolvent } = calculateNetWorth(totalAssets, totalLiabilities);
  const debtToAssetsRatio = calculateDebtToAssetsRatio(totalLiabilities, totalAssets);
  const totalMonthlyEmi = calculateTotalMonthlyEmi(resolvedLiabilities, currency);

  // 2. Map asset-liability relationships for property equity and LTV
  // A loan can be linked via direct linkedAssetId OR through explicit links table
  const assetToLiabilityMap = new Map<string, Set<string>>();

  // From direct link
  for (const l of resolvedLiabilities) {
    if (l.linkedAssetId) {
      if (!assetToLiabilityMap.has(l.linkedAssetId)) {
        assetToLiabilityMap.set(l.linkedAssetId, new Set());
      }
      assetToLiabilityMap.get(l.linkedAssetId)!.add(l.liabilityId);
    }
  }

  // From explicit links table
  if (params.links) {
    for (const link of params.links) {
      if (!assetToLiabilityMap.has(link.assetId)) {
        assetToLiabilityMap.set(link.assetId, new Set());
      }
      assetToLiabilityMap.get(link.assetId)!.add(link.liabilityId);
    }
  }

  const liabilityById = new Map<string, ResolvedLiabilityBalance>();
  for (const l of resolvedLiabilities) {
    liabilityById.set(l.liabilityId, l);
  }

  const propertyEquities: PropertyEquityDetail[] = [];

  for (const asset of resolvedAssets) {
    const linkedLiabilityIds = assetToLiabilityMap.get(asset.assetId);
    if (!linkedLiabilityIds || linkedLiabilityIds.size === 0) {
      // If it's a real estate asset with no loans, equity = 100% of value
      if (asset.assetClassId === 'real_estate') {
        propertyEquities.push({
          assetId: asset.assetId,
          assetName: asset.assetName,
          propertyValue: asset.valuation,
          totalDebt: Money.zero(currency),
          equity: asset.valuation,
          isNegativeEquity: false,
          ltvRatioPercentage: 0,
          linkedLoans: [],
        });
      }
      continue;
    }

    const linkedLoans: { liabilityId: string; name: string; outstandingBalance: Money }[] = [];
    const debts: Money[] = [];

    for (const libId of linkedLiabilityIds) {
      const l = liabilityById.get(libId);
      if (l && l.status !== 'closed') {
        linkedLoans.push({
          liabilityId: l.liabilityId,
          name: l.name,
          outstandingBalance: l.outstandingBalance,
        });
        debts.push(l.outstandingBalance);
      }
    }

    const { equity, isNegativeEquity, totalDebt } = calculatePropertyEquity(asset.valuation, debts);
    const ltvRatioPercentage = calculateLtvRatio(totalDebt, asset.valuation);

    propertyEquities.push({
      assetId: asset.assetId,
      assetName: asset.assetName,
      propertyValue: asset.valuation,
      totalDebt,
      equity,
      isNegativeEquity,
      ltvRatioPercentage,
      linkedLoans,
    });
  }

  return {
    asOfDate,
    totalAssets,
    totalLiabilities,
    netWorth,
    isSolvent,
    debtToAssetsRatio,
    totalMonthlyEmi,
    propertyEquities,
    missingAssetValuations,
    missingLiabilityBalances,
  };
}
