import { useMemo } from 'react';
import { PortfolioSummary } from '@wealthnest/domain';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import {
  HeroSummaryCard,
  KpiMetricCard,
  WEALTH_KPI_GRID,
  WEALTH_SURFACE,
  getPolarityBool,
  getPolarityTone,
} from '@/components/ui/DashboardPrimitives';
import { usePrivacy } from '@/lib/preferences/privacy-context';
import {
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Radio,
  Briefcase,
  Coins,
  Layers,
} from 'lucide-react';
import { PortfolioMemberRef, findLiveQuote } from './portfolio-table-shared';
import { ASSET_CLASS_META_MAP } from './portfolio-demo-data';
import { HoldingDetailDto, MarketQuoteDto } from '@wealthnest/application';

interface PortfolioOverviewCardsProps {
  readonly summary: PortfolioSummary;
  readonly positionsCount: number;
  readonly selectedClassFilter: string | null;
  readonly onToggleClassFilter: (assetClassId: string) => void;
  readonly members: readonly PortfolioMemberRef[];
  readonly activeHoldings: readonly HoldingDetailDto[];
  readonly onRefresh?: () => void;
  readonly isRefreshing?: boolean;
  readonly isSyncing?: boolean;
  readonly isPolling?: boolean;
  readonly onTogglePolling?: () => void;
  readonly lastUpdatedAt?: Date | null;
  readonly liveQuotesMap?: ReadonlyMap<string, MarketQuoteDto>;
}

