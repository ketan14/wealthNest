import { AllocationModelType, PortfolioAnalyticsSummary } from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';

interface BenchmarkAndRebalanceSectionProps {
  readonly analytics: PortfolioAnalyticsSummary;
  readonly xirrDisplay: string;
  readonly modelType: AllocationModelType;
}

export function BenchmarkAndRebalanceSection({
  analytics,
  xirrDisplay,
  modelType,
}: BenchmarkAndRebalanceSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border-border/80 bg-card/60 backdrop-blur-md flex flex-col justify-between">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Scale className="w-5 h-5 text-purple-400" />
              Indian Market Benchmarks & Alpha
            </CardTitle>
            <Badge variant="outline" className="text-xs font-mono">
              5-Year Annualized
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Comparison against standard Indian equity, sovereign gold, and debt benchmarks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3.5">
          <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-foreground flex items-center gap-1.5">
                <Award className="w-4 h-4 text-primary" />
                Your WealthNest Portfolio
              </span>
              <span className="font-mono text-emerald-400 text-sm font-bold">{xirrDisplay}</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-400 h-2.5 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(10, (analytics.xirr || 0.15) * 400))}%`,
                }}
              />
            </div>
          </div>

          <div className="space-y-2.5">
            {analytics.benchmarks.map((bm) => {
              const bmReturnPct = (bm.annualizedReturn * 100).toFixed(1);
              const diff = (analytics.xirr || 0.15) - bm.annualizedReturn;
              const outperforming = diff >= 0;

              return (
                <div
                  key={bm.id}
                  className="p-3 rounded-lg bg-accent/20 border border-border/60 hover:bg-accent/40 transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-foreground">{bm.name}</span>
                      <span className="text-[11px] text-muted-foreground ml-2">
                        ({bm.category})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-foreground">{bmReturnPct}%</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          outperforming
                            ? 'text-emerald-400 border-emerald-500/30'
                            : 'text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {outperforming ? '+' : ''}
                        {(diff * 100).toFixed(1)}% Alpha
                      </Badge>
                    </div>
                  </div>
                  <div className="w-full bg-secondary/80 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-400/80 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, bm.annualizedReturn * 400)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/60 backdrop-blur-md flex flex-col justify-between">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
              Asset Allocation Drift & Rebalancing
            </CardTitle>
            <Badge variant="outline" className="text-xs capitalize font-medium">
              {modelType} Model
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Deviations from your target strategy with calculated rebalancing buy/sell amounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {analytics.drifts.map((drift) => {
            const isOver = drift.driftPercentage > 0;
            const isBalanced = Math.abs(drift.driftPercentage) < 1.0;

            return (
              <div
                key={drift.assetClassId}
                className="p-3 rounded-lg bg-accent/20 border border-border/60 hover:bg-accent/40 transition-all space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: drift.colorHex }}
                    />
                    <span className="font-semibold text-foreground">{drift.name}</span>
                  </div>

                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-muted-foreground">
                      {drift.currentPercentage.toFixed(1)}% / {drift.targetPercentage}%
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        isBalanced
                          ? 'text-slate-400 border-slate-500/30'
                          : isOver
                            ? 'text-amber-400 border-amber-500/30'
                            : 'text-blue-400 border-blue-500/30'
                      }`}
                    >
                      {isBalanced
                        ? 'Balanced'
                        : `${isOver ? '+' : ''}${drift.driftPercentage.toFixed(1)}% Drift`}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
                  <span className="text-muted-foreground">
                    Current Value:{' '}
                    <span className="font-mono text-foreground">
                      {drift.currentValue.formatIndianCompact()}
                    </span>
                  </span>
                  {isBalanced ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Optimal Allocation
                    </span>
                  ) : drift.rebalanceAction === 'buy' ? (
                    <span className="text-blue-400 font-medium flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5" /> Buy +
                      {drift.rebalanceAmount.formatIndianCompact()}
                    </span>
                  ) : (
                    <span className="text-amber-400 font-medium flex items-center gap-1">
                      <ArrowDownRight className="w-3.5 h-3.5" /> Trim -
                      {drift.rebalanceAmount.formatIndianCompact()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

