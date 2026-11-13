import { Money } from '../money/money.js';
import { CurrencyCode } from '../money/currency.js';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertType =
  | 'emergency_runway_critical'
  | 'emergency_runway_warning'
  | 'emi_obligation'
  | 'valuation_stale'
  | 'tax_harvesting_opportunity';

export interface FinancialAlert {
  readonly id: string;
  readonly type: AlertType;
  readonly severity: AlertSeverity;
  readonly title: string;
  readonly message: string;
  readonly actionLabel?: string;
  readonly actionHref?: string;
  readonly data?: Record<string, unknown>;
}

export interface EmergencyRunwayCalculationParams {
  readonly liquidCorpus: Money;
  readonly monthlyExpenses: Money;
  readonly targetMonths?: number; // Default 6 months (standard in India)
  readonly warningThresholdMonths?: number; // Default 6 months
  readonly criticalThresholdMonths?: number; // Default 3 months
}

export interface EmergencyRunwayAssessment {
  readonly liquidCorpus: Money;
  readonly monthlyBurn: Money;
  readonly runwayMonths: number;
  readonly targetMonths: number;
  readonly targetCorpus: Money;
  readonly shortfall: Money;
  readonly status: 'adequate' | 'warning' | 'critical';
  readonly isDepleted: boolean;
  readonly alert?: FinancialAlert;
}

/**
 * Evaluates the Emergency Runway and generates actionable household alerts.
 * Uses integer paise Money objects for zero floating-point drift.
 */
export function evaluateEmergencyRunway(
  params: EmergencyRunwayCalculationParams
): EmergencyRunwayAssessment {
  const currency: CurrencyCode = params.liquidCorpus.currency;
  const targetMonths = params.targetMonths && params.targetMonths > 0 ? params.targetMonths : 6;
  const warningMonths = params.warningThresholdMonths ?? 6;
  const criticalMonths = params.criticalThresholdMonths ?? 3;

  const targetCents = params.monthlyExpenses.cents * BigInt(targetMonths);
  const targetCorpus = Money.fromCents(targetCents, currency);

  let runwayMonths = 0;
  if (params.monthlyExpenses.cents > 0n) {
    runwayMonths =
      Number((params.liquidCorpus.cents * 100n) / params.monthlyExpenses.cents) / 100;
  } else if (params.liquidCorpus.cents > 0n) {
    runwayMonths = 99; // Indefinite runway if zero expenses
  }

  const shortfallCents =
    targetCents > params.liquidCorpus.cents ? targetCents - params.liquidCorpus.cents : 0n;
  const shortfall = Money.fromCents(shortfallCents, currency);

  let status: 'adequate' | 'warning' | 'critical' = 'adequate';
  let alert: FinancialAlert | undefined;

  if (runwayMonths < criticalMonths) {
    status = 'critical';
    alert = {
      id: 'alert-emergency-critical',
      type: 'emergency_runway_critical',
      severity: 'critical',
      title: 'Emergency Runway Critical',
      message: `Current liquid reserves cover only ${runwayMonths.toFixed(1)} months of expenses (minimum safe buffer is ${targetMonths} months). Urgent liquidity injection required.`,
      actionLabel: 'View Emergency Fund',
      actionHref: '/goals',
      data: { runwayMonths, targetMonths, shortfallCents: shortfall.cents.toString() },
    };
  } else if (runwayMonths < warningMonths) {
    status = 'warning';
    alert = {
      id: 'alert-emergency-warning',
      type: 'emergency_runway_warning',
      severity: 'warning',
      title: 'Emergency Runway Below Recommended',
      message: `Emergency reserve stands at ${runwayMonths.toFixed(1)} months (target: ${targetMonths} months). Shortfall: ${shortfall.formatIndianCompact()}.`,
      actionLabel: 'Adjust Target / Top-up',
      actionHref: '/goals',
      data: { runwayMonths, targetMonths, shortfallCents: shortfall.cents.toString() },
    };
  }

  return {
    liquidCorpus: params.liquidCorpus,
    monthlyBurn: params.monthlyExpenses,
    runwayMonths,
    targetMonths,
    targetCorpus,
    shortfall,
    status,
    isDepleted: params.liquidCorpus.cents === 0n,
    alert,
  };
}

export interface HouseholdAttentionInput {
  readonly emergencyRunway: EmergencyRunwayAssessment;
  readonly totalMonthlyEmi: Money;
  readonly upcomingEmiCount?: number;
  readonly hasStaleValuations?: boolean;
  readonly staleAssetNames?: readonly string[];
  readonly section112aEligible?: boolean;
}

/**
 * Aggregates all actionable alerts for the family dashboard.
 */
export function generateHouseholdAttentionAlerts(
  input: HouseholdAttentionInput
): readonly FinancialAlert[] {
  const alerts: FinancialAlert[] = [];

  // 1. Emergency runway alert (if not adequate)
  if (input.emergencyRunway.alert) {
    alerts.push(input.emergencyRunway.alert);
  }

  // 2. Upcoming EMI commitments
  if (input.totalMonthlyEmi.cents > 0n) {
    alerts.push({
      id: 'alert-emi-obligations',
      type: 'emi_obligation',
      severity: 'info',
      title: 'Upcoming EMI Commitments',
      message: `Estimated ${input.totalMonthlyEmi.formatIndianCompact()} monthly debt service across active liabilities.`,
      actionLabel: 'Manage Loans',
      actionHref: '/liabilities',
    });
  }

  // 3. Stale physical asset appraisals (>180 days)
  if (input.hasStaleValuations) {
    const assetsDesc = input.staleAssetNames && input.staleAssetNames.length > 0
      ? ` (${input.staleAssetNames.slice(0, 2).join(', ')})`
      : '';
    alerts.push({
      id: 'alert-stale-valuations',
      type: 'valuation_stale',
      severity: 'warning',
      title: 'Outdated Asset Appraisals',
      message: `Physical asset appraisals${assetsDesc} have not been revalued recently. Update valuations for accurate net worth.`,
      actionLabel: 'Review Assets',
      actionHref: '/portfolio',
    });
  }

  // 4. Section 112A Tax Harvesting
  if (input.section112aEligible) {
    alerts.push({
      id: 'alert-sec-112a',
      type: 'tax_harvesting_opportunity',
      severity: 'info',
      title: 'HUF Section 112A Tax Shield',
      message: '₹1,25,000 annual LTCG exemption active for Shamalbhai Vaghela HUF. Consider tax-loss or gain harvesting.',
      actionLabel: 'Inspect Analytics',
      actionHref: '/analytics',
    });
  }

  return alerts;
}

