import { PortfolioTaxSummary, Section112aHarvestingPlan } from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Coins, Receipt, Scissors, Sparkles, Users } from 'lucide-react';

interface TaxHarvestingIntelligenceCardProps {
  readonly taxSummary: PortfolioTaxSummary;
  readonly harvestingPlan: Section112aHarvestingPlan;
  readonly activeMemberRelationship?: string;
  readonly currencySymbol: string;
  readonly locale: string;
}

export function TaxHarvestingIntelligenceCard({
  taxSummary,
  harvestingPlan,
  activeMemberRelationship,
  currencySymbol,
  locale,
}: TaxHarvestingIntelligenceCardProps) {
  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-md">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant="outline"
                className="text-xs bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
              >
                Budget 2024 Rules Enforced
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                {taxSummary.fiscalYear} • Period Ending Mar 31
              </span>
            </div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-400" />
              Capital Gains Tax & Loss Harvesting Intelligence
            </CardTitle>
            <CardDescription className="text-xs">
              Indian Section 112A Equity LTCG (12.5% over ₹1.25L exemption), Section 111A STCG
              (20%), and actionable tax loss offsets.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-accent/30 border border-border/60 space-y-1">
            <span className="text-xs text-muted-foreground">
              {activeMemberRelationship === 'huf'
                ? 'HUF Section 112A Exemption'
                : 'Section 112A LTCG Exemption'}
            </span>
            <div className="text-lg font-bold font-mono text-emerald-400">
              {taxSummary.annualLtcgExemption.formatIndianCompact()}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {activeMemberRelationship === 'huf'
                ? 'Independent HUF PAN exemption'
                : 'Tax-free headroom per financial year'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-accent/30 border border-border/60 space-y-1">
            <span className="text-xs text-muted-foreground">
              Taxable LTCG (&gt;1 Year @ 12.5%)
            </span>
            <div className="text-lg font-bold font-mono text-foreground">
              {taxSummary.taxableLtcg.formatIndianCompact()}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Estimated Tax: {taxSummary.estimatedLtcgTax.formatIndianCompact()}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-accent/30 border border-border/60 space-y-1">
            <span className="text-xs text-muted-foreground">Taxable STCG (&le;1 Year @ 20%)</span>
            <div className="text-lg font-bold font-mono text-foreground">
              {taxSummary.netStcg.formatIndianCompact()}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Estimated Tax: {taxSummary.estimatedStcgTax.formatIndianCompact()}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <Scissors className="w-3.5 h-3.5" />
              Loss Harvesting Savings
            </span>
            <div className="text-lg font-bold font-mono text-emerald-400">
              {taxSummary.potentialTaxSavings.formatIndianCompact()}
            </div>
            <p className="text-[11px] text-emerald-300">
              From {taxSummary.harvestableLossPotential.formatIndianCompact()} in bookable losses
            </p>
          </div>
        </div>

        {taxSummary.holdings.some((h) => !h.isGain) && (
          <div className="p-4 rounded-xl bg-accent/20 border border-border/60 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-foreground flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                Tax Loss Harvesting Opportunities (Actionable Before March 31)
              </span>
              <span className="text-emerald-400 font-mono">Offset against STCG / LTCG</span>
            </div>
            <div className="space-y-2">
              {taxSummary.holdings
                .filter((h) => !h.isGain)
                .map((h) => (
                  <div
                    key={h.holdingId}
                    className="p-3 rounded-lg bg-card/60 border border-border/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-foreground">{h.assetName}</span>
                      <span className="text-muted-foreground ml-2">
                        ({h.term === 'short_term' ? 'STCG Loss' : 'LTCG Loss'} •{' '}
                        {h.holdingPeriodDays} days held)
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-rose-400 font-bold">
                        -{h.harvestableLoss.formatIndianCompact()}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-emerald-400 border-emerald-500/20 bg-emerald-500/10 text-[10px]"
                      >
                        Save ~{currencySymbol}
                        {(
                          (Number(h.harvestableLoss.cents) *
                            (h.term === 'short_term' ? 0.2 : 0.125)) /
                          100
                        ).toLocaleString(locale, { maximumFractionDigits: 0 })}
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h4 className="text-sm font-bold text-foreground">
                Section 112A Multi-Entity Tax Harvesting Simulator (Budget 2024)
              </h4>
            </div>
            <Badge variant="outline" className="text-[10px] bg-indigo-500/15 text-indigo-300 border-indigo-500/30">
              Total Family Tax Shield: {harvestingPlan.totalEstimatedTaxSaved.formatIndianCompact()}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Every distinct legal PAN entity (including Hindu Undivided Family - HUF) receives an independent annual ₹1,25,000 LTCG exemption. Selling and repurchasing unrealized gains within this limit locks in a higher cost basis tax-free, saving 12.5% in future taxes.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {harvestingPlan.entityBreakdowns.map((entity) => {
              const headroomPct =
                entity.annualExemptionLimit.cents > 0n
                  ? Number((entity.optimalHarvestAmount.cents * 100n) / entity.annualExemptionLimit.cents)
                  : 0;

              return (
                <div
                  key={entity.memberId}
                  className="p-3.5 rounded-lg bg-card/60 border border-border/70 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span className="font-semibold text-xs text-foreground">{entity.memberName}</span>
                      {entity.isHuf && (
                        <span
                          data-testid="huf-tax-shield-badge"
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        >
                          HUF TAX SHIELD
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      +{entity.estimatedTaxShield.formatIndianCompact()} Saved
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        Exemption Utilized:{' '}
                        <strong className="text-foreground font-mono">
                          {entity.optimalHarvestAmount.formatIndianCompact()}
                        </strong>{' '}
                        / {entity.annualExemptionLimit.formatIndianCompact()}
                      </span>
                      <span className="font-mono">{headroomPct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-400 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, headroomPct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Actionable Long-Term Holdings
                    </span>
                    {entity.positions.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">
                        No long-term gains available to harvest this cycle.
                      </p>
                    ) : (
                      entity.positions.map((pos) => (
                        <div
                          key={pos.holdingId}
                          className="p-2 rounded bg-secondary/40 border border-border/40 flex items-center justify-between text-[11px]"
                        >
                          <div>
                            <span className="font-semibold text-foreground">{pos.assetName}</span>
                            {pos.ticker && (
                              <span className="text-[9px] font-mono text-primary ml-1">({pos.ticker})</span>
                            )}
                            <span className="text-muted-foreground text-[10px] block">
                              Sell ~{pos.recommendedUnitsToHarvest.toFixed(1)} units • {pos.holdingDays}d held
                            </span>
                          </div>
                          <div className="text-right font-mono">
                            <span className="text-emerald-400 font-bold block">
                              +{pos.harvestedGainsAmount.formatIndianCompact()}
                            </span>
                            <span className="text-[9px] text-muted-foreground">
                              Save ~{pos.taxSavedAmount.formatIndianCompact()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

