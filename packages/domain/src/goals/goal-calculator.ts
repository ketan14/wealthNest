import { Money } from '../money/money.js';
import { CurrencyCode } from '../money/currency.js';
import {
  GoalDefinition,
  GoalEvaluation,
  GoalHealthStatus,
  GoalsSummary,
  EmergencyFundRunway,
} from './goal-types.js';

/**
 * Calculates remaining months between now and target date.
 */
export function calculateMonthsRemaining(targetDate: Date, fromDate: Date = new Date()): number {
  const yearsDiff = targetDate.getFullYear() - fromDate.getFullYear();
  const monthsDiff = targetDate.getMonth() - fromDate.getMonth();
  const totalMonths = yearsDiff * 12 + monthsDiff;
  return Math.max(1, totalMonths);
}

/**
 * Calculates future value given inflation rate over a number of months.
 */
export function calculateInflationAdjustedTarget(
  targetAmount: Money,
  inflationRate: number,
  months: number
): Money {
  if (inflationRate <= 0 || months <= 0) {
    return targetAmount;
  }

  const years = months / 12;
  const factor = Math.pow(1 + inflationRate / 100, years);
  const targetCents = Number(targetAmount.cents);
  const adjustedCents = BigInt(Math.round(targetCents * factor));

  return Money.fromCents(adjustedCents, targetAmount.currency);
}

/**
 * Evaluates an individual financial goal.
 */
export function evaluateGoal(goal: GoalDefinition, evaluationDate: Date = new Date()): GoalEvaluation {
  const currency = goal.currency;
  const months = calculateMonthsRemaining(goal.targetDate, evaluationDate);

  // 1. Current total corpus (initial savings + sum of linked holdings)
  let currentCorpus = goal.initialSaved;
  for (const link of goal.linkedHoldings) {
    const val = link.allocatedValue.currency === currency
      ? link.allocatedValue
      : link.allocatedValue.convertTo(currency);
    currentCorpus = currentCorpus.add(val);
  }

  // 2. Inflation-adjusted future target amount
  const futureTarget = calculateInflationAdjustedTarget(goal.targetAmount, goal.inflationRate, months);

  // 3. Funded percentage
  let fundedPercentage = 0;
  if (goal.targetAmount.cents > 0n) {
    fundedPercentage = Number((currentCorpus.cents * 10000n) / goal.targetAmount.cents) / 100;
  }

  // 4. Monthly compound rate r
  const annualReturn = goal.expectedReturnRate;
  const monthlyRate = annualReturn > 0 ? annualReturn / (12 * 100) : 0;

  // 5. Future value of current corpus: FV = PV * (1 + r)^m
  const currentCents = Number(currentCorpus.cents);
  const fvCurrentCents = monthlyRate > 0
    ? currentCents * Math.pow(1 + monthlyRate, months)
    : currentCents;

  // 6. Future value of ongoing monthly SIP: FV_sip = PMT * ((1+r)^m - 1)/r * (1+r)
  const monthlySipCents = Number(goal.monthlyContribution.cents);
  let fvSipCents = 0;
  if (monthlySipCents > 0) {
    if (monthlyRate > 0) {
      const annuityFactor = ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
      fvSipCents = monthlySipCents * annuityFactor;
    } else {
      fvSipCents = monthlySipCents * months;
    }
  }

  const projectedTotalCents = BigInt(Math.max(0, Math.round(fvCurrentCents + fvSipCents)));
  const projectedCorpus = Money.fromCents(projectedTotalCents, currency);

  // 7. Calculate required monthly SIP to bridge any gap to future target
  const futureTargetCents = Number(futureTarget.cents);
  const gapCents = Math.max(0, futureTargetCents - fvCurrentCents);

  let requiredSipCents = 0n;
  if (gapCents > 0 && months > 0) {
    if (monthlyRate > 0) {
      const annuityFactor = ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
      requiredSipCents = BigInt(Math.max(0, Math.round(gapCents / annuityFactor)));
    } else {
      requiredSipCents = BigInt(Math.max(0, Math.round(gapCents / months)));
    }
  }

  const requiredMonthlySip = Money.fromCents(requiredSipCents, currency);

  // Monthly shortfall
  const shortfallCents = requiredSipCents > goal.monthlyContribution.cents
    ? requiredSipCents - goal.monthlyContribution.cents
    : 0n;
  const monthlySipShortfall = Money.fromCents(shortfallCents, currency);

  // 8. Determine health status
  const isFunded = currentCorpus.cents >= goal.targetAmount.cents;
  let status: GoalHealthStatus = 'on_track';

  if (isFunded) {
    status = 'achieved';
  } else if (projectedTotalCents >= futureTargetCents * 1.1) {
    status = 'ahead';
  } else if (projectedTotalCents >= futureTargetCents * 0.92) {
    status = 'on_track';
  } else if (projectedTotalCents >= futureTargetCents * 0.65) {
    status = 'behind';
  } else {
    status = 'critical';
  }

  return {
    goal,
    monthsRemaining: months,
    currentTotalCorpus: currentCorpus,
    futureTargetAmount: futureTarget,
    fundedPercentage,
    requiredMonthlySip,
    monthlySipShortfall,
    projectedCorpusAtTarget: projectedCorpus,
    status,
    isFunded,
  };
}

