import { GoalsSummary } from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { KpiMetricCard, WEALTH_KPI_GRID, getPolarityTone } from '@/components/ui/DashboardPrimitives';
import { formatInr } from '@/utils/formatInr';
import { usePrivacy } from '@/lib/preferences/privacy-context';
import { ShieldAlert, Target, TrendingUp, Wallet } from 'lucide-react';

interface GoalsKpiSectionProps {
  readonly summary: GoalsSummary;
  readonly monthlyExpenseRupees: number;
  readonly onMonthlyExpenseChange: (value: number) => void;
}

const toRupees = (cents: bigint) => Number(cents) / 100;

/**
 * Renders the top 4 Financial Goals KPI cards (2x2 mobile, 4-col desktop)
 * and the Emergency Reserve Burn Rate Analyzer.
 */
export function GoalsKpiSection({
  summary,
  monthlyExpenseRupees,
  onMonthlyExpenseChange,
}: GoalsKpiSectionProps) {
  const { maskAmount } = usePrivacy();
  const totalTargetRupees = toRupees(summary.totalTargetCorpus.cents);
  const totalCurrentRupees = toRupees(summary.totalCurrentCorpus.cents);
  const totalCommittedRupees = toRupees(summary.totalMonthlyCommittedSip.cents);
  const totalRequiredRupees = toRupees(summary.totalRequiredMonthlySip.cents);
  const liquidCorpusRupees = toRupees(summary.emergencyFund.liquidCorpus.cents);

  const fundedTone = getPolarityTone(summary.overallFundedPercentage);
  const runwayMonths = summary.emergencyFund.monthsRunway;
  const runwayTextClass =
    runwayMonths === 0
      ? 'text-foreground'
      : runwayMonths >= 6
        ? 'text-emerald-400'
        : runwayMonths >= 3
          ? 'text-amber-400'
          : 'text-rose-400';

  return (
    <>
      {/* Top 4 KPI Cards (2x2 mobile, 4-across desktop) */}
      <div className={WEALTH_KPI_GRID}>
        {/* Card 1: Emergency Runway */}
        <KpiMetricCard
          label="Emergency Runway"
          icon={<ShieldAlert className="w-4 h-4 text-emerald-400" />}
          displayValue={
            <span className={runwayTextClass}>
              {`${runwayMonths.toFixed(1)} Mos`}
            </span>
          }
          subtext={`Liquid: ${maskAmount(formatInr(liquidCorpusRupees, { compact: true }))}`}
          badge={
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 whitespace-nowrap ${
                runwayMonths >= 6
                  ? 'text-emerald-400 border-emerald-500/30'
                  : runwayMonths >= 3
                    ? 'text-amber-400 border-amber-500/30'
                    : 'text-rose-400 border-rose-500/30'
              }`}
            >
              {runwayMonths >= 6 ? 'Optimal Buffer' : 'Action Needed'}
            </Badge>
          }
        />

        {/* Card 2: Total Target Corpus */}
        <KpiMetricCard
          label="Target Corpus Sum"
          icon={<Target className="w-4 h-4 text-blue-400" />}
          amountRupees={totalTargetRupees}
          subtext={`${summary.totalGoalsCount} active ${
            summary.totalGoalsCount === 1 ? 'goal' : 'goals'
          }`}
          badge={
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 text-blue-400 border-blue-500/30 whitespace-nowrap hidden sm:inline-flex"
            >
              {summary.totalGoalsCount} Active
            </Badge>
          }
        />

        {/* Card 3: Current Funded Corpus */}
        <KpiMetricCard
          label="Accumulated Corpus"
          icon={<Wallet className="w-4 h-4 text-purple-400" />}
          amountRupees={totalCurrentRupees}
          subtext="Total funded progress"
          badge={
            <span className={`text-[11px] font-mono font-bold ${fundedTone.text}`}>
              {summary.overallFundedPercentage.toFixed(1)}%
            </span>
          }
        />

        {/* Card 4: Monthly SIP Commitment & Required Pace */}
        <KpiMetricCard
          label="Committed Monthly SIP"
          icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
          displayValue={
            <span className="text-foreground">
              {maskAmount(`${formatInr(totalCommittedRupees, { compact: true })}/m`)}
            </span>
          }
          subtext={`Required Pace: ${maskAmount(
            `${formatInr(totalRequiredRupees, { compact: true })}/m`
          )}`}
          badge={
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 whitespace-nowrap ${
                summary.totalGoalsCount === 0
                  ? 'text-muted-foreground border-border/60'
                  : 'text-emerald-400 border-emerald-500/30'
              }`}
            >
              {summary.goalsOnTrackCount}/{summary.totalGoalsCount} On Track
            </Badge>
          }
        />
      </div>

      {/* Emergency Fund Interactive Burn Rate Section */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-md">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
                Emergency Reserve Buffer & Burn Rate Analyzer
              </CardTitle>
              <CardDescription className="text-xs mt-0.5 hidden sm:block">
                Maintain 3 to 6 months of mandatory living expenses in liquid cash or arbitrage funds.
              </CardDescription>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2.5">
              <span className="text-xs text-muted-foreground font-medium">
                Monthly Expense:
              </span>
              <div className="px-3 py-1 bg-accent/40 rounded-xl border border-border/80 text-xs font-mono font-bold text-foreground whitespace-nowrap">
                {maskAmount(formatInr(monthlyExpenseRupees))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
          {/* Progress bar visual */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">
                Current Buffer:{' '}
                <b className="text-foreground">
                  {maskAmount(formatInr(liquidCorpusRupees, { compact: true }))}
                </b>
              </span>
              <span className="text-muted-foreground">
                6-Mo Target:{' '}
                <b className="text-emerald-400">
                  {maskAmount(formatInr(monthlyExpenseRupees * 6, { compact: true }))}
                </b>
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden relative">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  summary.emergencyFund.monthsRunway >= 6
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : summary.emergencyFund.monthsRunway >= 3
                      ? 'bg-amber-400'
                      : 'bg-rose-500'
                }`}
                style={{
                  width: `${Math.min(100, (summary.emergencyFund.monthsRunway / 6) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Interactive expense slider */}
          <div className="pt-1 flex items-center gap-3 text-xs">
            <span className="text-muted-foreground flex-shrink-0">Monthly Burn:</span>
            <input
              type="range"
              min="20000"
              max="250000"
              step="5000"
              aria-label="Simulate monthly living expense"
              value={monthlyExpenseRupees}
              onChange={(e) => onMonthlyExpenseChange(parseInt(e.target.value, 10))}
              className="w-full accent-primary h-1.5 bg-secondary rounded-lg cursor-pointer"
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
