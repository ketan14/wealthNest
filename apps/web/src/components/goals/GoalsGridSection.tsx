import { useState } from 'react';
import { GoalCategory, GoalEvaluation } from '@wealthnest/domain';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatInr } from '@/utils/formatInr';
import { TopUpTargetGoal } from '@/components/goals/TopUpGoalModal';
import {
  Building2,
  Calendar,
  Car,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  HeartHandshake,
  Link2,
  Pencil,
  Plane,
  Plus,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  User,
} from 'lucide-react';

export type GoalStatusFilter = 'all' | 'on_track' | 'needs_boost' | 'completed';

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  emergency_fund: 'Emergency Fund',
  retirement: 'Retirement',
  home_purchase: 'Home',
  education: 'Education',
  wealth_creation: 'Wealth',
  vehicle: 'Vehicle',
  vacation: 'Vacation',
  other: 'Custom',
};

const CATEGORY_ICONS: Record<GoalCategory, typeof Target> = {
  emergency_fund: ShieldAlert,
  retirement: Target,
  home_purchase: Building2,
  education: GraduationCap,
  wealth_creation: Sparkles,
  vehicle: Car,
  vacation: Plane,
  other: HeartHandshake,
};

export function getGoalStatusMeta(evalResult: GoalEvaluation): {
  filterGroup: Exclude<GoalStatusFilter, 'all'>;
  label: string;
  badgeClass: string;
} {
  if (evalResult.status === 'achieved' || evalResult.isFunded) {
    return {
      filterGroup: 'completed',
      label: 'Completed',
      badgeClass: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    };
  }
  if (evalResult.status === 'on_track' || evalResult.status === 'ahead') {
    return {
      filterGroup: 'on_track',
      label: 'On Track',
      badgeClass: 'text-teal-400 border-teal-500/30 bg-teal-500/10',
    };
  }
  return {
    filterGroup: 'needs_boost',
    label: 'Needs Boost',
    badgeClass:
      evalResult.status === 'critical'
        ? 'text-rose-400 border-rose-500/30 bg-rose-500/10'
        : 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  };
}

interface GoalMemberRef {
  readonly id: string;
  readonly name: string;
  readonly colorHex?: string;
}

interface GoalsGridSectionProps {
  readonly evaluations: readonly GoalEvaluation[];
  readonly totalGoalsCount: number;
  readonly members: readonly GoalMemberRef[];
  readonly canEditFinancials?: boolean;
  readonly onTopUpGoal: (goal: TopUpTargetGoal) => void;
  readonly onEditGoal: (goalId: string) => void;
  readonly onDeleteGoal: (goal: { id: string; name: string }) => void;
  readonly onCreateGoal: () => void;
  readonly onResetFilters: () => void;
}

const toRupees = (cents: bigint) => Number(cents) / 100;

/**
 * Renders Active Financial Milestones with scannable 3-signal cards,
 * quick Top-Up / Edit / Delete actions, and clean empty states.
 */
