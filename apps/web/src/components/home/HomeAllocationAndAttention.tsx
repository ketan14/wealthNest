import { Link } from 'react-router-dom';
import {
  PieChart,
  ArrowRight,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Landmark,
  FolderLock,
  Percent,
  Info,
} from 'lucide-react';
import { calculatePortfolioSummary, FinancialAlert } from '@wealthnest/domain';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface HomeAllocationAndAttentionProps {
  portfolioSummary: ReturnType<typeof calculatePortfolioSummary>;
  holdingsCount: number;
  householdAlerts: readonly FinancialAlert[];
  topAlertSeverity: FinancialAlert['severity'] | null | undefined;
  currencySymbol: string;
  locale: string;
}

export function HomeAllocationAndAttention({
  portfolioSummary,
  holdingsCount,
  householdAlerts,
  topAlertSeverity,
  currencySymbol,
  locale,
}: HomeAllocationAndAttentionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left (2 cols): Asset Allocation Portfolio Distribution */}
      <Card className="lg:col-span-2 border-border/80 bg-card/60 backdrop-blur-sm flex flex-col justify-between">
        <div>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-primary" />
                <CardTitle className="text-base font-semibold">
                  Asset Allocation Distribution
                </CardTitle>
              </div>
              <Link
                to="/portfolio"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View Full Portfolio <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <CardDescription>
              Diversification across physical assets, demat equities, mutual funds, and cash
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Distribution Horizontal Progress Bar */}
            <div className="h-3 w-full bg-secondary/60 rounded-full overflow-hidden flex gap-0.5">
              {portfolioSummary.allocations.length > 0 ? (
                portfolioSummary.allocations.map((alloc) => (
                  <div
                    key={alloc.assetClassId}
                    style={{
                      width: `${Math.max(alloc.percentage, 2)}%`,
                      backgroundColor: alloc.colorHex || '#3b82f6',
                    }}
                    title={`${alloc.name}: ${alloc.percentage.toFixed(1)}%`}
                  />
                ))
              ) : (
                <div className="w-full bg-muted" />
              )}
            </div>

            {/* Allocation Legend Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {portfolioSummary.allocations.map((alloc) => (
                <div
                  key={alloc.assetClassId}
                  className="p-3 rounded-xl bg-secondary/30 border border-border/50 flex flex-col justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: alloc.colorHex || '#3b82f6' }}
                    />
                    <span className="text-xs font-medium text-foreground truncate">
                      {alloc.name}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-sm font-bold font-mono text-foreground">
                      {currencySymbol}
                      {alloc.totalValue
                        .toDecimal()
                        .toLocaleString(locale, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground font-mono">
                      {alloc.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </div>

        <div className="p-4 border-t border-border/50 bg-secondary/10 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Total Tracked Capital:{' '}
            <strong className="text-foreground">
              {currencySymbol}
              {portfolioSummary.totalValue
                .toDecimal()
                .toLocaleString(locale, { maximumFractionDigits: 0 })}
            </strong>
          </span>
          <span>
            Positions: <strong className="text-foreground">{holdingsCount}</strong>
          </span>
        </div>
      </Card>

      {/* Right (1 col): Actionable Family Attention Items */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <CardTitle className="text-base font-semibold">Action & Attention</CardTitle>
            </div>
            {topAlertSeverity && (
              <Badge
                variant={topAlertSeverity === 'critical' ? 'destructive' : 'secondary'}
                className="text-[10px]"
              >
                {topAlertSeverity.toUpperCase()}
              </Badge>
            )}
          </div>
          <CardDescription>
            Upcoming commitments, valuations, and emergency runway signals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
          <div className="space-y-2.5">
            {householdAlerts.map((alert: FinancialAlert) => {
              const isCrit = alert.severity === 'critical';
              const isWarn = alert.severity === 'warning';
              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                    isCrit
                      ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                      : isWarn
                        ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                        : 'bg-secondary/40 border-border/60 text-foreground'
                  }`}
                >
                  {isCrit ? (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  ) : isWarn ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : alert.type === 'emi_obligation' ? (
                    <Calendar className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : alert.type === 'loan_rate_reset' ? (
                    <Landmark className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : alert.type === 'document_expiring' || alert.type === 'document_expired' ? (
                    <FolderLock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  ) : alert.type === 'tax_harvesting_opportunity' ? (
                    <Percent className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground">{alert.title}</p>
                      {alert.actionHref && (
                        <Link
                          to={alert.actionHref}
                          className="text-[11px] text-primary hover:underline font-medium ml-2 shrink-0"
                        >
                          {alert.actionLabel || 'Details'} →
                        </Link>
                      )}
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{alert.message}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3">
            <Link to="/analytics" className="w-full inline-block">
              <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                Inspect Tax & Performance Radar
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
