import { useMemo, useState } from 'react';
import { Money, PortfolioAnalyticsSummary } from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { AccessibleChartContainer } from '@/components/ui/AccessibleChartContainer';
import { BarChart3, Calendar } from 'lucide-react';

interface AnalyticsTrajectoryChartCardProps {
  readonly trajectory: PortfolioAnalyticsSummary['trajectory'];
}

export function AnalyticsTrajectoryChartCard({ trajectory }: AnalyticsTrajectoryChartCardProps) {
  const [timeframe, setTimeframe] = useState<'1M' | '6M' | '1Y' | 'ALL'>('ALL');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const filteredTrajectory = useMemo(() => {
    if (timeframe === '1M') return trajectory.slice(-2);
    if (timeframe === '6M') return trajectory.slice(-6);
    if (timeframe === '1Y') return trajectory.slice(-12);
    return trajectory;
  }, [trajectory, timeframe]);

  const chartHeight = 240;
  const chartWidth = 720;
  const paddingX = 40;
  const paddingY = 25;

  const maxValCents = useMemo(() => {
    let max = 0n;
    for (const pt of filteredTrajectory) {
      if (pt.portfolioValueCents > max) max = pt.portfolioValueCents;
      if (pt.benchmarkValueCents > max) max = pt.benchmarkValueCents;
      if (pt.investedAmountCents > max) max = pt.investedAmountCents;
    }
    return max > 0n ? max : 100000000n;
  }, [filteredTrajectory]);

  const points = useMemo(() => {
    const count = filteredTrajectory.length;
    if (count < 2) return [];

    return filteredTrajectory.map((pt, i) => {
      const x = paddingX + (i / (count - 1)) * (chartWidth - paddingX * 2);
      const yVal =
        chartHeight -
        paddingY -
        (Number(pt.portfolioValueCents) / Number(maxValCents)) * (chartHeight - paddingY * 2);
      const yInv =
        chartHeight -
        paddingY -
        (Number(pt.investedAmountCents) / Number(maxValCents)) * (chartHeight - paddingY * 2);
      const yBench =
        chartHeight -
        paddingY -
        (Number(pt.benchmarkValueCents) / Number(maxValCents)) * (chartHeight - paddingY * 2);

      return {
        x,
        yVal,
        yInv,
        yBench,
        date: pt.date,
        val: Money.fromCents(pt.portfolioValueCents, 'INR'),
        inv: Money.fromCents(pt.investedAmountCents, 'INR'),
        bench: Money.fromCents(pt.benchmarkValueCents, 'INR'),
      };
    });
  }, [filteredTrajectory, maxValCents]);

  const valuePath = useMemo(() => {
    if (points.length < 2) return '';
    return points.reduce(
      (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yVal.toFixed(1)}`,
      ''
    );
  }, [points]);

  const valueAreaPath = useMemo(() => {
    if (points.length < 2) return '';
    const first = points[0]!;
    const last = points[points.length - 1]!;
    const baseline = chartHeight - paddingY;
    return `${valuePath} L ${last.x.toFixed(1)} ${baseline} L ${first.x.toFixed(1)} ${baseline} Z`;
  }, [valuePath, points]);

  const investedPath = useMemo(() => {
    if (points.length < 2) return '';
    return points.reduce(
      (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yInv.toFixed(1)}`,
      ''
    );
  }, [points]);

  const activePoint =
    hoveredIndex !== null && points[hoveredIndex]
      ? points[hoveredIndex]
      : points[points.length - 1];

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-md">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Portfolio Trajectory & Capital Growth Timeline
            </CardTitle>
            <CardDescription className="text-xs">
              Monthly progression comparing Current Portfolio Valuation, Cost Basis (Capital
              Invested), and Benchmark.
            </CardDescription>
          </div>

          <div className="flex items-center gap-1 p-1 bg-accent/40 rounded-lg border border-border/80">
            {(['1M', '6M', '1Y', 'ALL'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  timeframe === tf
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {activePoint && (
          <div className="mt-4 p-3 rounded-xl bg-accent/30 border border-border/70 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Snapshot Date:</span>
              <span className="font-bold text-foreground">{activePoint.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-muted-foreground">Portfolio Value:</span>
              <span className="font-bold text-emerald-400">
                {activePoint.val.formatIndianCompact()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span className="text-muted-foreground">Invested Capital:</span>
              <span className="font-bold text-foreground">
                {activePoint.inv.formatIndianCompact()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <span className="text-muted-foreground">Benchmark (Nifty):</span>
              <span className="font-bold text-blue-400">
                {activePoint.bench.formatIndianCompact()}
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <AccessibleChartContainer
          title="Portfolio Growth Trajectory"
          description="Portfolio valuation vs cumulative cost basis and Nifty 50 TRI benchmark"
          headers={['Date', 'Portfolio Value', 'Cost Basis', 'Benchmark (Nifty 50 TRI)']}
          rows={points.map((p) => ({
            label: p.date,
            values: [p.val.format('en-IN'), p.inv.format('en-IN'), p.bench.format('en-IN')],
          }))}
        >
          <div className="w-full overflow-x-auto">
            <svg
              data-testid="analytics-trajectory-svg"
              role="img"
              aria-label="Portfolio valuation vs cost basis trajectory chart"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full max-w-full h-auto select-none"
            >
              <title>Portfolio Growth Trajectory</title>
              <desc>
                Line chart comparing WealthNest portfolio valuation against cumulative cost basis.
              </desc>
              <defs>
                <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {[0.25, 0.5, 0.75].map((pct) => {
                const y = chartHeight - paddingY - pct * (chartHeight - paddingY * 2);
                return (
                  <line
                    key={pct}
                    x1={paddingX}
                    y1={y}
                    x2={chartWidth - paddingX}
                    y2={y}
                    stroke="currentColor"
                    className="text-border/40"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {valueAreaPath && <path d={valueAreaPath} fill="url(#valGrad)" />}

              {investedPath && (
                <path
                  d={investedPath}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                />
              )}

              {valuePath && (
                <path
                  d={valuePath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {points.map((p, idx) => (
                <g
                  key={idx}
                  tabIndex={0}
                  role="button"
                  aria-label={`${p.date}: Valuation ${p.val.format('en-IN')}, Cost Basis ${p.inv.format('en-IN')}`}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onFocus={() => setHoveredIndex(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') {
                      setHoveredIndex(Math.min(points.length - 1, idx + 1));
                    } else if (e.key === 'ArrowLeft') {
                      setHoveredIndex(Math.max(0, idx - 1));
                    }
                  }}
                  className="cursor-pointer focus:outline-none"
                >
                  <circle cx={p.x} cy={p.yVal} r="14" fill="transparent" />
                  <circle
                    cx={p.x}
                    cy={p.yVal}
                    r={hoveredIndex === idx ? '6' : '4'}
                    className={`transition-all ${
                      hoveredIndex === idx
                        ? 'fill-emerald-300 stroke-background stroke-2'
                        : 'fill-emerald-400'
                    }`}
                  />
                </g>
              ))}
            </svg>
          </div>
        </AccessibleChartContainer>

        <div className="flex flex-wrap items-center justify-center gap-6 mt-4 text-xs font-medium text-muted-foreground border-t border-border/60 pt-3">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-1 rounded-full bg-emerald-400" />
            <span>WealthNest Portfolio Valuation (CMP)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-1 rounded-full border-t border-dashed border-slate-400" />
            <span>Cumulative Cost Basis (Capital Inflows)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-1 rounded-full bg-blue-400" />
            <span>Nifty 50 TRI Synthetic Benchmark</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
