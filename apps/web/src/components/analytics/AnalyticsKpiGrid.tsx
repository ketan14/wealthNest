import { Link } from 'react-router-dom';
import { Award, TrendingUp, Scale, ShieldCheck, ChevronRight } from 'lucide-react';
import { PortfolioAnalyticsSummary } from '@wealthnest/domain';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatInr } from '@/utils/formatInr';
import { usePrivacy } from '@/lib/preferences/privacy-context';

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
  const { maskAmount } = usePrivacy();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      {/* Card 1: XIRR -> /portfolio */}
      <Link to="/portfolio" className="block group focus:outline-none">
        <Card className="h-full border-border/80 bg-card/60 backdrop-blur-md p-3 sm:p-4 group-hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs uppercase font-semibold">
            <span className="truncate">Portfolio XIRR</span>
            <div className="flex items-center gap-1 shrink-0">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 pt-1 sm:pt-1.5 flex-wrap">
            <span className="text-lg sm:text-2xl font-extrabold tracking-tight text-emerald-400 font-mono">
              {analytics.xirr !== null && analytics.xirr >= 0 ? `+${xirrDisplay}` : xirrDisplay}
            </span>
            <span className="hidden sm:inline text-[10px] text-emerald-400 font-medium">
              Annualized
            </span>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
            {analytics.isOutperforming ? 'Beating' : 'vs'} Nifty:{' '}
            <span
              className={`font-semibold font-mono ${analytics.isOutperforming ? 'text-emerald-400' : 'text-amber-400'}`}
            >
              {alphaDisplay}
            </span>
          </p>
        </Card>
      </Link>

      {/* Card 2: Absolute Gain & CAGR -> /portfolio */}
      <Link to="/portfolio" className="block group focus:outline-none">
        <Card className="h-full border-border/80 bg-card/60 backdrop-blur-md p-3 sm:p-4 group-hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs uppercase font-semibold">
            <span className="truncate">Total Return &amp; CAGR</span>
            <div className="flex items-center gap-1 shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 pt-1 sm:pt-1.5 flex-wrap">
            <span className="text-lg sm:text-2xl font-extrabold tracking-tight text-foreground font-mono">
              +{analytics.returnPercentage.toFixed(2)}%
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
              ({cagrDisplay})
            </span>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate font-mono">
            <span
              className={`font-semibold ${
                analytics.absoluteGain.cents >= 0n ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {maskAmount(
                formatInr(analytics.absoluteGain.toDecimal(), {
                  compact: true,
                  showSign: true,
                })
              )}
            </span>{' '}
            <span className="font-sans">net gain</span>
          </p>
        </Card>
      </Link>

      {/* Card 3: Alpha vs Nifty 50 TRI -> /transactions */}
      <Link to="/transactions" className="block group focus:outline-none">
        <Card className="h-full border-border/80 bg-card/60 backdrop-blur-md p-3 sm:p-4 group-hover:border-purple-500/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs uppercase font-semibold">
            <span className="truncate">Benchmark Alpha</span>
            <div className="flex items-center gap-1 shrink-0">
              <Scale className="w-3.5 h-3.5 text-purple-400" />
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 pt-1 sm:pt-1.5 flex-wrap">
            <span
              className={`text-lg sm:text-2xl font-extrabold tracking-tight font-mono ${
                analytics.isOutperforming ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {alphaDisplay}
            </span>
            <span className="hidden sm:inline text-[10px] text-purple-300 font-medium">
              vs Nifty 50
            </span>
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
            Nifty 5Y CAGR: <span className="font-semibold text-foreground font-mono">14.2%</span>
          </p>
        </Card>
      </Link>

      {/* Card 4: Diversification Score -> /portfolio */}
      <Link to="/portfolio" className="block group focus:outline-none">
        <Card className="h-full border-border/80 bg-card/60 backdrop-blur-md p-3 sm:p-4 group-hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs uppercase font-semibold">
            <span className="truncate">Diversification Score</span>
            <div className="flex items-center gap-1 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 pt-1 sm:pt-1.5 flex-wrap">
            <span className="text-lg sm:text-2xl font-extrabold tracking-tight text-foreground font-mono">
              {analytics.concentration.diversificationScore}
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">/100</span>
            <Badge
              variant="outline"
              className={`text-[9px] sm:text-[10px] uppercase font-bold px-1.5 py-0 ${
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
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
            Top: <span className="font-semibold text-foreground">{analytics.concentration.topAssetName}</span> (
            {analytics.concentration.topAssetWeight.toFixed(0)}%)
          </p>
        </Card>
      </Link>
    </div>
  );
}
