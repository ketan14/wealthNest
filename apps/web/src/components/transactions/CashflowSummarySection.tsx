import { useState } from 'react';
import { CashflowSummary } from '@wealthnest/domain';
import { Card } from '@/components/ui/Card';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { Scale, TrendingDown, TrendingUp, Activity } from 'lucide-react';

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
  const [showAllCategories, setShowAllCategories] = useState(false);

  const categories = [
    { label: 'Deposits', val: summary.breakdownByType.deposit, color: 'text-emerald-400' },
    { label: 'Asset Buys', val: summary.breakdownByType.buy, color: 'text-rose-400' },
    { label: 'Dividends', val: summary.breakdownByType.dividend, color: 'text-emerald-400' },
    { label: 'Asset Sells', val: summary.breakdownByType.sell, color: 'text-emerald-400' },
    { label: 'Withdrawals', val: summary.breakdownByType.withdrawal, color: 'text-rose-400' },
    { label: 'Fees & STT', val: summary.breakdownByType.fee, color: 'text-amber-400' },
    { label: 'Transfers', val: summary.breakdownByType.transfer, color: 'text-purple-400' },
  ];

  const visibleCategories = showAllCategories
    ? categories
    : categories.filter((c) => c.val.cents !== 0n);

  return (
    <div className="space-y-4">
      {/* 1. Summary Cards (Mobile 2-card split / Desktop 4 cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Inflows */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm p-3 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs uppercase font-semibold">
            <span>Total Inflows</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-bold font-mono text-emerald-400 pt-1 sm:pt-1.5">
            +<CurrencyDisplay amount={summary.totalInflows.toDecimal()} />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
            {summary.inflowCount} {summary.inflowCount === 1 ? 'event' : 'events'}
          </p>
        </Card>

        {/* Card 2: Outflows */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm p-3 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs uppercase font-semibold">
            <span>Total Outflows</span>
            <TrendingDown className="h-3.5 w-3.5 text-rose-400 shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-bold font-mono text-rose-400 pt-1 sm:pt-1.5">
            -<CurrencyDisplay amount={summary.totalOutflows.toDecimal()} />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
            {summary.outflowCount} {summary.outflowCount === 1 ? 'event' : 'events'}
          </p>
        </Card>

        {/* Card 3: Net Cashflow */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm p-3 sm:p-5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs uppercase font-semibold">
            <span>Net Cashflow</span>
            <Scale className="h-3.5 w-3.5 text-primary shrink-0" />
          </div>
          <div
            className={`text-lg sm:text-2xl font-bold font-mono pt-1 sm:pt-1.5 ${
              summary.isNetPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {summary.isNetPositive ? '+' : '-'}
            <CurrencyDisplay amount={summary.netCashflow.toDecimal()} />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
            Net capital position
          </p>
        </Card>

        {/* Card 4: Activity */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm p-3 sm:p-5 hidden sm:block">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs uppercase font-semibold">
            <span>Activity</span>
            <Activity className="h-3.5 w-3.5 text-primary shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-bold font-mono text-foreground pt-1 sm:pt-1.5">
            {summary.totalCount}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
            {summary.totalCount} transactions recorded
          </p>
        </Card>
      </div>

      {/* 2. Cashflow Ratio & Active Categories */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">Cashflow Ratio</div>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            <span>Show all categories ({categories.length})</span>
            <input
              type="checkbox"
              checked={showAllCategories}
              onChange={(e) => setShowAllCategories(e.target.checked)}
              className="rounded border-border/80 bg-secondary/80 text-primary focus:ring-primary w-3.5 h-3.5"
            />
          </label>
        </div>

        {/* Visual Progress Ratio Bar */}
        <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-secondary/60 p-0.5 border border-border/50">
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

        {/* Clean Category Breakdown Chips/Boxes */}
        <div className="flex flex-wrap gap-2 pt-1">
          {visibleCategories.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">No category expenses yet</span>
          ) : (
            visibleCategories.map((item) => (
              <div
                key={item.label}
                className="px-3 py-2 rounded-lg bg-secondary/30 border border-border/50 flex items-center gap-2"
              >
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                  {item.label}:
                </span>
                <span className={`text-xs font-bold font-mono ${item.color}`}>
                  <CurrencyDisplay amount={item.val.toDecimal()} />
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
