import { useState, useMemo } from 'react';
import { TrendingUp, Sparkles } from 'lucide-react';
import { Money, projectGoalMilestoneCurve } from '@wealthnest/domain';
import { GoalDetailDto } from '@wealthnest/application';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AccessibleChartContainer } from '@/components/ui/AccessibleChartContainer';

interface GoalProjectionCardProps {
  goals: readonly GoalDetailDto[];
}

const STEP_UP_OPTIONS = [0, 5, 10, 15] as const;

export function GoalProjectionCard({ goals }: GoalProjectionCardProps) {
  const [selectedGoalId, setSelectedGoalId] = useState<string>(() => goals[0]?.id || '');
  const [stepUpRatePct, setStepUpRatePct] = useState<number>(10);

  const activeGoal = useMemo(() => {
    return goals.find((g) => g.id === selectedGoalId) || goals[0] || null;
  }, [goals, selectedGoalId]);

  const projection = useMemo(() => {
    if (!activeGoal) return null;

    const targetDate = new Date(activeGoal.targetDate);
    const now = new Date();
    const yearsRemaining = Math.max(
      1,
      Math.round((targetDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    );

    const linkedValuePaise = activeGoal.linkedHoldings.reduce(
      (sum, link) => sum + BigInt(Math.round(link.currentValueCents || 0)),
      0n
    );

    return projectGoalMilestoneCurve({
      currentCorpusPaise: BigInt(Math.round(activeGoal.initialSavedCents || 0)) + linkedValuePaise,
      targetTodayPaise: BigInt(Math.round(activeGoal.targetAmountCents || 0)),
      monthlySipPaise: BigInt(Math.round(activeGoal.monthlyContributionCents || 0)),
      yearsRemaining,
      expectedReturnPct: activeGoal.expectedReturnRate || 12,
      inflationRatePct: activeGoal.inflationRate || 6,
      stepUpRatePct,
      startYear: now.getFullYear(),
    });
  }, [activeGoal, stepUpRatePct]);

  if (!activeGoal || !projection) return null;

  const chartWidth = 720;
  const chartHeight = 240;
  const padX = 36;
  const padY = 24;

  const maxPaise = projection.points.reduce((max, p) => {
    const localMax =
      p.stepUpSipCorpusPaise > p.inflationAdjustedTargetPaise
        ? p.stepUpSipCorpusPaise
        : p.inflationAdjustedTargetPaise;
    return localMax > max ? localMax : max;
  }, 1n);

  const count = projection.points.length;
  const coords = projection.points.map((pt, idx) => {
    const x = padX + (count > 1 ? (idx / (count - 1)) * (chartWidth - padX * 2) : 0);
    const toY = (val: bigint) =>
      chartHeight - padY - (Number(val) / Number(maxPaise)) * (chartHeight - padY * 2);

    return {
      x,
      yStepUp: toY(pt.stepUpSipCorpusPaise),
      yFlat: toY(pt.flatSipCorpusPaise),
      yTarget: toY(pt.inflationAdjustedTargetPaise),
      point: pt,
    };
  });

  const buildPath = (pickY: (c: (typeof coords)[number]) => number) =>
    coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${pickY(c).toFixed(1)}`, '');

  const stepUpPath = buildPath((c) => c.yStepUp);
  const flatPath = buildPath((c) => c.yFlat);
  const targetPath = buildPath((c) => c.yTarget);

  const finalStepUpMoney = Money.fromCents(projection.finalStepUpCorpusPaise, 'INR');
  const finalTargetMoney = Money.fromCents(projection.finalInflationTargetPaise, 'INR');
  const advantageMoney = Money.fromCents(projection.stepUpAdvantagePaise, 'INR');

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-md">
      <CardHeader className="pb-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">
                Milestone Projection Curve & Step-Up SIP Simulator
              </CardTitle>
              <CardDescription>
                Year-by-year compounding vs inflation-adjusted target corpus
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select goal to project"
              value={activeGoal.id}
              onChange={(e) => setSelectedGoalId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  Project: {g.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
              {STEP_UP_OPTIONS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setStepUpRatePct(pct)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    stepUpRatePct === pct
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  +{pct}%/yr
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-secondary/30 border border-border/60">
            <div className="text-[11px] text-muted-foreground">Projected Step-Up Corpus</div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
              {finalStepUpMoney.formatIndianCompact()}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-secondary/30 border border-border/60">
            <div className="text-[11px] text-muted-foreground">Inflation-Adjusted Target</div>
            <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
              {finalTargetMoney.formatIndianCompact()}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-secondary/30 border border-border/60 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                Step-Up Wealth Boost
              </div>
              <div className="text-lg font-bold font-mono text-cyan-400 mt-0.5">
                +{advantageMoney.formatIndianCompact()}
              </div>
            </div>
            <Badge variant={projection.isStepUpOnTrack ? 'success' : 'outline'}>
              {projection.isStepUpOnTrack ? 'On Track' : 'Shortfall'}
            </Badge>
          </div>
        </div>

        {/* Accessible SVG Curve */}
        <AccessibleChartContainer
          title={`${activeGoal.name} Projection Curve`}
          description="Step-up SIP corpus vs flat SIP corpus vs inflation-adjusted target"
          headers={['Year', 'Step-Up Corpus', 'Flat SIP Corpus', 'Target']}
          rows={projection.points.map((pt) => ({
            label: String(pt.calendarYear),
            values: [
              Money.fromCents(pt.stepUpSipCorpusPaise, 'INR').formatIndianCompact(),
              Money.fromCents(pt.flatSipCorpusPaise, 'INR').formatIndianCompact(),
              Money.fromCents(pt.inflationAdjustedTargetPaise, 'INR').formatIndianCompact(),
            ],
          }))}
        >
          <div className="w-full overflow-x-auto">
            <svg
              role="img"
              aria-label={`${activeGoal.name} milestone projection chart`}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full max-w-full h-auto select-none"
            >
              <title>{activeGoal.name} Projection Curve</title>
              <path
                d={targetPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              <path
                d={flatPath}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <path
                d={stepUpPath}
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </AccessibleChartContainer>

        <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground pt-1">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full bg-emerald-400" />
            Step-Up SIP (+{stepUpRatePct}%/yr)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-cyan-400" />
            Flat SIP
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-amber-400" />
            Inflation-Adjusted Target
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
