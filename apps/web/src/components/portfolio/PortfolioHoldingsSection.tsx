import { HoldingDetailDto, LiabilityDto, MarketQuoteDto } from '@wealthnest/application';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RealEstateSubView } from '@/components/portfolio/RealEstateSubView';
import { EquitiesHoldingsTable } from '@/components/portfolio/EquitiesHoldingsTable';
import { MutualFundsHoldingsTable } from '@/components/portfolio/MutualFundsHoldingsTable';
import { GroupedHoldingsView } from '@/components/portfolio/GroupedHoldingsView';
import { AllHoldingsTable } from '@/components/portfolio/AllHoldingsTable';
import {
  EquitiesSubtotals,
  GroupedHoldingBucket,
  MfSubtotals,
  PortfolioAccountRef,
  PortfolioMemberRef,
} from './portfolio-table-shared';
import { AlertCircle, Database, FileSpreadsheet, Plus, Search } from 'lucide-react';

export type PortfolioViewMode = 'all' | 'equities' | 'mutual_funds' | 'real_estate' | 'grouped';

interface PortfolioHoldingsSectionProps {
  readonly viewMode: PortfolioViewMode;
  readonly onViewModeChange: (mode: PortfolioViewMode) => void;
  readonly searchQuery: string;
  readonly onSearchQueryChange: (query: string) => void;
  readonly selectedClassFilter: string | null;
  readonly onClearClassFilter: () => void;
  readonly deleteError: string | null;
  readonly onDismissDeleteError: () => void;
  readonly isLoadingDb: boolean;
  readonly isAuthenticated: boolean;
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

/**
 * Renders the Portfolio Holdings card with view-mode switcher, search/class filtering,
 * empty/loading states, and tailored sub-views for Equities, Mutual Funds, Real Estate, and Grouped holdings.
 */
export function PortfolioHoldingsSection({
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchQueryChange,
  selectedClassFilter,
  onClearClassFilter,
  deleteError,
  onDismissDeleteError,
  isLoadingDb,
  isAuthenticated,
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
  const realEstateCount = activeHoldings.filter(
    (h) => h.assetClassId === 'real_estate' || h.assetClassId === 'property'
  ).length;

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Portfolio Holdings</CardTitle>
            <CardDescription>
              Tailored views for Direct Equities, Mutual Funds, and Consolidated Portfolio.
            </CardDescription>
          </div>

          {/* View Mode Toggle and Filter/Search */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Specialized View Switcher */}
            <div className="flex items-center p-0.5 bg-secondary/60 rounded-lg border border-border text-xs max-w-full overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => onViewModeChange('all')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
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
                className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'equities'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Direct Equities & ETFs</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-background/20 font-bold">
                  {equitiesHoldings.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('mutual_funds')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
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
                className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'real_estate'
                    ? 'bg-amber-600 text-white shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Real Estate & Land</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-background/20 font-bold">
                  {realEstateCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('grouped')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  viewMode === 'grouped'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                By Asset Class
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter ticker, ISIN, folio..."
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs rounded-lg bg-secondary/50 border border-border focus:outline-none focus:ring-1 focus:ring-primary w-40 sm:w-56 font-mono text-foreground"
              />
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
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button size="sm" onClick={onOpenAddModal} className="gap-1.5">
                <Plus className="w-4 h-4" />
                Add Holding
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenImportModal}
                className="gap-1.5 text-xs font-mono"
              >
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                Import CAS
              </Button>
              {isAuthenticated && activeHoldings.length === 0 && (
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
            equitiesHoldings={equitiesHoldings}
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
            mutualFundHoldings={mutualFundHoldings}
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
            filteredHoldings={filteredHoldings}
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
