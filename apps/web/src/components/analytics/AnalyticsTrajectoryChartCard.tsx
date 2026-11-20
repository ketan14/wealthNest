import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PortfolioAnalyticsSummary } from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { AccessibleChartContainer } from '@/components/ui/AccessibleChartContainer';
import { Button } from '@/components/ui/Button';
import { formatInr } from '@/utils/formatInr';
import { usePrivacy } from '@/lib/preferences/privacy-context';
import { BarChart3, Calendar, Plus } from 'lucide-react';

interface AnalyticsTrajectoryChartCardProps {
  readonly trajectory: PortfolioAnalyticsSummary['trajectory'];
  readonly netWorthRupees?: number;
}

export function AnalyticsTrajectoryChartCard({
  trajectory,
  netWorthRupees,
}: AnalyticsTrajectoryChartCardProps) {
  const { hideBalances, maskAmount } = usePrivacy();
  const [timeframe, setTimeframe] = useState<'1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL'>('ALL');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const filteredTrajectory = useMemo(() => {
    if (timeframe === '1M') return trajectory.slice(-2);
    if (timeframe === '3M') return trajectory.slice(-3);
    if (timeframe === '6M') return trajectory.slice(-6);
    if (timeframe === 'YTD') {
      const currentYear = new Date().getFullYear().toString();
      const ytdPoints = trajectory.filter((pt) => pt.date.startsWith(currentYear));
      return ytdPoints.length >= 2 ? ytdPoints : trajectory.slice(-6);
    }
    if (timeframe === '1Y') return trajectory.slice(-12);
    return trajectory;
  }, [trajectory, timeframe]);

  const hasMeaningfulHistory = useMemo(() => {
    if (filteredTrajectory.length < 2) return false;
    return filteredTrajectory.some(
      (pt) => pt.portfolioValueCents > 0n || pt.investedAmountCents > 0n
    );
  }, [filteredTrajectory]);

  const chartHeight = 220;
  const chartWidth = 720;
  const paddingLeft = 64;
  const paddingRight = 24;
  const paddingY = 22;

  const maxValRupees = useMemo(() => {
    let maxCents = 0n;
    for (const pt of filteredTrajectory) {
      if (pt.portfolioValueCents > maxCents) maxCents = pt.portfolioValueCents;
      if (pt.benchmarkValueCents > maxCents) maxCents = pt.benchmarkValueCents;
      if (pt.investedAmountCents > maxCents) maxCents = pt.investedAmountCents;
    }
    return maxCents > 0n ? Number(maxCents) / 100 : 100_000;
  }, [filteredTrajectory]);

  const points = useMemo(() => {
    if (!hasMeaningfulHistory) return [];
    const count = filteredTrajectory.length;

    return filteredTrajectory.map((pt, i) => {
      const valRupees = Number(pt.portfolioValueCents) / 100;
      const invRupees = Number(pt.investedAmountCents) / 100;
      const benchRupees = Number(pt.benchmarkValueCents) / 100;

      const x = paddingLeft + (i / (count - 1)) * (chartWidth - paddingLeft - paddingRight);
      const yVal =
        chartHeight -
        paddingY -
        (valRupees / maxValRupees) * (chartHeight - paddingY * 2);
      const yInv =
        chartHeight -
        paddingY -
        (invRupees / maxValRupees) * (chartHeight - paddingY * 2);

      return {
        x,
        yVal,
        yInv,
        date: pt.date,
        valRupees,
        invRupees,
        benchRupees,
      };
    });
  }, [filteredTrajectory, hasMeaningfulHistory, maxValRupees]);

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

  const firstPoint = points[0];
  const latestPoint = points[points.length - 1];
  const periodDeltaRupees =
    firstPoint && latestPoint ? latestPoint.valRupees - firstPoint.valRupees : 0;
  const periodDeltaPct =
    firstPoint && firstPoint.valRupees > 0
      ? (periodDeltaRupees / firstPoint.valRupees) * 100
      : 0;
  const headlineValue =
    netWorthRupees !== undefined ? netWorthRupees : latestPoint ? latestPoint.valRupees : 0;

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-md">
      <CardHeader className="p-4 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
              <span className="truncate">Portfolio Trajectory &amp; Capital Growth Timeline</span>
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {hasMeaningfulHistory
                ? 'Portfolio valuation vs cumulative cost basis over time.'
                : 'Track how valuation and net capital inflows evolve over time.'}
            </CardDescription>
          </div>

          <div
            role="group"
            aria-label="Chart timeframe"
            className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-lg border border-slate-800 overflow-x-auto no-scrollbar max-w-full self-start sm:self-auto"
          >
            {(['1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => {
                  setTimeframe(tf);
                  setHoveredIndex(null);
                }}
                className={`px-2 py-1 text-[11px] font-medium rounded-md transition-all whitespace-nowrap shrink-0 border ${
                  timeframe === tf
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-sm'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {hasMeaningfulHistory && activePoint && (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span className="text-lg sm:text-xl font-bold font-mono text-white">
                {maskAmount(formatInr(headlineValue, { compact: true, compactDecimals: 2 }))}
              </span>
              <span
                className={`text-xs font-semibold font-mono ${
                  periodDeltaRupees >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {maskAmount(
                  formatInr(periodDeltaRupees, {
                    compact: true,
                    compactDecimals: 2,
                    showSign: true,
                  })
                )}{' '}
                ({periodDeltaPct >= 0 ? '+' : ''}
                {periodDeltaPct.toFixed(1)}%)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-white font-semibold">{activePoint.date}</span>
              </span>
              <span className="text-emerald-400">
                Value: {maskAmount(formatInr(activePoint.valRupees, { compact: true }))}
              </span>
              <span className="text-slate-300">
                Cost: {maskAmount(formatInr(activePoint.invRupees, { compact: true }))}
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {!hasMeaningfulHistory ? (
          <div className="min-h-[150px] max-h-[175px] rounded-xl border border-dashed border-slate-800 bg-slate-950/40 flex flex-col items-center justify-center text-center p-4 gap-2.5">
            <p className="text-sm font-medium text-slate-300">No net worth history yet</p>
            <Link to="/transactions?action=new">
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                Add Transaction
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <AccessibleChartContainer
              title="Portfolio Growth Trajectory"
              description="Portfolio valuation vs cumulative cost basis"
              headers={['Date', 'Portfolio Value', 'Cost Basis', 'Benchmark (Nifty 50 TRI)']}
              rows={points.map((p) => ({
                label: p.date,
                values: [
                  maskAmount(formatInr(p.valRupees, { compact: false })),
                  maskAmount(formatInr(p.invRupees, { compact: false })),
                  maskAmount(formatInr(p.benchRupees, { compact: false })),
                ],
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
                    Line chart comparing WealthNest portfolio valuation against cumulative cost
                    basis.
                  </desc>
                  <defs>
                    <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {[0.25, 0.5, 0.75, 1].map((pct) => {
                    const y = chartHeight - paddingY - pct * (chartHeight - paddingY * 2);
                    const tickValue = maxValRupees * pct;
                    return (
                      <g key={pct}>
                        <line
                          x1={paddingLeft}
                          y1={y}
                          x2={chartWidth - paddingRight}
                          y2={y}
                          stroke="currentColor"
                          className="text-border/40"
                          strokeDasharray="4 4"
                        />
                        <text
                          x={paddingLeft - 8}
                          y={y + 4}
                          textAnchor="end"
                          className="fill-slate-500 text-[11px] font-mono"
                        >
                          {hideBalances
                            ? '••••'
                            : formatInr(tickValue, { compact: true, compactDecimals: 1 })}
                        </text>
                      </g>
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
                      key={p.date}
                      tabIndex={0}
                      role="button"
                      aria-label={`${p.date}: Valuation ${maskAmount(formatInr(p.valRupees, { compact: true }))}, Cost Basis ${maskAmount(formatInr(p.invRupees, { compact: true }))}`}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onClick={() => setHoveredIndex(idx)}
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

            <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-[11px] font-medium text-muted-foreground border-t border-border/60 pt-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded-full bg-emerald-400" />
                <span>Portfolio Valuation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 border-t border-dashed border-slate-400" />
                <span>Cost Basis</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
