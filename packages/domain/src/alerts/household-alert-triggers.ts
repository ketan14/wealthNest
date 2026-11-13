import { Money } from '../money/money.js';
import { DocumentVaultSummary } from '../vault/document-vault.js';
import {
  AlertSeverity,
  EmergencyRunwayAssessment,
  FinancialAlert,
  generateHouseholdAttentionAlerts,
} from './emergency-runway.js';

export interface AssetValuationAlertCandidate {
  readonly id: string;
  readonly name: string;
  readonly assetClassId: string;
  readonly updatedAt: string;
}

export interface StaleAssetAlertItem {
  readonly id: string;
  readonly name: string;
  readonly assetClassId: string;
  readonly daysSinceUpdate: number;
}

export interface StaleAssetDetectionResult {
  readonly hasStaleValuations: boolean;
  readonly staleAssets: readonly StaleAssetAlertItem[];
}

export interface LiabilityAlertCandidate {
  readonly id: string;
  readonly name: string;
  readonly lender: string;
  readonly interestRate: number;
  readonly interestType: 'fixed' | 'floating' | 'hybrid' | string;
  readonly status: 'active' | 'closed' | string;
  readonly lastBalanceDate?: string;
  readonly updatedAt: string;
}

export interface AutomatedHouseholdAlertsInput {
  readonly emergencyRunway: EmergencyRunwayAssessment;
  readonly totalMonthlyEmi: Money;
  readonly holdings: readonly AssetValuationAlertCandidate[];
  readonly liabilities?: readonly LiabilityAlertCandidate[];
  readonly vaultSummary?: DocumentVaultSummary | null;
  readonly section112aEligible?: boolean;
  readonly referenceDate?: Date;
  readonly staleValuationThresholdDays?: number;
  readonly floatingRateAlertThresholdPct?: number;
}

const ILLIQUID_APPRAISAL_ASSET_CLASSES = new Set([
  'real_estate',
  'property',
  'gold',
  'physical_gold',
  'private_equity',
  'alternatives',
]);

const MS_PER_DAY = 86_400_000;

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function computeWholeDaysBetween(
  earlierIso: string | undefined,
  referenceDate: Date
): number | null {
  if (!earlierIso) return null;
  const parsed = new Date(earlierIso);
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = referenceDate.getTime() - parsed.getTime();
  return Math.max(0, Math.floor(diffMs / MS_PER_DAY));
}

/**
 * Detects physical/illiquid assets (Real Estate, Gold, Private Equity) whose last
 * valuation update is older than `thresholdDays` (default 180 days).
 */
export function detectStaleAssetValuations(
  holdings: readonly AssetValuationAlertCandidate[],
  referenceDate: Date = new Date(),
  thresholdDays = 180
): StaleAssetDetectionResult {
  const staleAssets: StaleAssetAlertItem[] = [];

  for (const h of holdings) {
    if (!ILLIQUID_APPRAISAL_ASSET_CLASSES.has(h.assetClassId)) continue;
    const days = computeWholeDaysBetween(h.updatedAt, referenceDate);
    if (days !== null && days >= thresholdDays) {
      staleAssets.push({
        id: h.id,
        name: h.name,
        assetClassId: h.assetClassId,
        daysSinceUpdate: days,
      });
    }
  }

  staleAssets.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);

  return {
    hasStaleValuations: staleAssets.length > 0,
    staleAssets,
  };
}

/**
 * Generates alerts for active floating-rate loans that either exceed `highRateThresholdPct`
 * (e.g. >= 9.0% p.a.) or have not had a balance/rate review in > 180 days.
 */
