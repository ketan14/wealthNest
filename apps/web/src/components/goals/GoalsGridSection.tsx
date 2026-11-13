import { GoalCategory, GoalsSummary } from '@wealthnest/domain';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Building2,
  Calendar,
  Car,
  GraduationCap,
  HeartHandshake,
  Plane,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  User,
} from 'lucide-react';

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

interface GoalMemberRef {
  readonly id: string;
  readonly name: string;
  readonly colorHex?: string;
}

interface GoalsGridSectionProps {
  readonly summary: GoalsSummary;
  readonly members: readonly GoalMemberRef[];
  readonly onDeleteGoal: (goal: { id: string; name: string }) => void;
}

/**
 * Renders the Active Financial Milestones grid with funded progress bars,
 * inflation-adjusted targets, and committed vs. required monthly SIP comparisons.
 */
export function GoalsGridSection({
  summary,
  members,
  onDeleteGoal,
}: GoalsGridSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Active Financial Milestones
        </h3>
        <span className="text-xs text-muted-foreground">
          {summary.goals.length} milestones tracked
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {summary.goals.map((evalResult) => {
          const goal = evalResult.goal;
          const Icon = CATEGORY_ICONS[goal.category] || Target;
          const targetMoney = goal.targetAmount;
          const futureTargetMoney = evalResult.futureTargetAmount;
          const currentCorpusMoney = evalResult.currentTotalCorpus;
          const monthlySipMoney = goal.monthlyContribution;
          const requiredSipMoney = evalResult.requiredMonthlySip;
          const targetDateStr =
            goal.targetDate instanceof Date
              ? goal.targetDate.toISOString().split('T')[0]!
              : String(goal.targetDate);
          const beneficiary = goal.memberId
            ? members.find((m) => m.id === goal.memberId)
            : undefined;

          return (
            <Card
              key={goal.id}
              className="border-border/80 bg-card/60 backdrop-blur-md hover:border-primary/40 transition-all flex flex-col justify-between"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0 mt-0.5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base text-foreground leading-snug">
                          {goal.name}
                        </h4>
                        {goal.memberId && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                            style={{
                              backgroundColor: `${beneficiary?.colorHex || '#3b82f6'}15`,
                              color: beneficiary?.colorHex || '#3b82f6',
                              borderColor: `${beneficiary?.colorHex || '#3b82f6'}30`,
                            }}
                          >
                            <User className="w-2.5 h-2.5" />
                            {beneficiary?.name || 'Beneficiary'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5" />
                          {targetDateStr}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          ({evalResult.monthsRemaining} mos remaining)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize font-bold ${
                        evalResult.status === 'achieved'
                          ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                          : evalResult.status === 'ahead'
                            ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                            : evalResult.status === 'on_track'
                              ? 'text-teal-400 border-teal-500/30 bg-teal-500/10'
                              : evalResult.status === 'behind'
                                ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                                : 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                      }`}
                    >
                      {evalResult.status.replace('_', ' ')}
                    </Badge>

                    <button
                      onClick={() => onDeleteGoal(goal)}
                      className="p-1 rounded text-muted-foreground hover:text-rose-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                      title="Delete Goal"
                      aria-label={`Delete goal ${goal.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-1">
                {/* Funded Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground">
                      Accumulated:{' '}
                      <b className="text-foreground">
                        {currentCorpusMoney.formatIndianCompact()}
                      </b>
                    </span>
                    <span className="text-muted-foreground">
                      Target: <b className="text-foreground">{targetMoney.formatIndianCompact()}</b>
                    </span>
                  </div>

                  <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        evalResult.isFunded ? 'bg-emerald-400' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(100, evalResult.fundedPercentage)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      Funded:{' '}
                      <b className="text-emerald-400 font-mono">
                        {evalResult.fundedPercentage.toFixed(1)}%
                      </b>
                    </span>
                    {goal.inflationRate > 0 && (
                      <span>
                        Inflation-adjusted target ({goal.inflationRate}% p.a.):{' '}
                        <b className="text-foreground font-mono">
                          {futureTargetMoney.formatIndianCompact()}
                        </b>
                      </span>
                    )}
                  </div>
                </div>

                {/* Monthly SIP Breakdown */}
                <div className="p-3 rounded-xl bg-accent/20 border border-border/60 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">
                      Committed SIP
                    </span>
                    <span className="font-bold text-foreground text-sm">
                      {monthlySipMoney.formatIndianCompact()}/mo
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-muted-foreground block text-[10px] uppercase">
                      Required SIP
                    </span>
                    <span
                      className={`font-bold text-sm ${
                        monthlySipMoney.cents >= requiredSipMoney.cents
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {requiredSipMoney.formatIndianCompact()}/mo
                    </span>
                  </div>
                </div>

                {goal.notes && (
                  <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-2">
                    "{goal.notes}"
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

