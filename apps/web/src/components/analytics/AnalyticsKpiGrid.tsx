import { Award, TrendingUp, Scale, ShieldCheck } from 'lucide-react';
import { PortfolioAnalyticsSummary } from '@wealthnest/domain';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface AnalyticsKpiGridProps {
  analytics: PortfolioAnalyticsSummary;
  xirrDisplay: string;
  alphaDisplay: string;
  cagrDisplay: string;
}

export function AnalyticsKpiGrid({
  analytics,
  xirrDisplay,
  alphaDisplay,
  cagrDisplay,
}: AnalyticsKpiGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: XIRR */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Portfolio XIRR</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-emerald-400 font-mono">
              {analytics.xirr !== null && analytics.xirr >= 0 ? `+${xirrDisplay}` : xirrDisplay}
            </span>
            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
              Annualized
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <span>{analytics.isOutperforming ? 'Outperforming' : 'Tracking'} Nifty 50 by</span>
            <span
              className={`font-semibold font-mono ${analytics.isOutperforming ? 'text-emerald-400' : 'text-amber-400'}`}
            >
              {alphaDisplay} Alpha
            </span>
          </p>
        </CardContent>
      </Card>

      {/* Card 2: Absolute Gain & CAGR */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Return & CAGR
            </span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
              +{analytics.returnPercentage.toFixed(2)}%
            </span>
            <span className="text-xs text-muted-foreground font-mono">(CAGR {cagrDisplay})</span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
            <span className="text-emerald-400 font-semibold">
              +{analytics.absoluteGain.formatIndianCompact()}
            </span>
            <span>net capital gain</span>
          </p>
        </CardContent>
      </Card>

      {/* Card 3: Alpha vs Nifty 50 TRI */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Benchmark Alpha</span>
            <Scale className="w-4 h-4 text-purple-400" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-extrabold tracking-tight font-mono ${
                analytics.isOutperforming ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {alphaDisplay}
            </span>
            <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-500/30">
              vs Nifty 50 TRI
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Nifty 50 5Y CAGR:{' '}
            <span className="font-semibold text-foreground font-mono">14.20%</span>
          </p>
        </CardContent>
      </Card>

      {/* Card 4: Diversification Score */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Diversification Score
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {analytics.concentration.diversificationScore}
            </span>
            <span className="text-xs text-muted-foreground">/ 100</span>
            <Badge
              variant="outline"
              className={`text-[10px] uppercase font-bold ${
                analytics.concentration.riskLevel === 'low'
                  ? 'text-emerald-400 border-emerald-500/30'
                  : analytics.concentration.riskLevel === 'moderate'
                    ? 'text-amber-400 border-amber-500/30'
                    : 'text-rose-400 border-rose-500/30'
              }`}
            >
              {analytics.concentration.riskLevel} Risk
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            Top Asset:{' '}
            <span className="font-semibold text-foreground">
              {analytics.concentration.topAssetName}
            </span>{' '}
            ({analytics.concentration.topAssetWeight.toFixed(1)}%)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