/**
 * Calculates complete Goals Summary and Emergency Fund Runway metrics.
 */
export function calculateGoalsSummary(
  goals: readonly GoalDefinition[],
  liquidCashCorpus: Money,
  monthlyExpenses: Money,
  currency: CurrencyCode = 'INR'
): GoalsSummary {
  let totalTarget = Money.zero(currency);
  let totalCurrent = Money.zero(currency);
  let totalCommitted = Money.zero(currency);
  let totalRequired = Money.zero(currency);
  let onTrackCount = 0;

  const evaluations: GoalEvaluation[] = [];

  for (const g of goals) {
    const evalResult = evaluateGoal(g);
    evaluations.push(evalResult);

    totalTarget = totalTarget.add(evalResult.futureTargetAmount);
    totalCurrent = totalCurrent.add(evalResult.currentTotalCorpus);
    totalCommitted = totalCommitted.add(g.monthlyContribution);
    totalRequired = totalRequired.add(evalResult.requiredMonthlySip);

    if (evalResult.status === 'on_track' || evalResult.status === 'ahead' || evalResult.status === 'achieved') {
      onTrackCount++;
    }
  }

  let overallPercentage = 0;
  if (totalTarget.cents > 0n) {
    overallPercentage = Number((totalCurrent.cents * 10000n) / totalTarget.cents) / 100;
  }

  // Emergency Fund Runway
  // 6 months of expenses recommended in India
  const recommendedCents = monthlyExpenses.cents * 6n;
  const recommendedTarget = Money.fromCents(recommendedCents, currency);

  let monthsRunway = 0;
  if (monthlyExpenses.cents > 0n) {
    monthsRunway = Number((liquidCashCorpus.cents * 100n) / monthlyExpenses.cents) / 100;
  }

  let efStatus: 'adequate' | 'warning' | 'critical' = 'adequate';
  if (monthsRunway < 3) {
    efStatus = 'critical';
  } else if (monthsRunway < 6) {
    efStatus = 'warning';
  }

  const emergencyFund: EmergencyFundRunway = {
    liquidCorpus: liquidCashCorpus,
    monthlyExpenses,
    monthsRunway,
    status: efStatus,
    recommendedTargetCorpus: recommendedTarget,
  };

  return {
    totalTargetCorpus: totalTarget,
    totalCurrentCorpus: totalCurrent,
    totalMonthlyCommittedSip: totalCommitted,
    totalRequiredMonthlySip: totalRequired,
    overallFundedPercentage: overallPercentage,
    goalsOnTrackCount: onTrackCount,
    totalGoalsCount: goals.length,
    emergencyFund,
    goals: evaluations,
  };
}
