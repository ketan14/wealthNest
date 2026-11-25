import { useState, useMemo } from 'react';
import { HoldingDetailDto, LiabilityDto, MarketQuoteDto } from '@wealthnest/application';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { getPolarityBool } from '@/components/ui/DashboardPrimitives';
import { RealEstateSubView } from '@/components/portfolio/RealEstateSubView';
import { EquitiesHoldingsTable } from '@/components/portfolio/EquitiesHoldingsTable';
import { MutualFundsHoldingsTable } from '@/components/portfolio/MutualFundsHoldingsTable';
import { GroupedHoldingsView } from '@/components/portfolio/GroupedHoldingsView';
import { AllHoldingsTable } from '@/components/portfolio/AllHoldingsTable';
import {
  HoldingSortField,
  matchesPortfolioCategory,
  sortHoldings,
} from '@/components/portfolio/portfolio-calculations';
import {
  EquitiesSubtotals,
  GroupedHoldingBucket,
  MfSubtotals,
  PortfolioAccountRef,
  PortfolioMemberRef,
} from './portfolio-table-shared';
import { AlertCircle, ArrowUpDown, Database, FileSpreadsheet, Plus, Search } from 'lucide-react';

export type PortfolioViewMode = 'all' | 'equities' | 'mutual_funds' | 'real_estate' | 'grouped';

interface PortfolioHoldingsSectionProps {
  readonly viewMode: PortfolioViewMode;
  readonly onViewModeChange: (mode: PortfolioViewMode) => void;
  readonly searchQuery: string;
  readonly onSearchQueryChange: (query: string) => void;
  readonly selectedClassFilter: string | null;
  readonly onSelectClassFilter?: (classId: string | null) => void;
  readonly onClearClassFilter: () => void;
  readonly deleteError: string | null;
  readonly onDismissDeleteError: () => void;
  readonly isLoadingDb: boolean;
  readonly isAuthenticated: boolean;
  readonly canEditFinancials?: boolean;
  readonly isMobile: boolean;
  readonly activeHoldings: readonly HoldingDetailDto[];
  readonly filteredHoldings: readonly HoldingDetailDto[];
  readonly equitiesHoldings: readonly HoldingDetailDto[];
  readonly mutualFundHoldings: readonly HoldingDetailDto[];
  readonly groupedHoldings: readonly GroupedHoldingBucket[];
  readonly equitiesSubtotals: EquitiesSubtotals;
  readonly mfSubtotals: MfSubtotals;
  readonly liabilities: readonly LiabilityDto[];
  readonly members: readonly PortfolioMemberRef[];
  readonly accounts: readonly PortfolioAccountRef[];
  readonly liveQuotesMap: ReadonlyMap<string, MarketQuoteDto>;
  readonly currencySymbol: string;
  readonly locale: string;
  readonly deletingId: string | null;
  readonly onOpenAddModal: () => void;
  readonly onOpenImportModal: () => void;
  readonly onSeedStarterHoldings: () => void;
  readonly onEditHolding: (holding: HoldingDetailDto) => void;
  readonly onDeleteHolding: (holding: HoldingDetailDto) => void;
}

const CATEGORY_TABS: readonly { id: string | null; label: string }[] = [
  { id: null, label: 'All' },
  { id: 'equity', label: 'Equities' },
  { id: 'mutual_fund', label: 'Mutual Funds' },
  { id: 'commodity', label: 'Gold' },
  { id: 'fixed_income', label: 'Bonds & Debt' },
  { id: 'real_estate', label: 'Real Estate' },
  { id: 'others', label: 'Others' },
];

/**
 * Phase 3B & 3C Portfolio Holdings Card:
 * - Compact Category Navigation tabs updating holdings and active category summary.
 * - Specialized view switcher (All Investments, Direct Equities & ETFs, Mutual Funds, Real Estate, By Asset Class).
 * - Search + Sort controls + Privacy-aware Holdings tables/cards.
 */
