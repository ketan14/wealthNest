import { GoalsSummary } from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
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

  return (
    <>
      {/* Top 4 KPI Cards (2x2 mobile, 4-across desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Emergency Runway */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="p-3 sm:p-5 pb-1.5 sm:pb-2">
            <div className="flex items-center justify-between gap-1 text-muted-foreground">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">
                Emergency Runway
              </span>
              <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-0 space-y-1.5">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl xl:text-3xl font-extrabold tracking-tight text-emerald-400 font-mono">
                {`${summary.emergencyFund.monthsRunway.toFixed(1)} Mos`}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 whitespace-nowrap ${
                  summary.emergencyFund.monthsRunway >= 6
                    ? 'text-emerald-400 border-emerald-500/30'
                    : summary.emergencyFund.monthsRunway >= 3
                      ? 'text-amber-400 border-amber-500/30'
                      : 'text-rose-400 border-rose-500/30'
                }`}
              >
                {summary.emergencyFund.monthsRunway >= 6 ? 'Optimal Buffer' : 'Action Needed'}
              </Badge>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
              Liquid:{' '}
              <span className="font-semibold text-foreground font-mono">
                {maskAmount(formatInr(liquidCorpusRupees, { compact: true }))}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Target Corpus */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="p-3 sm:p-5 pb-1.5 sm:pb-2">
            <div className="flex items-center justify-between gap-1 text-muted-foreground">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">
                Target Corpus Sum
              </span>
              <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-0 space-y-1.5">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl xl:text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {maskAmount(formatInr(totalTargetRupees, { compact: true }))}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 text-blue-400 border-blue-500/30 whitespace-nowrap hidden sm:inline-flex"
              >
                {summary.totalGoalsCount} Active
              </Badge>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
              <span className="font-semibold text-foreground">{summary.totalGoalsCount}</span> active{' '}
              {summary.totalGoalsCount === 1 ? 'goal' : 'goals'}
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Current Funded Corpus */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="p-3 sm:p-5 pb-1.5 sm:pb-2">
            <div className="flex items-center justify-between gap-1 text-muted-foreground">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">
                Accumulated Corpus
              </span>
              <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-0 space-y-1.5">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl xl:text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {maskAmount(formatInr(totalCurrentRupees, { compact: true }))}
              </span>
              <span className="text-[11px] sm:text-xs text-emerald-400 font-mono font-bold">
                {summary.overallFundedPercentage.toFixed(1)}%
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
              Total funded progress
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Monthly SIP Commitment & Required Pace */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="p-3 sm:p-5 pb-1.5 sm:pb-2">
            <div className="flex items-center justify-between gap-1 text-muted-foreground">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate">
                Committed Monthly SIP
              </span>
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-0 space-y-1.5">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl xl:text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {maskAmount(`${formatInr(totalCommittedRupees, { compact: true })}/m`)}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 text-emerald-400 border-emerald-500/30 whitespace-nowrap"
              >
                {summary.goalsOnTrackCount}/{summary.totalGoalsCount} On Track
              </Badge>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
              Required Pace:{' '}
              <span className="font-semibold text-foreground font-mono">
                {maskAmount(`${formatInr(totalRequiredRupees, { compact: true })}/m`)}
              </span>
            </p>
          </CardContent>
        </Card>
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