function formatUpdatedTimestamp(date: Date | null): string {
  if (!date || isNaN(date.getTime())) return '—';
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface EnrichedAllocationCategory {
  readonly assetClassId: string;
  readonly name: string;
  readonly colorHex: string;
  readonly currentValueRupees: number;
  readonly costBasisRupees: number;
  readonly gainLossRupees: number;
  readonly returnPct: number;
  readonly allocationPct: number;
  readonly holdingCount: number;
  readonly hasVerifiedCost: boolean;
}

/**
 * Phase 2 & Phase 3A Portfolio Summary Hero, 4 Compact KPI Cards & Asset Allocation Breakdown:
 * - Zero-safe 3-state polarity (neutral when ₹0 / 0.00%, never red loss on empty portfolio).
 * - Rich Asset Allocation breakdown with Current Value, % Allocation, Invested Amount, and Gain/Loss per category.
 */
export function PortfolioOverviewCards({
  summary,
  positionsCount,
  selectedClassFilter,
  onToggleClassFilter,
  members,
  activeHoldings,
  isSyncing = false,
  isPolling = false,
  onTogglePolling,
  lastUpdatedAt = null,
  liveQuotesMap,
}: PortfolioOverviewCardsProps) {
  const { hideBalances, toggleHideBalances } = usePrivacy();

  const totalValueRupees = summary.totalValue.toDecimal();
  const totalCostBasisRupees = summary.totalCostBasis.toDecimal();
  const unrealizedGainLossRupees = summary.unrealizedGainLoss.toDecimal();
  const returnPercentage = summary.returnPercentage;

  const overallTone = getPolarityTone(unrealizedGainLossRupees);
  const overallPolarityBool = getPolarityBool(unrealizedGainLossRupees);

  const unverifiedCostCount = useMemo(
    () => activeHoldings.filter((h) => h.costBasisVerified === false).length,
    [activeHoldings]
  );

  // Derive intraday change strictly from live matched quotes when available
  const liveIntraday = useMemo(() => {
    if (!liveQuotesMap || liveQuotesMap.size === 0 || activeHoldings.length === 0) {
      return null;
    }
    let matchedValueCents = 0;
    let weightedChangeCents = 0;
    for (const h of activeHoldings) {
      const q = findLiveQuote(h, liveQuotesMap);
      if (q && Number.isFinite(q.changePercent)) {
        matchedValueCents += h.currentValueCents;
        weightedChangeCents += (h.currentValueCents * q.changePercent) / 100;
      }
    }
    if (matchedValueCents <= 0) return null;
    return {
      changePct: (weightedChangeCents / matchedValueCents) * 100,
      changeRupees: weightedChangeCents / 100,
    };
  }, [activeHoldings, liveQuotesMap]);

  const effectiveLastUpdated = useMemo(() => {
    if (lastUpdatedAt) return lastUpdatedAt;
    let latestMs = 0;
    for (const h of activeHoldings) {
      if (h.updatedAt) {
        const ms = Date.parse(h.updatedAt);
        if (!isNaN(ms) && ms > latestMs) latestMs = ms;
      }
    }
    return latestMs > 0 ? new Date(latestMs) : null;
  }, [lastUpdatedAt, activeHoldings]);

  // Phase 3A: Enrich each asset category with Current Value, % Allocation, Invested Cost, and Gain/Loss
  const enrichedCategories: EnrichedAllocationCategory[] = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        colorHex: string;
        valueCents: number;
        costCents: number;
        holdingCount: number;
        hasVerifiedCost: boolean;
      }
    >();

    let totalCents = 0;
    for (const h of activeHoldings) {
      const classId = h.assetClassId || 'equity';
      const meta = ASSET_CLASS_META_MAP[classId];
      const valCents = h.currentValueCents || 0;
      const verified = h.costBasisVerified !== false;
      const costCents = verified ? Math.round((h.quantity || 0) * (h.unitCostCents || 0)) : 0;
      totalCents += valCents;

      const existing = map.get(classId);
      if (existing) {
        existing.valueCents += valCents;
        existing.costCents += costCents;
        existing.holdingCount += 1;
        if (verified && costCents > 0) existing.hasVerifiedCost = true;
      } else {
        map.set(classId, {
          name: meta?.name || h.assetClassName || classId,
          colorHex: meta?.color || h.assetClassColor || '#3b82f6',
          valueCents: valCents,
          costCents,
          holdingCount: 1,
          hasVerifiedCost: verified && costCents > 0,
        });
      }
    }

    const list: EnrichedAllocationCategory[] = Array.from(map.entries()).map(([classId, item]) => {
      const currentValueRupees = item.valueCents / 100;
      const costBasisRupees = item.costCents / 100;
      const gainLossRupees = currentValueRupees - costBasisRupees;
      const returnPct = costBasisRupees > 0 ? (gainLossRupees / costBasisRupees) * 100 : 0;
      const allocationPct = totalCents > 0 ? (item.valueCents / totalCents) * 100 : 0;

      return {
        assetClassId: classId,
        name: item.name,
        colorHex: item.colorHex,
        currentValueRupees,
        costBasisRupees,
        gainLossRupees,
        returnPct,
        allocationPct,
        holdingCount: item.holdingCount,
        hasVerifiedCost: item.hasVerifiedCost,
      };
    });

    list.sort((a, b) => b.currentValueRupees - a.currentValueRupees);
    return list;
  }, [activeHoldings]);

  // Compute Top Family Contributors strictly from actual holding ownership records
  const familyContributors = useMemo(() => {
    const memberValueMap = new Map<string, number>();
    let totalPortfolioCents = 0;

    activeHoldings.forEach((h) => {
      const val = h.currentValueCents || 0;
      totalPortfolioCents += val;

      if (h.owners && h.owners.length > 0) {
        h.owners.forEach((o) => {
          const shareVal = val * (o.ownershipShare / 100);
          memberValueMap.set(o.familyMemberId, (memberValueMap.get(o.familyMemberId) || 0) + shareVal);
        });
      } else {
        const ownerId = h.memberId || 'mem-self';
        memberValueMap.set(ownerId, (memberValueMap.get(ownerId) || 0) + val);
      }
    });

    if (totalPortfolioCents <= 0) {
      return [];
    }

    const contributors = Array.from(memberValueMap.entries())
      .filter(([, valCents]) => valCents > 0)
      .map(([memberId, valCents]) => {
        const member = members.find((m) => m.id === memberId);
        const sharePct = (valCents / totalPortfolioCents) * 100;
        return {
          id: memberId,
          name: member?.name || 'Member',
          sharePct,
          color: member?.colorHex || '#3b82f6',
        };
      });

    contributors.sort((a, b) => b.sharePct - a.sharePct);
    return contributors.slice(0, 5);
  }, [activeHoldings, members]);

  // Dynamic Donut segments from actual asset allocations
  const donutSegments = useMemo(() => {
    let cumulativeOffset = 0;
    return summary.allocations.map((alloc) => {
      const seg = {
        ...alloc,
        offset: cumulativeOffset,
      };
      cumulativeOffset += alloc.percentage;
      return seg;
    });
  }, [summary.allocations]);

  const topAllocation = summary.allocations[0];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Row 1: Portfolio Summary Hero + Asset Allocation & Family Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
        <HeroSummaryCard
          title="TOTAL PORTFOLIO VALUE"
          amountRupees={totalValueRupees}
          isSyncing={isSyncing}
          className="lg:col-span-7 flex flex-col justify-between"
          headerActions={
            <button
              type="button"
              onClick={toggleHideBalances}
              className="hover:text-foreground transition-colors p-1 rounded-md"
              title={hideBalances ? 'Show Balances' : 'Hide Balances'}
              aria-label={hideBalances ? 'Show Balances' : 'Hide Balances'}
            >
              {hideBalances ? (
                <EyeOff className="w-4 h-4 text-amber-400" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          }
          badges={
            <>
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${overallTone.badge}`}
              >
                {unrealizedGainLossRupees > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : unrealizedGainLossRupees < 0 ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
                <span>
                  Overall: {unrealizedGainLossRupees > 0 ? '+' : ''}
                  {returnPercentage.toFixed(2)}%
                </span>
              </span>

              {liveIntraday && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${
                    getPolarityTone(liveIntraday.changePct).badge
                  }`}
                >
                  {liveIntraday.changePct > 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : liveIntraday.changePct < 0 ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : (
                    <Minus className="w-3.5 h-3.5" />
                  )}
                  <span>
                    Day: {liveIntraday.changePct > 0 ? '+' : ''}
                    {liveIntraday.changePct.toFixed(2)}%
                  </span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-secondary/70 text-muted-foreground border border-border/60">
                <span>
                  {positionsCount} {positionsCount === 1 ? 'Holding' : 'Holdings'}
                </span>
              </span>
            </>
          }
          metaRow={
            <>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3 shrink-0" />
                <span>Updated {formatUpdatedTimestamp(effectiveLastUpdated)}</span>
              </span>

              {onTogglePolling && (
                <button
                  type="button"
                  onClick={onTogglePolling}
                  aria-pressed={isPolling}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors touch-manipulation ${
                    isPolling
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-secondary/60 text-muted-foreground border-border/60 hover:text-foreground'
                  }`}
                  title="Toggle 25s automatic live quote polling"
                >
                  <Radio className={`w-3 h-3 ${isPolling ? 'animate-pulse' : ''}`} />
                  <span>Auto-Poll: {isPolling ? 'On (25s)' : 'Off'}</span>
                </button>
              )}
            </>
          }
        >
          {/* Compact 3-Metric Hero Summary Strip */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                Total Cost Basis
              </span>
              <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                <CurrencyDisplay amount={totalCostBasisRupees} allowToggle />
              </div>
            </div>

            <div>
              <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                Profit / Loss
              </span>
              <div className="text-sm font-bold font-mono mt-0.5">
                <CurrencyDisplay
                  amount={unrealizedGainLossRupees}
                  showSign={unrealizedGainLossRupees !== 0}
                  isPositiveColor={overallPolarityBool}
                  allowToggle
                />
              </div>
            </div>

            <div>
              <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                Positions
              </span>
              <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                {positionsCount} ({summary.allocations.length}{' '}
                {summary.allocations.length === 1 ? 'type' : 'types'})
              </div>
            </div>
          </div>
        </HeroSummaryCard>

        {/* Phase 3A: Asset Allocation Chart & Category Breakdown Card */}
        <Card className={`lg:col-span-5 ${WEALTH_SURFACE} flex flex-col justify-between`}>
          <CardHeader className="pb-2 p-4 sm:p-6 sm:pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Allocation &amp; Family Split
            </CardTitle>
            {selectedClassFilter && (
              <button
                type="button"
                onClick={() => onToggleClassFilter(selectedClassFilter)}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Reset filter
              </button>
            )}
          </CardHeader>

          <CardContent className="space-y-3.5 p-4 pt-1 sm:p-6 sm:pt-1">
            {/* Segmented allocation bar */}
            <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-secondary/60 p-0.5 border border-border/50">
              {summary.allocations.length > 0 ? (
                summary.allocations.map((alloc) => (
                  <div
                    key={alloc.assetClassId}
                    title={`${alloc.name}: ${alloc.percentage.toFixed(1)}%`}
                    style={{
                      width: `${Math.max(alloc.percentage, 1)}%`,
                      backgroundColor: alloc.colorHex || '#3b82f6',
                    }}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
                  />
                ))
              ) : (
                <div className="w-full bg-muted rounded-full" />
              )}
            </div>

            {/* Category Breakdown List (Current Value, % Share, Invested Cost, Gain/Loss) */}
            {enrichedCategories.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto overscroll-contain pr-0.5">
                {enrichedCategories.map((cat) => {
                  const isSelected = selectedClassFilter === cat.assetClassId;
                  const catPolarityBool = getPolarityBool(cat.gainLossRupees);
                  return (
                    <button
                      key={cat.assetClassId}
                      type="button"
                      onClick={() => onToggleClassFilter(cat.assetClassId)}
                      className={`w-full p-2 rounded-xl border text-left transition-all touch-manipulation active:scale-[0.99] ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-xs'
                          : 'border-border/60 bg-secondary/25 hover:border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.colorHex }}
                          />
                          <span className="font-semibold text-foreground truncate">{cat.name}</span>
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                            ({cat.allocationPct.toFixed(1)}%)
                          </span>
                        </div>
                        <span className="font-bold font-mono text-foreground shrink-0">
                          <CurrencyDisplay amount={cat.currentValueRupees} allowToggle />
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 font-mono">
                        <span>
                          Invested:{' '}
                          {cat.hasVerifiedCost ? (
                            <CurrencyDisplay amount={cat.costBasisRupees} allowToggle />
                          ) : (
                            'Unverified'
                          )}
                        </span>
                        {cat.hasVerifiedCost ? (
                          <span>
                            <CurrencyDisplay
                              amount={cat.gainLossRupees}
                              showSign={cat.gainLossRupees !== 0}
                              isPositiveColor={catPolarityBool}
                              allowToggle
                            />{' '}
                            <span
                              className={
                                cat.gainLossRupees > 0
                                  ? 'text-emerald-400'
                                  : cat.gainLossRupees < 0
                                    ? 'text-rose-400'
                                    : 'text-muted-foreground'
                              }
                            >
                              ({cat.gainLossRupees > 0 ? '+' : ''}
                              {cat.returnPct.toFixed(1)}%)
                            </span>
                          </span>
                        ) : (
                          <span className="italic text-[10px]">CAS balance</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-1">
                No holdings to display asset allocation.
              </p>
            )}

            {/* Dynamic Donut Chart + Factual Top Family Contributors */}
            <div className="border-t border-border/50 pt-3 flex items-center justify-between gap-4">
              <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="transparent"
                    stroke="#1e293b"
                    strokeWidth="4"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.assetClassId}
                      cx="18"
                      cy="18"
                      r="14"
                      fill="transparent"
                      stroke={seg.colorHex || '#3b82f6'}
                      strokeWidth="4"
                      strokeDasharray={`${seg.percentage} ${Math.max(0, 100 - seg.percentage)}`}
                      strokeDashoffset={`-${seg.offset}`}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] text-muted-foreground font-mono">
                  <span>Holdings</span>
                  <span className="text-xs font-bold text-foreground">{positionsCount}</span>
                </div>
              </div>

              <div className="flex-1 space-y-1 min-w-0">
                <span className="block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Top Family Contributors
                </span>
                {familyContributors.length > 0 ? (
                  <div className="space-y-1">
                    {familyContributors.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="text-foreground truncate">{c.name}</span>
                        </div>
                        <span className="font-mono font-semibold text-foreground shrink-0">
                          {c.sharePct.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No entity holdings yet</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Four Compact KPI Cards */}
      <div className={WEALTH_KPI_GRID}>
        <KpiMetricCard
          label="Portfolio Value"
          amountRupees={totalValueRupees}
          isSyncing={isSyncing}
          subtext={`${positionsCount} ${positionsCount === 1 ? 'position' : 'positions'}`}
          icon={<Briefcase className="w-3.5 h-3.5 text-primary" />}
        />

        <KpiMetricCard
          label="Cost Basis"
          amountRupees={totalCostBasisRupees}
          isSyncing={isSyncing}
          subtext={
            unverifiedCostCount > 0
              ? `${unverifiedCostCount} unverified cost`
              : 'Historical investment cost'
          }
          icon={<Coins className="w-3.5 h-3.5 text-cyan-400" />}
        />

        <KpiMetricCard
          label="Unrealized P/L"
          amountRupees={unrealizedGainLossRupees}
          showSign={unrealizedGainLossRupees !== 0}
          isPositiveColor={overallPolarityBool}
          isSyncing={isSyncing}
          subtext="Gain / Loss"
          badge={
            <span
              className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${overallTone.badge}`}
            >
              {unrealizedGainLossRupees > 0 ? '+' : ''}
              {returnPercentage.toFixed(2)}%
            </span>
          }
          icon={
            unrealizedGainLossRupees > 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : unrealizedGainLossRupees < 0 ? (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-muted-foreground" />
            )
          }
        />

        <KpiMetricCard
          label="Asset Diversity"
          displayValue={
            <span>
              {positionsCount} {positionsCount === 1 ? 'Holding' : 'Holdings'}
            </span>
          }
          isSyncing={isSyncing}
          subtext={`${summary.allocations.length} ${
            summary.allocations.length === 1 ? 'category' : 'categories'
          }`}
          badge={
            topAllocation ? (
              <span className="text-[10px] font-mono text-muted-foreground">
                Top: {topAllocation.percentage.toFixed(0)}%
              </span>
            ) : undefined
          }
          icon={<Layers className="w-3.5 h-3.5 text-amber-400" />}
        />
      </div>
    </div>
  );
}