export function PortfolioHoldingsSection({
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchQueryChange,
  selectedClassFilter,
  onSelectClassFilter,
  onClearClassFilter,
  deleteError,
  onDismissDeleteError,
  isLoadingDb,
  isAuthenticated,
  canEditFinancials = true,
  isMobile,
  activeHoldings,
  filteredHoldings,
  equitiesHoldings,
  mutualFundHoldings,
  groupedHoldings,
  equitiesSubtotals,
  mfSubtotals,
  liabilities,
  members,
  accounts,
  liveQuotesMap,
  currencySymbol,
  locale,
  deletingId,
  onOpenAddModal,
  onOpenImportModal,
  onSeedStarterHoldings,
  onEditHolding,
  onDeleteHolding,
}: PortfolioHoldingsSectionProps) {
  const [sortBy, setSortBy] = useState<HoldingSortField>('default');

  const realEstateCount = activeHoldings.filter(
    (h) => h.assetClassId === 'real_estate' || h.assetClassId === 'property'
  ).length;

  const categoryCounts = useMemo(() => {
    const counts = new Map<string | null, number>();
    counts.set(null, activeHoldings.length);
    for (const tab of CATEGORY_TABS) {
      if (tab.id !== null) {
        counts.set(
          tab.id,
          activeHoldings.filter((h) => matchesPortfolioCategory(h.assetClassId, tab.id)).length
        );
      }
    }
    return counts;
  }, [activeHoldings]);

  const sortedFilteredHoldings = useMemo(
    () => sortHoldings(filteredHoldings, sortBy),
    [filteredHoldings, sortBy]
  );
  const sortedEquitiesHoldings = useMemo(
    () => sortHoldings(equitiesHoldings, sortBy),
    [equitiesHoldings, sortBy]
  );
  const sortedMutualFundHoldings = useMemo(
    () => sortHoldings(mutualFundHoldings, sortBy),
    [mutualFundHoldings, sortBy]
  );

  // Active filtered category summary (when category tab or search filter is active)
  const filteredCategorySummary = useMemo(() => {
    let valCents = 0;
    let costCents = 0;
    let verifiedCount = 0;
    for (const h of filteredHoldings) {
      valCents += h.currentValueCents || 0;
      if (h.costBasisVerified !== false) {
        costCents += Math.round((h.quantity || 0) * (h.unitCostCents || 0));
        verifiedCount++;
      }
    }
    return {
      valueRupees: valCents / 100,
      costRupees: costCents / 100,
      gainRupees: (valCents - costCents) / 100,
      hasVerified: verifiedCount > 0,
    };
  }, [filteredHoldings]);

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Portfolio Holdings</CardTitle>
            <CardDescription>
              Tailored views for Direct Equities, Mutual Funds, and Consolidated Portfolio.
            </CardDescription>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter ticker, ISIN, folio..."
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs rounded-lg bg-secondary/50 border border-border focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-52 font-mono text-foreground"
              />
            </div>

            <div className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-muted-foreground">
              <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
              <select
                aria-label="Sort holdings"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as HoldingSortField)}
                className="bg-transparent text-foreground text-xs focus:outline-none cursor-pointer"
              >
                <option value="default">Sort: Default</option>
                <option value="value_desc">Value (High → Low)</option>
                <option value="gain_pct_desc">Return % (High → Low)</option>
                <option value="cost_desc">Invested (High → Low)</option>
                <option value="name_asc">Name (A → Z)</option>
                <option value="updated_desc">Last Updated</option>
              </select>
            </div>

            {selectedClassFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearClassFilter}
                className="text-xs h-8 text-primary"
              >
                Clear Filter
              </Button>
            )}
          </div>
        </div>

        {/* Phase 3B: Compact Category Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar py-0.5">
          {CATEGORY_TABS.map((tab) => {
            const count = categoryCounts.get(tab.id) ?? 0;
            const isSelected = selectedClassFilter === tab.id;
            return (
              <button
                key={tab.id ?? 'all'}
                type="button"
                onClick={() => {
                  onSelectClassFilter?.(tab.id);
                  if (viewMode !== 'all' && viewMode !== 'grouped') {
                    onViewModeChange('all');
                  }
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 inline-flex items-center gap-1.5 touch-manipulation ${
                  isSelected
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-secondary/50 text-muted-foreground hover:text-foreground border border-border/60'
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono text-[10px] opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Specialized Table View Mode Switcher */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-border/40">
          <div className="flex items-center p-0.5 bg-secondary/60 rounded-lg border border-border text-xs max-w-full overflow-x-auto overscroll-x-contain no-scrollbar">
            <button
              type="button"
              onClick={() => onViewModeChange('all')}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-all ${
                viewMode === 'all'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Investments ({activeHoldings.length})
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('equities')}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                viewMode === 'equities'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Direct Equities &amp; ETFs</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-background/20 font-bold">
                {equitiesHoldings.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('mutual_funds')}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                viewMode === 'mutual_funds'
                  ? 'bg-cyan-600 text-white shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Mutual Funds</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-background/20 font-bold">
                {mutualFundHoldings.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('real_estate')}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                viewMode === 'real_estate'
                  ? 'bg-amber-600 text-white shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Real Estate &amp; Land</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-background/20 font-bold">
                {realEstateCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('grouped')}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-all ${
                viewMode === 'grouped'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              By Asset Class
            </button>
          </div>

          {/* Active Filter Subtotal Pill */}
          {(selectedClassFilter || searchQuery.trim()) && filteredHoldings.length > 0 && (
            <div className="flex items-center gap-3 text-xs font-mono bg-secondary/40 px-3 py-1 rounded-lg border border-border/60">
              <span className="text-muted-foreground">
                Showing <strong className="text-foreground">{filteredHoldings.length}</strong>:
              </span>
              <span className="font-bold text-foreground">
                <CurrencyDisplay amount={filteredCategorySummary.valueRupees} allowToggle />
              </span>
              {filteredCategorySummary.hasVerified && (
                <span>
                  <CurrencyDisplay
                    amount={filteredCategorySummary.gainRupees}
                    showSign={filteredCategorySummary.gainRupees !== 0}
                    isPositiveColor={getPolarityBool(filteredCategorySummary.gainRupees)}
                    allowToggle
                  />
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {deleteError && (
          <div className="p-3 mx-4 my-3 rounded-xl bg-destructive/15 text-destructive border border-destructive/30 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
            <button
              onClick={onDismissDeleteError}
              className="text-xs hover:underline font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {isLoadingDb ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Connecting to PostgreSQL and calculating balances...
          </div>
        ) : filteredHoldings.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-secondary/60 mx-auto flex items-center justify-center text-muted-foreground">
              <Database className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">No holdings found</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {activeHoldings.length === 0
                ? 'Your personal portfolio is currently empty. Add your first position or seed starter assets.'
                : 'No positions matched your search criteria.'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
              <Button
                size="sm"
                onClick={onOpenAddModal}
                disabled={!canEditFinancials}
                title={
                  !canEditFinancials ? 'View-only household role cannot add holdings' : undefined
                }
                className="gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Holding
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenImportModal}
                disabled={!canEditFinancials}
                title={
                  !canEditFinancials ? 'View-only household role cannot import CAS' : undefined
                }
                className="gap-1.5 text-xs font-mono"
              >
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                Import CAS
              </Button>
              {isAuthenticated && activeHoldings.length === 0 && canEditFinancials && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSeedStarterHoldings}
                  className="gap-1.5 text-xs font-mono"
                >
                  Seed Starter Assets
                </Button>
              )}
            </div>
          </div>
        ) : viewMode === 'equities' ? (
          <EquitiesHoldingsTable
            equitiesHoldings={sortedEquitiesHoldings}
            equitiesSubtotals={equitiesSubtotals}
            members={members}
            accounts={accounts}
            liveQuotesMap={liveQuotesMap}
            currencySymbol={currencySymbol}
            locale={locale}
            deletingId={deletingId}
            onEdit={onEditHolding}
            onDelete={onDeleteHolding}
          />
        ) : viewMode === 'mutual_funds' ? (
          <MutualFundsHoldingsTable
            mutualFundHoldings={sortedMutualFundHoldings}
            mfSubtotals={mfSubtotals}
            members={members}
            accounts={accounts}
            currencySymbol={currencySymbol}
            locale={locale}
            deletingId={deletingId}
            onEdit={onEditHolding}
            onDelete={onDeleteHolding}
          />
        ) : viewMode === 'real_estate' ? (
          <div className="p-4 sm:p-6">
            <RealEstateSubView
              holdings={[...activeHoldings]}
              liabilities={[...liabilities]}
              onAddProperty={onOpenAddModal}
              onEditValuation={onEditHolding}
            />
          </div>
        ) : viewMode === 'grouped' ? (
          <GroupedHoldingsView
            groupedHoldings={groupedHoldings}
            currencySymbol={currencySymbol}
            locale={locale}
            deletingId={deletingId}
            onEdit={onEditHolding}
            onDelete={onDeleteHolding}
          />
        ) : (
          <AllHoldingsTable
            filteredHoldings={sortedFilteredHoldings}
            isMobile={isMobile}
            members={members}
            accounts={accounts}
            liveQuotesMap={liveQuotesMap}
            currencySymbol={currencySymbol}
            locale={locale}
            deletingId={deletingId}
            onEdit={onEditHolding}
            onDelete={onDeleteHolding}
          />
        )}
      </CardContent>
    </Card>
  );
}
