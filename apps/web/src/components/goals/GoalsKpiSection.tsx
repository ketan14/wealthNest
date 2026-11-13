import { GoalsSummary, Money } from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ShieldAlert, Target, TrendingUp, Wallet } from 'lucide-react';

interface GoalsKpiSectionProps {
  readonly summary: GoalsSummary;
  readonly currencySymbol: string;
  readonly locale: string;
  readonly monthlyExpenseRupees: number;
  readonly onMonthlyExpenseChange: (value: number) => void;
}

/**
 * Renders the top 4 Financial Goals KPI cards and the Emergency Reserve Burn Rate Analyzer.
 */
export function GoalsKpiSection({
  summary,
  currencySymbol,
  locale,
  monthlyExpenseRupees,
  onMonthlyExpenseChange,
}: GoalsKpiSectionProps) {
  const totalTargetMoney = summary.totalTargetCorpus;
  const totalCurrentMoney = summary.totalCurrentCorpus;
  const totalCommittedMoney = summary.totalMonthlyCommittedSip;
  const liquidCorpusMoney = summary.emergencyFund.liquidCorpus;

  return (
    <>
      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Emergency Runway */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Emergency Runway
              </span>
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-emerald-400 font-mono">
                {`${summary.emergencyFund.monthsRunway.toFixed(1)} Mos`}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] ${
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
            <p className="text-xs text-muted-foreground">
              Liquid Cash:{' '}
              <span className="font-semibold text-foreground font-mono">
                {liquidCorpusMoney.formatIndianCompact()}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Target Corpus */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Target Corpus Sum
              </span>
              <Target className="w-4 h-4 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {totalTargetMoney.formatIndianCompact()}
              </span>
              <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">
                Future Value
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Across{' '}
              <span className="font-semibold text-foreground">
                {summary.totalGoalsCount} active milestones
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Current Funded Corpus */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Accumulated Corpus
              </span>
              <Wallet className="w-4 h-4 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {totalCurrentMoney.formatIndianCompact()}
              </span>
              <span className="text-xs text-emerald-400 font-mono font-bold">
                ({summary.overallFundedPercentage.toFixed(1)}%)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Funded of overall target requirements</p>
          </CardContent>
        </Card>

        {/* Card 4: Monthly SIP Commitment */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Committed Monthly SIP
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {totalCommittedMoney.formatIndianCompact()}/m
              </span>
              <Badge
                variant="outline"
                className="text-[10px] text-emerald-400 border-emerald-500/30"
              >
                {summary.goalsOnTrackCount}/{summary.totalGoalsCount} On Track
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              Required SIP:{' '}
              <span className="font-semibold text-foreground font-mono">
                {Money.fromCents(
                  BigInt(summary.totalRequiredMonthlySip.cents || '0'),
                  'INR'
                ).formatIndianCompact()}
                /m
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Emergency Fund Interactive Burn Rate Section */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-md">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-emerald-400" />
                Emergency Reserve Buffer & Burn Rate Analyzer
              </CardTitle>
              <CardDescription className="text-xs">
                Indian personal finance guideline recommends maintaining 3 to 6 months of mandatory
                living expenses in liquid cash or overnight arbitrage funds.
              </CardDescription>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-medium">
                Monthly Living Expense:
              </span>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-accent/40 rounded-xl border border-border/80 text-xs font-mono font-bold text-foreground">
                <span>{currencySymbol}</span>
                <span>{monthlyExpenseRupees.toLocaleString(locale)}</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress bar visual */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">
                Current Buffer:{' '}
                <b className="text-foreground">{liquidCorpusMoney.formatIndianCompact()}</b>
              </span>
              <span className="text-muted-foreground">
                6-Month Target:{' '}
                <b className="text-emerald-400">
                  {Money.fromDecimal(monthlyExpenseRupees * 6, 'INR').formatIndianCompact()}
                </b>
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-3 overflow-hidden relative">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
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
          <div className="pt-2 flex items-center gap-4 text-xs">
            <span className="text-muted-foreground flex-shrink-0">Simulate Monthly Burn:</span>
            <input
              type="range"
              min="20000"
              max="250000"
              step="5000"
              value={monthlyExpenseRupees}
              onChange={(e) => onMonthlyExpenseChange(parseInt(e.target.value))}
              className="w-full accent-primary h-1.5 bg-secondary rounded-lg cursor-pointer"
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