export function GoalsGridSection({
  evaluations,
  totalGoalsCount,
  members,
  canEditFinancials = true,
  onTopUpGoal,
  onEditGoal,
  onDeleteGoal,
  onCreateGoal,
  onResetFilters,
}: GoalsGridSectionProps) {
  const [expandedGoalIds, setExpandedGoalIds] = useState<Record<string, boolean>>({});

  const toggleExpanded = (goalId: string) => {
    setExpandedGoalIds((prev) => ({ ...prev, [goalId]: !prev[goalId] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
          <Target className="w-5 h-5 text-primary shrink-0" />
          Active Financial Milestones
        </h3>
        <span className="text-xs text-muted-foreground font-mono">
          {evaluations.length} of {totalGoalsCount}
        </span>
      </div>

      {totalGoalsCount === 0 ? (
        <Card className="border-border/80 bg-card/60 backdrop-blur-md">
          <CardContent className="py-10 px-6 text-center space-y-3 max-w-md mx-auto">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
              <Target className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-foreground">No financial goals yet</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Create your first goal to track target dates, funded progress in INR, and the monthly
              SIP pace needed to stay on schedule.
            </p>
            <div className="pt-1">
              <Button
                type="button"
                onClick={onCreateGoal}
                disabled={!canEditFinancials}
                className="gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Create Goal
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : evaluations.length === 0 ? (
        <Card className="border-border/80 bg-card/60 backdrop-blur-md">
          <CardContent className="py-8 px-6 text-center space-y-3">
            <p className="text-sm font-semibold text-foreground">No goals match these filters</p>
            <p className="text-xs text-muted-foreground">
              Try clearing the status or category filter to view all {totalGoalsCount} tracked goals.
            </p>
            <div>
              <Button type="button" variant="outline" size="sm" onClick={onResetFilters}>
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {evaluations.map((evalResult) => {
            const goal = evalResult.goal;
            const Icon = CATEGORY_ICONS[goal.category] || Target;
            const statusMeta = getGoalStatusMeta(evalResult);
            const targetDateStr =
              goal.targetDate instanceof Date
                ? goal.targetDate.toISOString().split('T')[0]!
                : String(goal.targetDate);
            const beneficiary = goal.memberId
              ? members.find((m) => m.id === goal.memberId)
              : undefined;
            const currentCorpusRupees = toRupees(evalResult.currentTotalCorpus.cents);
            const targetRupees = toRupees(goal.targetAmount.cents);
            const futureTargetRupees = toRupees(evalResult.futureTargetAmount.cents);
            const committedSipRupees = toRupees(goal.monthlyContribution.cents);
            const requiredSipRupees = toRupees(evalResult.requiredMonthlySip.cents);
            const shortfallRupees = toRupees(evalResult.monthlySipShortfall.cents);
            const projectedRupees = toRupees(evalResult.projectedCorpusAtTarget.cents);
            const hasSharedBucket = goal.linkedHoldings.some((l) => l.allocationPercentage < 100);
            const isExpanded = Boolean(expandedGoalIds[goal.id]);

            return (
              <Card
                key={goal.id}
                className="border-border/80 bg-card/60 backdrop-blur-md hover:border-primary/40 transition-all flex flex-col justify-between"
              >
                {/* Signal 1: Header (Title, Category, Target Date, Status Pill) */}
                <CardHeader className="p-4 pb-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm sm:text-base text-foreground leading-snug truncate">
                          {goal.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-border/70 text-muted-foreground"
                          >
                            {GOAL_CATEGORY_LABELS[goal.category] || 'Custom'}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3" />
                            {targetDateStr} · {evalResult.monthsRemaining}m
                          </span>
                          {goal.memberId && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0 rounded-full border"
                              style={{
                                backgroundColor: `${beneficiary?.colorHex || '#3b82f6'}15`,
                                color: beneficiary?.colorHex || '#3b82f6',
                                borderColor: `${beneficiary?.colorHex || '#3b82f6'}30`,
                              }}
                            >
                              <User className="w-2.5 h-2.5" />
                              {beneficiary?.name || 'Member'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${statusMeta.badgeClass}`}
                    >
                      {statusMeta.label}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-3">
                  {/* Signal 2: Progress Bar + Current Funded vs Target */}
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-mono font-bold text-foreground">
                        {formatInr(currentCorpusRupees, { compact: true })}{' '}
                        <span className="text-muted-foreground font-normal">
                          / {formatInr(targetRupees, { compact: true })}
                        </span>
                      </span>
                      <span className="font-mono font-bold text-emerald-400">
                        {evalResult.fundedPercentage.toFixed(1)}%
                      </span>
                    </div>

                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          statusMeta.filterGroup === 'completed'
                            ? 'bg-emerald-400'
                            : statusMeta.filterGroup === 'on_track'
                              ? 'bg-teal-400'
                              : 'bg-amber-400'
                        }`}
                        style={{ width: `${Math.min(100, evalResult.fundedPercentage)}%` }}
                      />
                    </div>
                  </div>

                  {/* Signal 3: Pace & Allocation Clarity */}
                  <div className="p-2.5 rounded-xl bg-accent/20 border border-border/60 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase">
                          Committed SIP
                        </span>
                        <span className="font-bold text-foreground">
                          {formatInr(committedSipRupees, { compact: true })}/mo
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground block text-[10px] uppercase">
                          Required Monthly
                        </span>
                        <span
                          className={`font-bold ${
                            shortfallRupees <= 0 ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {formatInr(requiredSipRupees, { compact: true })}/mo
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-border/40">
                      <span className="text-muted-foreground truncate">
                        {statusMeta.filterGroup === 'completed'
                          ? 'Target corpus achieved'
                          : shortfallRupees > 0
                            ? `Gap: +${formatInr(shortfallRupees, { compact: true })}/mo`
                            : `Projected: ${formatInr(projectedRupees, { compact: true })}`}
                      </span>
                      <span className="text-muted-foreground font-mono shrink-0 inline-flex items-center gap-1">
                        <Link2 className="w-3 h-3" />
                        {goal.linkedHoldings.length > 0
                          ? `${goal.linkedHoldings.length} linked${hasSharedBucket ? ' · shared' : ''}`
                          : 'Unlinked'}
                      </span>
                    </div>
                  </div>

                  {/* Card Actions + Optional Expandable Notes */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canEditFinancials}
                        onClick={() =>
                          onTopUpGoal({
                            id: goal.id,
                            name: goal.name,
                            currentSavedCents: Number(goal.initialSaved.cents),
                            currentTotalCorpusCents: Number(evalResult.currentTotalCorpus.cents),
                            targetAmountCents: Number(goal.targetAmount.cents),
                          })
                        }
                        className="h-7 px-2.5 text-xs gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Top Up
                      </Button>

                      <button
                        type="button"
                        onClick={() => onEditGoal(goal.id)}
                        disabled={!canEditFinancials}
                        aria-label={`Edit goal ${goal.name}`}
                        title={canEditFinancials ? 'Edit Goal' : 'View-only role'}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteGoal({ id: goal.id, name: goal.name })}
                        disabled={!canEditFinancials}
                        aria-label={`Delete goal ${goal.name}`}
                        title={canEditFinancials ? 'Delete Goal' : 'View-only role'}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpanded(goal.id)}
                      className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-accent/40 transition-colors"
                    >
                      {isExpanded ? 'Hide' : 'Details'}
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="pt-2 border-t border-border/50 space-y-2 text-[11px] text-muted-foreground">
                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                        <span>
                          Inflation Target ({goal.inflationRate}%):{' '}
                          <b className="text-foreground">
                            {formatInr(futureTargetRupees, { compact: true })}
                          </b>
                        </span>
                        <span>Assumed Return: {goal.expectedReturnRate}% p.a.</span>
                      </div>

                      {goal.linkedHoldings.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {goal.linkedHoldings.map((link) => (
                            <Badge
                              key={link.holdingId}
                              variant="outline"
                              className="text-[10px] border-border/70 text-foreground"
                            >
                              {link.holdingName} · {link.allocationPercentage}%
                            </Badge>
                          ))}
                        </div>
                      )}

                      {goal.notes && <p className="italic text-muted-foreground">"{goal.notes}"</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
