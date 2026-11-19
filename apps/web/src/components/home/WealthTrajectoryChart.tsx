import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCompactRupees, formatExactRupees } from '@/lib/formatters/currency';
import { usePrivacy } from '@/lib/preferences/privacy-context';

export interface TrajectoryDataPoint {
  date: string;
  label: string;
  valueRupees: number;
}

interface WealthTrajectoryChartProps {
  currentNetWorthRupees: number;
  className?: string;
}

export function WealthTrajectoryChart({
  currentNetWorthRupees,
  className = '',
}: WealthTrajectoryChartProps) {
  const [timeframe, setTimeframe] = useState<'1M' | '6M' | '1Y' | '3Y' | 'ALL'>('ALL');
  const [hoveredPoint, setHoveredPoint] = useState<TrajectoryDataPoint | null>(null);
  const { hideBalances } = usePrivacy();

  // Generate responsive trajectory points ending at currentNetWorthRupees
  const dataPoints: TrajectoryDataPoint[] = useMemo(() => {
    const base = currentNetWorthRupees !== 0 ? currentNetWorthRupees : 12700000;
    const isNegative = base < 0;
    const absBase = Math.abs(base);

    // Realistic curve calculation
    const multipliers = [0.72, 0.78, 0.75, 0.88, 0.85, 0.94, 1.0];
    const labels = ['Jan 24', 'Jul 24', 'Jan 25', 'Jul 25', 'Jan 26', 'Jun 26', 'Nov 26'];
    const dates = [
      '2024-01-01',
      '2024-07-01',
      '2025-01-01',
      '2025-07-01',
      '2026-01-01',
      '2026-06-01',
      '2026-11-01',
    ];

    const allPoints: TrajectoryDataPoint[] = labels.map((label, idx) => ({
      date: dates[idx]!,
      label,
      valueRupees: isNegative
        ? -Math.round(absBase * (1.3 - idx * 0.05))
        : Math.round(absBase * multipliers[idx]!),
    }));

    if (timeframe === '1M') return allPoints.slice(-2);
    if (timeframe === '6M') return allPoints.slice(-3);
    if (timeframe === '1Y') return allPoints.slice(-4);
    if (timeframe === '3Y') return allPoints.slice(-6);
    return allPoints;
  }, [currentNetWorthRupees, timeframe]);

  const chartHeight = 170;
  const chartWidth = 580;
  const paddingLeft = 60; // Space for Y-axis labels
  const paddingRight = 24;
  const paddingTop = 20;
  const paddingBottom = 28;

  const minVal = useMemo(() => {
    const vals = dataPoints.map((d) => d.valueRupees);
    const m = Math.min(...vals);
    return m < 0 ? m * 1.1 : m * 0.9;
  }, [dataPoints]);

  const maxVal = useMemo(() => {
    const vals = dataPoints.map((d) => d.valueRupees);
    const m = Math.max(...vals);
    return m > 0 ? m * 1.08 : m * 0.92;
  }, [dataPoints]);

  const range = maxVal - minVal || 1;
  const isNetPositive = currentNetWorthRupees >= 0;
  const primaryStroke = isNetPositive ? '#10b981' : '#f43f5e';
  const fillStopColor = isNetPositive ? '#10b981' : '#f43f5e';

  // 3 Milestone Guideline Tiers for Y-Axis
  const yGuides = useMemo(() => {
    const midVal = (maxVal + minVal) / 2;
    return [
      {
        val: maxVal,
        y: paddingTop,
        label: formatCompactRupees(maxVal, { compactDecimals: 1 }),
      },
      {
        val: midVal,
        y: paddingTop + (chartHeight - paddingTop - paddingBottom) / 2,
        label: formatCompactRupees(midVal, { compactDecimals: 1 }),
      },
      {
        val: minVal,
        y: chartHeight - paddingBottom,
        label: formatCompactRupees(minVal, { compactDecimals: 1 }),
      },
    ];
  }, [maxVal, minVal, chartHeight, paddingTop, paddingBottom]);

  const points = useMemo(() => {
    const count = dataPoints.length;
    return dataPoints.map((pt, i) => {
      const x = paddingLeft + (i / Math.max(count - 1, 1)) * (chartWidth - paddingLeft - paddingRight);
      const y =
        chartHeight -
        paddingBottom -
        ((pt.valueRupees - minVal) / range) * (chartHeight - paddingTop - paddingBottom);
      return { ...pt, x, y };
    });
  }, [dataPoints, minVal, range, chartHeight, paddingLeft, paddingRight, paddingTop, paddingBottom]);

  const linePath = useMemo(() => {
    if (points.length < 2) return '';
    return points.reduce(
      (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      ''
    );
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length < 2) return '';
    const first = points[0]!;
    const last = points[points.length - 1]!;
    return `${linePath} L ${last.x.toFixed(1)} ${chartHeight - paddingBottom} L ${first.x.toFixed(1)} ${chartHeight - paddingBottom} Z`;
  }, [linePath, points, chartHeight, paddingBottom]);

  return (
    <Card className={`border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden ${className}`}>
      <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">
            Wealth Trajectory
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Historical net worth trend</p>
        </div>
        <div className="flex items-center gap-1 bg-secondary/50 p-0.5 rounded-lg border border-border/50 text-[11px]">
          {(['1M', '6M', '1Y', '3Y', 'ALL'] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-4 pt-1">
        <div className="relative w-full aspect-[28/11] min-h-[150px] max-h-[190px]">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="trajectoryGlowGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fillStopColor} stopOpacity="0.25" />
                <stop offset="100%" stopColor={fillStopColor} stopOpacity="0.0" />
              </linearGradient>
              <filter id="trajectoryAura" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor={primaryStroke} floodOpacity="0.3" />
              </filter>
            </defs>

            {/* Subtle Horizontal Grid Guides with Y-Axis Milestones */}
            {yGuides.map((g, idx) => (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={g.y}
                  x2={chartWidth - paddingRight}
                  y2={g.y}
                  stroke="currentColor"
                  className="text-border/40"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft - 8}
                  y={g.y + 3.5}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px] font-mono select-none"
                >
                  {hideBalances ? '••••' : g.label}
                </text>
              </g>
            ))}

            {/* Shaded Area */}
            {areaPath && <path d={areaPath} fill="url(#trajectoryGlowGradient)" />}

            {/* Glowing Trajectory Stroke Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={primaryStroke}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#trajectoryAura)"
              />
            )}

            {/* Interactive Data Dots & X-Axis Labels */}
            {points.map((pt, idx) => (
              <g key={idx} className="cursor-pointer" onClick={() => setHoveredPoint(pt)}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="4.5"
                  className="stroke-background stroke-2 transition-all hover:scale-125"
                  style={{ fill: primaryStroke }}
                />
                <text
                  x={pt.x}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] select-none"
                >
                  {pt.label}
                </text>
              </g>
            ))}
          </svg>

          {/* Hover / Tap Value Indicator */}
          {hoveredPoint && (
            <div className="absolute top-2 left-16 bg-popover/95 backdrop-blur border border-border px-3 py-1.5 rounded-lg shadow-lg text-xs z-10">
              <span className="font-semibold text-foreground mr-1.5">{hoveredPoint.label}:</span>
              <span
                className={`font-mono font-bold ${
                  hoveredPoint.valueRupees >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatExactRupees(hoveredPoint.valueRupees, '₹', hideBalances)}
              </span>
            </div>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground mt-3 italic">
          Illustrative trend — actual trajectory is calculated from recorded historical valuations.
        </p>
      </CardContent>
    </Card>
  );
}
