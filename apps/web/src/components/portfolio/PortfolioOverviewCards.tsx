import { Wallet, Scale, TrendingUp, TrendingDown, Layers, PieChart } from 'lucide-react';
import { PortfolioSummary } from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface PortfolioOverviewCardsProps {
  summary: PortfolioSummary;
  positionsCount: number;
  selectedClassFilter: string | null;
  onToggleClassFilter: (assetClassId: string) => void;
}

export function PortfolioOverviewCards({
  summary,
  positionsCount,
  selectedClassFilter,
  onToggleClassFilter,
}: PortfolioOverviewCardsProps) {
  return (
    <>
      {/* Top Portfolio Valuation Summary Cards: Unified across all holdings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Portfolio Value */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Portfolio Value
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {summary.totalValue.format('en-IN')}
            </div>
            <p className="text-[11px] font-mono text-muted-foreground mt-1">
              {summary.totalValue.formatIndianCompact()} (zero float drift)
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Cost Basis */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Cost Basis
            </CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {summary.totalCostBasis.format('en-IN')}
            </div>
            <p className="text-[11px] font-mono text-muted-foreground mt-1">
              Historical cost of verified positions
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Unrealized Profit / Loss */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Unrealized Profit/Loss
            </CardTitle>
            {summary.isProfitable ? (
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-rose-400" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-mono ${
                summary.isProfitable ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {summary.isProfitable ? '+' : '-'}
              {summary.unrealizedGainLoss.format('en-IN')}
            </div>
            <p className="text-[11px] font-mono mt-1 flex items-center gap-1.5">
              <span
                className={`font-semibold ${
                  summary.isProfitable ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {summary.isProfitable ? '+' : ''}
                {summary.returnPercentage.toFixed(2)}%
              </span>
              <span className="text-muted-foreground">all-time yield</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Positions & Asset Classes */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Asset Diversity
            </CardTitle>
            <Layers className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {positionsCount} Positions
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Across {summary.allocations.length} Indian asset categories
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Asset Allocation Breakdown */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">
                Asset Class Allocation (Unified Net Worth)
              </CardTitle>
            </div>
            <Badge variant="secondary">Zero Float Drift</Badge>
          </div>
          <CardDescription>
            Unified distribution across Indian equities, mutual funds, gold bonds, debt, and cash
            instruments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Segmented allocation progress bar */}
          <div className="w-full h-3.5 rounded-full overflow-hidden flex bg-secondary/60 p-0.5 border border-border/50">
            {summary.allocations.map((alloc) => (
              <div
                key={alloc.assetClassId}
                title={`${alloc.name}: ${alloc.percentage.toFixed(1)}% (${alloc.totalValue.format('en-IN')})`}
                style={{
                  width: `${alloc.percentage}%`,
                  backgroundColor: alloc.colorHex,
                }}
                className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 hover:opacity-80"
              />
            ))}
          </div>

          {/* Asset Class Pills & Percentages */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
            {summary.allocations.map((alloc) => (
              <div
                key={alloc.assetClassId}
                onClick={() => onToggleClassFilter(alloc.assetClassId)}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  selectedClassFilter === alloc.assetClassId
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border/60 bg-secondary/30 hover:border-border hover:bg-secondary/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: alloc.colorHex }}
                  />
                  <span className="text-xs font-medium text-foreground truncate">{alloc.name}</span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-sm font-bold font-mono text-foreground">
                    {alloc.percentage.toFixed(1)}%
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {alloc.totalValue.formatIndianCompact()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
