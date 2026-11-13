import { CashflowSummary } from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Calendar, Receipt, Scale, TrendingDown, TrendingUp } from 'lucide-react';

interface CashflowSummarySectionProps {
  readonly summary: CashflowSummary;
  readonly inflowRatio: number;
  readonly outflowRatio: number;
}

export function CashflowSummarySection({
  summary,
  inflowRatio,
  outflowRatio,
}: CashflowSummarySectionProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Inflows
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              +{summary.totalInflows.format('en-IN')}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {summary.totalInflows.formatIndianCompact()}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {summary.inflowCount} Inflow events
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Outflows
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-rose-400">
              -{summary.totalOutflows.format('en-IN')}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                {summary.totalOutflows.formatIndianCompact()}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {summary.outflowCount} Outflow events
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Net Cashflow
            </CardTitle>
            <Scale className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-mono ${
                summary.isNetPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {summary.isNetPositive ? '+' : '-'}
              {summary.netCashflow.format('en-IN')}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${
                  summary.isNetPositive
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                }`}
              >
                {summary.isNetPositive ? '+' : '-'}
                {summary.netCashflow.formatIndianCompact()}
              </span>
              <span className="text-[11px] text-muted-foreground">Net capital balance</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Audit Volume & Transfers
            </CardTitle>
            <Receipt className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {summary.totalCount} Records
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">
                {summary.transferCount} Transfers (
                {summary.totalTransfersAmount.formatIndianCompact()})
              </span>
              <span className="text-[11px] text-muted-foreground">Zero P&L</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Cashflow Ratio & Category Breakdown</CardTitle>
            </div>
            <Badge variant="secondary">Zero Float Drift</Badge>
          </div>
          <CardDescription>
            Comparison of capital inflows versus deployed outflows and fees.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="w-full h-3 rounded-full overflow-hidden flex bg-secondary/60 p-0.5 border border-border/50">
            {summary.inflowCount === 0 && summary.outflowCount === 0 ? (
              <div
                title="No inflows or outflows recorded yet"
                className="w-full h-full bg-muted/50 rounded-full"
              />
            ) : (
              <>
                <div
                  title={`Inflows: ${inflowRatio.toFixed(1)}%`}
                  style={{ width: `${inflowRatio}%` }}
                  className="h-full bg-emerald-500 rounded-l-full transition-all duration-300"
                />
                <div
                  title={`Outflows: ${outflowRatio.toFixed(1)}%`}
                  style={{ width: `${outflowRatio}%` }}
                  className="h-full bg-rose-500 rounded-r-full transition-all duration-300"
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2.5 pt-1">
            {[
              {
                label: 'Deposits',
                val: summary.breakdownByType.deposit,
                color: 'text-emerald-400',
              },
              { label: 'Asset Buys', val: summary.breakdownByType.buy, color: 'text-rose-400' },
              {
                label: 'Dividends',
                val: summary.breakdownByType.dividend,
                color: 'text-emerald-400',
              },
              {
                label: 'Asset Sells',
                val: summary.breakdownByType.sell,
                color: 'text-emerald-400',
              },
              {
                label: 'Withdrawals',
                val: summary.breakdownByType.withdrawal,
                color: 'text-rose-400',
              },
              { label: 'Fees & STT', val: summary.breakdownByType.fee, color: 'text-amber-400' },
              {
                label: 'Transfers',
                val: summary.breakdownByType.transfer,
                color: 'text-purple-400',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="p-2.5 rounded-lg bg-secondary/30 border border-border/50"
              >
                <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                  {item.label}
                </span>
                <p className={`text-xs font-bold font-mono mt-0.5 ${item.color}`}>
                  {item.val.formatIndianCompact()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
