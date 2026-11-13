import { CurrencyCode } from '../money/currency.js';
import { Money } from '../money/money.js';
import { TransactionType } from '../models/transaction.js';

export type RecurringFrequency = 'monthly' | 'quarterly' | 'yearly';
export type RecurringRuleCategory = 'sip' | 'emi' | 'utility' | 'salary';

export interface RecurringTransactionRule {
  readonly id: string;
  readonly name: string;
  readonly category: RecurringRuleCategory;
  readonly transactionType: TransactionType;
  readonly amount: Money;
  readonly frequency: RecurringFrequency;
  readonly dayOfMonth: number; // 1..28
  readonly nextDueDate: string; // YYYY-MM-DD
  readonly lastPostedDate?: string; // YYYY-MM-DD
  readonly memberId?: string;
  readonly accountId?: string;
  readonly notes?: string;
  readonly isActive: boolean;
}

export interface RecurringRuleStatus {
  readonly isDue: boolean;
  readonly isOverdue: boolean;
  readonly daysUntilDue: number;
}

export interface RecurringCommitmentsSummary {
  readonly totalMonthlySip: Money;
  readonly totalMonthlyEmi: Money;
  readonly dueCount: number;
  readonly overdueCount: number;
}

const MS_PER_DAY = 86_400_000;

function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const parts = iso.slice(0, 10).split('-').map(Number);
  return {
    year: parts[0] || 2026,
    month: parts[1] || 1,
    day: parts[2] || 1,
  };
}

/**
 * Computes the next due date (YYYY-MM-DD) after advancing by one frequency period,
 * clamping `dayOfMonth` to [1, 28] to avoid month-end drift.
 */
export function computeNextDueDate(
  currentDueIso: string,
  frequency: RecurringFrequency,
  dayOfMonth: number
): string {
  const { year, month } = parseIsoDate(currentDueIso);
  const clampedDay = Math.min(28, Math.max(1, Math.round(dayOfMonth)));
  const monthIncrement = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12;
  const nextUtc = new Date(Date.UTC(year, month - 1 + monthIncrement, clampedDay));
  return nextUtc.toISOString().slice(0, 10);
}

/**
 * Evaluates whether a recurring rule is due or overdue relative to `referenceDate`.
 */
export function evaluateRecurringRuleStatus(
  rule: RecurringTransactionRule,
  referenceDate: Date = new Date()
): RecurringRuleStatus {
  if (!rule.isActive) {
    return { isDue: false, isOverdue: false, daysUntilDue: 999 };
  }
  const refIso = referenceDate.toISOString().slice(0, 10);
  const refUtc = new Date(`${refIso}T00:00:00Z`).getTime();
  const dueUtc = new Date(`${rule.nextDueDate.slice(0, 10)}T00:00:00Z`).getTime();
  const daysUntilDue = Math.round((dueUtc - refUtc) / MS_PER_DAY);

  return {
    isDue: daysUntilDue <= 0,
    isOverdue: daysUntilDue < 0,
    daysUntilDue,
  };
}

function normalizeToMonthlyCents(
  amount: Money,
  frequency: RecurringFrequency,
  targetCurrency: CurrencyCode
): bigint {
  const inTarget = amount.currency === targetCurrency ? amount : amount.convertTo(targetCurrency);
  if (frequency === 'monthly') return inTarget.cents;
  if (frequency === 'quarterly') return inTarget.cents / 3n;
  return inTarget.cents / 12n;
}

/**
 * Summarizes monthly recurring SIP & EMI commitments and counts due/overdue rules.
 */
export function summarizeRecurringCommitments(
  rules: readonly RecurringTransactionRule[],
  targetCurrency: CurrencyCode = 'INR',
  referenceDate: Date = new Date()
): RecurringCommitmentsSummary {
  let sipCents = 0n;
  let emiCents = 0n;
  let dueCount = 0;
  let overdueCount = 0;

  for (const rule of rules) {
    if (!rule.isActive) continue;
    if (rule.category === 'sip') {
      sipCents += normalizeToMonthlyCents(rule.amount, rule.frequency, targetCurrency);
    } else if (rule.category === 'emi') {
      emiCents += normalizeToMonthlyCents(rule.amount, rule.frequency, targetCurrency);
    }
    const status = evaluateRecurringRuleStatus(rule, referenceDate);
    if (status.isDue) dueCount += 1;
    if (status.isOverdue) overdueCount += 1;
  }

  return {
    totalMonthlySip: Money.fromCents(sipCents, targetCurrency),
    totalMonthlyEmi: Money.fromCents(emiCents, targetCurrency),
    dueCount,
    overdueCount,
  };
}

/**
 * Advances a recurring rule's `lastPostedDate` and `nextDueDate` after posting a transaction.
 */
export function advanceRecurringRuleAfterPost(
  rule: RecurringTransactionRule,
  postedDateIso: string
): RecurringTransactionRule {
  return {
    ...rule,
    lastPostedDate: postedDateIso.slice(0, 10),
    nextDueDate: computeNextDueDate(rule.nextDueDate, rule.frequency, rule.dayOfMonth),
  };
}