export function detectFloatingRateResetAlerts(
  liabilities: readonly LiabilityAlertCandidate[],
  referenceDate: Date = new Date(),
  highRateThresholdPct = 9.0,
  reviewThresholdDays = 180
): readonly FinancialAlert[] {
  const flagged = liabilities.filter((loan) => {
    if (loan.status !== 'active' || loan.interestType !== 'floating') return false;
    const daysSinceReview = computeWholeDaysBetween(
      loan.lastBalanceDate || loan.updatedAt,
      referenceDate
    );
    const isHighRate = loan.interestRate >= highRateThresholdPct;
    const isReviewOverdue = daysSinceReview !== null && daysSinceReview >= reviewThresholdDays;
    return isHighRate || isReviewOverdue;
  });

  if (flagged.length === 0) return [];

  const topLoan = flagged[0]!;
  const extraCount = flagged.length - 1;
  const suffix = extraCount > 0 ? ` (+${extraCount} more)` : '';

  return [
    {
      id: 'alert-loan-rate-reset',
      type: 'loan_rate_reset',
      severity: 'warning',
      title: 'Floating Loan Rate Review',
      message: `${topLoan.name} (${topLoan.lender}) is on a ${topLoan.interestRate.toFixed(2)}% floating rate${suffix}. Check RBI repo reset or prepayment options.`,
      actionLabel: 'Inspect Loans',
      actionHref: '/liabilities',
      data: {
        flaggedLoanIds: flagged.map((l) => l.id),
      },
    },
  ];
}

/**
 * Generates alerts for expired or soon-to-expire Family Document Vault records.
 */
export function detectDocumentRenewalAlerts(
  vaultSummary: DocumentVaultSummary | null | undefined
): readonly FinancialAlert[] {
  if (!vaultSummary) return [];
  const alerts: FinancialAlert[] = [];

  if (vaultSummary.expiredCount > 0) {
    alerts.push({
      id: 'alert-vault-expired',
      type: 'document_expired',
      severity: 'critical',
      title: 'Expired Vault Documents',
      message: `${vaultSummary.expiredCount} household ${vaultSummary.expiredCount === 1 ? 'document has' : 'documents have'} passed renewal/expiry. Renew immediately to maintain compliance.`,
      actionLabel: 'Open Vault',
      actionHref: '/documents',
      data: { expiredCount: vaultSummary.expiredCount },
    });
  }

  if (vaultSummary.expiringSoonCount > 0) {
    alerts.push({
      id: 'alert-vault-expiring',
      type: 'document_expiring',
      severity: 'warning',
      title: 'Documents Expiring Within 30 Days',
      message: `${vaultSummary.expiringSoonCount} ${vaultSummary.expiringSoonCount === 1 ? 'policy or deed' : 'policies or deeds'} due for renewal within 30 days.`,
      actionLabel: 'Review Vault',
      actionHref: '/documents',
      data: { expiringSoonCount: vaultSummary.expiringSoonCount },
    });
  }

  return alerts;
}

/**
 * Unified automated household alert evaluator combining emergency runway, EMI obligations,
 * stale physical asset appraisals, document vault renewals, floating-rate loan resets,
 * and Section 112A HUF tax-harvesting opportunities, sorted by severity.
 */
export function evaluateAutomatedHouseholdAlerts(
  input: AutomatedHouseholdAlertsInput
): readonly FinancialAlert[] {
  const referenceDate = input.referenceDate ?? new Date();
  const staleDetection = detectStaleAssetValuations(
    input.holdings,
    referenceDate,
    input.staleValuationThresholdDays ?? 180
  );

  const baseAlerts = generateHouseholdAttentionAlerts({
    emergencyRunway: input.emergencyRunway,
    totalMonthlyEmi: input.totalMonthlyEmi,
    hasStaleValuations: staleDetection.hasStaleValuations,
    staleAssetNames: staleDetection.staleAssets.map((a) => a.name),
    section112aEligible: input.section112aEligible,
  });

  const documentAlerts = detectDocumentRenewalAlerts(input.vaultSummary);
  const loanAlerts = detectFloatingRateResetAlerts(
    input.liabilities ?? [],
    referenceDate,
    input.floatingRateAlertThresholdPct ?? 9.0
  );

  return [...baseAlerts, ...documentAlerts, ...loanAlerts].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  );
}
