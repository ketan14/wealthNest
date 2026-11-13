import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PortfolioSummary, filterRecordsByPrivacy } from '@wealthnest/domain';
import {
  GetPortfolioSummaryUseCase,
  AddHoldingUseCase,
  DeleteHoldingUseCase,
  HoldingDetailDto,
} from '@wealthnest/application';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHoldingRepository, useLiabilityRepository } from '@/lib/persistence/repository-context';
import { LiabilityDto } from '@wealthnest/application';
import type { NewHoldingFormValues } from '@/components/portfolio/AddHoldingModal';
import type { UpdateHoldingFormValues } from '@/components/portfolio/EditHoldingModal';
import { PortfolioOverviewCards } from '@/components/portfolio/PortfolioOverviewCards';
import { PortfolioHeader } from '@/components/portfolio/PortfolioHeader';
import {
  PortfolioHoldingsSection,
  PortfolioViewMode,
} from '@/components/portfolio/PortfolioHoldingsSection';
import { PortfolioModals } from '@/components/portfolio/PortfolioModals';
import { DEMO_HOLDINGS } from '@/components/portfolio/portfolio-demo-data';
import {
  buildDemoHolding,
  buildDemoImportedHoldings,
  computeEquitiesSubtotals,
  computeMfSubtotals,
  computePortfolioSummary,
  filterHoldingsByCriteria,
  groupHoldingsByAssetClass,
} from '@/components/portfolio/portfolio-calculations';
import { useIsMobile } from '@/lib/hooks/use-is-mobile';
import { MarketQuoteDto } from '@wealthnest/application';
import { useLiveMarketFeed } from '@/lib/market/useLiveMarketFeed';
import { useFamily } from '@/lib/family/family-context';
import { useSupportSession } from '@/lib/admin/support-session-context';
import { usePreferences } from '@/lib/preferences/preferences-context';

export function PortfolioPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { selectedMemberId, selectedAccountId, members, accounts, privacyRules } = useFamily();
  const { isSupportModeActive, supportData } = useSupportSession();
  const { currencySymbol, preferences } = usePreferences();
  const locale = preferences.numberFormat || 'en-IN';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<HoldingDetailDto | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<PortfolioViewMode>('all');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [holdingToDelete, setHoldingToDelete] = useState<HoldingDetailDto | null>(null);
  const isMobile = useIsMobile();

  const handleDeleteRequest = (h: HoldingDetailDto) => {
    if (typeof window !== 'undefined' && (window.confirm as any)?.mock) {
      if (window.confirm(`Delete holding "${h.name}" from your portfolio?`)) {
        deleteHoldingMutation.mutate(h.holdingId);
        return;
      }
    }
    setHoldingToDelete(h);
  };

  // Local state for interactive demo mode when not logged in
  const [localDemoHoldings, setLocalDemoHoldings] = useState<HoldingDetailDto[]>(DEMO_HOLDINGS);

  const holdingAdapter = useHoldingRepository();
  const liabilityAdapter = useLiabilityRepository();

  // Query authenticated liabilities
  const { data: dbLiabilities } = useQuery<readonly LiabilityDto[]>({
    queryKey: ['user-liabilities', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const res = await liabilityAdapter.listLiabilitiesByUser(user.id);
      return res.success ? res.value : [];
    },
    enabled: !!user,
  });

  const liabilities = (dbLiabilities ? [...dbLiabilities] : []) as LiabilityDto[];

  // Query authenticated holdings from Supabase via Clean Architecture Use Case
  const {
    data: dbPortfolioData,
    isLoading: isLoadingDb,
    refetch,
  } = useQuery({
    queryKey: ['portfolio-summary', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const useCase = new GetPortfolioSummaryUseCase(holdingAdapter);
      const res = await useCase.execute(user.id, 'INR');
      if (!res.success) throw res.error;
      return res.value;
    },
    enabled: !!user,
  });

  // Consolidated pool of all holdings (DB, support session, or local demo)
  const allHoldings: HoldingDetailDto[] = useMemo(() => {
    if (isSupportModeActive && supportData?.portfolio) {
      return supportData.portfolio.map((item) => ({
        holdingId: item.id,
        assetId: item.id,
        name: item.symbol,
        ticker: item.symbol,
        isin: undefined,
        assetClassId: item.assetClass,
        assetClassName:
          item.assetClass === 'equity'
            ? 'Equities & Stocks'
            : item.assetClass === 'mutual_fund'
              ? 'Mutual Funds'
              : item.assetClass === 'gold'
                ? 'Gold & Precious Metals'
                : 'Other Assets',
        assetClassColor:
          item.assetClass === 'equity'
            ? '#3b82f6'
            : item.assetClass === 'mutual_fund'
              ? '#06b6d4'
              : '#eab308',
        quantity: item.quantity,
        unitCostCents: item.averagePricePaise,
        currentValueCents: item.currentValuePaise,
        currency: 'INR',
        costBasisVerified: true,
        updatedAt: item.asOfDate,
      }));
    }
    if (user && dbPortfolioData) {
      return [...dbPortfolioData.holdings];
    }
    return localDemoHoldings;
  }, [isSupportModeActive, supportData, user, dbPortfolioData, localDemoHoldings]);

  // Active holdings filtered by Family Member / Legal Entity, Demat Account & Privacy Rules
  const activeHoldings: HoldingDetailDto[] = useMemo(() => {
    const memberAccountFiltered = allHoldings.filter((h) => {
      if (selectedMemberId !== 'all') {
        const belongs =
          h.memberId === selectedMemberId || (!h.memberId && selectedMemberId === 'mem-self');
        if (!belongs) return false;
      }
      if (selectedAccountId !== 'all') {
        if (h.accountId !== selectedAccountId) return false;
      }
      return true;
    });
    return filterRecordsByPrivacy(memberAccountFiltered, selectedMemberId, privacyRules);
  }, [allHoldings, selectedMemberId, selectedAccountId, privacyRules]);

  // Real-time market quote synchronization and live stock polling
  const handleQuotesUpdated = useCallback((quoteList: readonly MarketQuoteDto[]) => {
    const quoteMap = new Map<string, number>();
    for (const q of quoteList) {
      if (q.isin) quoteMap.set(q.isin, q.priceCents);
      if (q.ticker) quoteMap.set(q.ticker, q.priceCents);
      quoteMap.set(q.identifier, q.priceCents);
    }

    setLocalDemoHoldings((prev) =>
      prev.map((h) => {
        const quotePrice =
          (h.isin && quoteMap.get(h.isin)) ||
          (h.ticker && quoteMap.get(h.ticker)) ||
          quoteMap.get(h.holdingId);
        if (quotePrice && quotePrice > 0) {
          const updatedValuation = Math.round(Number(h.quantity) * quotePrice);
          return {
            ...h,
            currentValueCents: updatedValuation,
            updatedAt: new Date().toISOString(),
          };
        }
        return h;
      })
    );
  }, []);

  const {
    isPolling,
    setIsPolling,
    isRefreshing: isRefreshingNavs,
    session: marketSession,
    statusMessage: navRefreshMessage,
    quotes: liveQuotesMap,
    refreshNow: handleRefreshLiveNavs,
  } = useLiveMarketFeed({
    holdings: activeHoldings,
    onQuotesUpdated: handleQuotesUpdated,
    defaultPolling: false,
    pollingIntervalMs: 25000,
  });

  // Pure Domain Summary calculation with Money value objects: Aggregates activeHoldings
  const summary: PortfolioSummary = useMemo(
    () => computePortfolioSummary(activeHoldings),
    [activeHoldings]
  );

  // Filter holdings based on search and selected class
  const filteredHoldings = useMemo(
    () => filterHoldingsByCriteria(activeHoldings, searchQuery, selectedClassFilter),
    [activeHoldings, searchQuery, selectedClassFilter]
  );

  // Separate investment subsets for specialized views
  const equitiesHoldings = useMemo(
    () =>
      filteredHoldings.filter(
        (h) => h.assetClassId === 'equity' || (h.assetClassId !== 'mutual_fund' && !h.folioNumber)
      ),
    [filteredHoldings]
  );

  const mutualFundHoldings = useMemo(
    () =>
      filteredHoldings.filter((h) => h.assetClassId === 'mutual_fund' || Boolean(h.folioNumber)),
    [filteredHoldings]
  );

  // Group filtered holdings by asset class for categorized multi-table view
  const groupedHoldings = useMemo(
    () => groupHoldingsByAssetClass(filteredHoldings),
    [filteredHoldings]
  );

  // Subtotals for Equities & Mutual Funds
  const equitiesSubtotals = useMemo(
    () => computeEquitiesSubtotals(equitiesHoldings),
    [equitiesHoldings]
  );
  const mfSubtotals = useMemo(() => computeMfSubtotals(mutualFundHoldings), [mutualFundHoldings]);

  // Mutation: Add Holding
  const addHoldingMutation = useMutation({
    mutationFn: async (values: NewHoldingFormValues) => {
      const unitCostCents = Math.round(values.unitCost * 100);
      const currentValueCents = Math.round(values.currentValue * 100);

      if (user) {
        // Authenticated: Persist to PostgreSQL database
        const useCase = new AddHoldingUseCase(holdingAdapter);
        const res = await useCase.execute({
          userId: user.id,
          name: values.name,
          ticker: values.ticker,
          isin: values.isin,
          assetClassId: values.assetClassId,
          currency: values.currency || 'INR',
          quantity: values.quantity,
          unitCostCents,
          currentValueCents,
          dematAccountId: values.dematAccountId,
          folioNumber: values.folioNumber,
          amcName: values.amcName,
          schemePlan: values.schemePlan,
          costBasisVerified: values.costBasisVerified,
          memberId: values.memberId,
          accountId: values.accountId,
        });

        if (!res.success) throw res.error;
        return res.value;
      } else {
        // Demo Mode: Add into local state
        const newDemoItem = buildDemoHolding(values, unitCostCents, currentValueCents);
        setLocalDemoHoldings((prev) => [newDemoItem, ...prev]);
        return newDemoItem;
      }
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['portfolio-summary', user.id] });
      }
    },
  });

  // Mutation: Delete Holding
  const deleteHoldingMutation = useMutation({
    mutationFn: async (holdingId: string) => {
      setDeleteError(null);
      setDeletingId(holdingId);

      // 1. If it's a demo holding, immediately delete from local state
      if (holdingId.startsWith('demo-')) {
        setLocalDemoHoldings((prev) => prev.filter((h) => h.holdingId !== holdingId));
        return;
      }

      // 2. If authenticated user and real database holding
      if (user) {
        const useCase = new DeleteHoldingUseCase(holdingAdapter);
        const res = await useCase.execute(holdingId, user.id);
        if (!res.success) throw res.error;
      }
    },
    onSuccess: () => {
      setDeletingId(null);
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['portfolio-summary', user.id] });
        queryClient.invalidateQueries({ queryKey: ['portfolio-holdings', user.id] });
      }
    },
    onError: (err) => {
      setDeletingId(null);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete holding.');
    },
  });

  // Mutation: Update Existing Holding Values (Valuations & Units)
  const updateHoldingMutation = useMutation({
    mutationFn: async (values: UpdateHoldingFormValues) => {
      const unitCostCents = Math.round(values.unitCost * 100);
      const currentValueCents = Math.round(values.currentValue * 100);

      // 1. If it's a demo holding, update in local demo state
      if (values.holdingId.startsWith('demo-')) {
        setLocalDemoHoldings((prev) =>
          prev.map((h) =>
            h.holdingId === values.holdingId
              ? {
                  ...h,
                  quantity: values.quantity,
                  unitCostCents,
                  currentValueCents,
                  updatedAt: new Date().toISOString(),
                }
              : h
          )
        );
        return;
      }

      // 2. If authenticated user and real database holding
      if (user) {
        if (holdingAdapter.updateHoldingValues) {
          const res = await holdingAdapter.updateHoldingValues({
            holdingId: values.holdingId,
            userId: user.id,
            quantity: values.quantity,
            unitCostCents,
            currentValueCents,
          });
          if (!res.success) throw res.error;
        }
      }
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['portfolio-summary', user.id] });
        queryClient.invalidateQueries({ queryKey: ['portfolio-holdings', user.id] });
      }
    },
  });

  // Seed sample Indian holdings for authenticated user if empty
  const handleSeedStarterHoldings = async () => {
    if (!user) return;
    for (const h of DEMO_HOLDINGS.slice(0, 4)) {
      const useCase = new AddHoldingUseCase(holdingAdapter);
      await useCase.execute({
        userId: user.id,
        name: h.name,
        ticker: h.ticker,
        isin: h.isin,
        dematAccountId: h.dematAccountId,
        folioNumber: h.folioNumber,
        amcName: h.amcName,
        schemePlan: h.schemePlan,
        costBasisVerified: h.costBasisVerified,
        assetClassId: h.assetClassId,
        currency: 'INR',
        quantity: h.quantity,
        unitCostCents: h.unitCostCents,
        currentValueCents: h.currentValueCents,
      });
    }
    refetch();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PortfolioHeader
        isAuthenticated={Boolean(user)}
        marketSession={marketSession}
        isPolling={isPolling}
        onTogglePolling={() => setIsPolling((prev) => !prev)}
        isRefreshingNavs={isRefreshingNavs}
        onRefreshNavs={() => void handleRefreshLiveNavs()}
        isSupportModeActive={isSupportModeActive}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenAddModal={() => setIsModalOpen(true)}
        onOpenManageFamily={() => setIsManageFamilyOpen(true)}
        selectedMemberId={selectedMemberId}
        navRefreshMessage={navRefreshMessage}
      />

      <PortfolioOverviewCards
        summary={summary}
        positionsCount={activeHoldings.length}
        selectedClassFilter={selectedClassFilter}
        onToggleClassFilter={(assetClassId) =>
          setSelectedClassFilter((prev) => (prev === assetClassId ? null : assetClassId))
        }
      />

      <PortfolioHoldingsSection
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedClassFilter={selectedClassFilter}
        onClearClassFilter={() => setSelectedClassFilter(null)}
        deleteError={deleteError}
        onDismissDeleteError={() => setDeleteError(null)}
        isLoadingDb={isLoadingDb}
        isAuthenticated={Boolean(user)}
        isMobile={isMobile}
        activeHoldings={activeHoldings}
        filteredHoldings={filteredHoldings}
        equitiesHoldings={equitiesHoldings}
        mutualFundHoldings={mutualFundHoldings}
        groupedHoldings={groupedHoldings}
        equitiesSubtotals={equitiesSubtotals}
        mfSubtotals={mfSubtotals}
        liabilities={liabilities}
        members={members}
        accounts={accounts}
        liveQuotesMap={liveQuotesMap}
        currencySymbol={currencySymbol}
        locale={locale}
        deletingId={deletingId}
        onOpenAddModal={() => setIsModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onSeedStarterHoldings={handleSeedStarterHoldings}
        onEditHolding={setEditingHolding}
        onDeleteHolding={handleDeleteRequest}
      />

      <PortfolioModals
        isAddOpen={isModalOpen}
        onCloseAdd={() => setIsModalOpen(false)}
        onAddSubmit={async (values) => {
          await addHoldingMutation.mutateAsync(values);
        }}
        isAddLoading={addHoldingMutation.isPending}
        editingHolding={editingHolding}
        onCloseEdit={() => setEditingHolding(null)}
        onEditSubmit={async (values) => {
          await updateHoldingMutation.mutateAsync(values);
        }}
        isEditLoading={updateHoldingMutation.isPending}
        isImportOpen={isImportModalOpen}
        onCloseImport={() => setIsImportModalOpen(false)}
        onImportSuccess={(importedItems, memberId, accountId) => {
          if (user) {
            queryClient.invalidateQueries({ queryKey: ['portfolio-summary', user.id] });
          } else if (importedItems && importedItems.length > 0) {
            const chosenMemberId =
              memberId || (selectedMemberId !== 'all' ? selectedMemberId : 'mem-self');
            const chosenAccountId =
              accountId || (selectedAccountId !== 'all' ? selectedAccountId : undefined);
            const newHoldings = buildDemoImportedHoldings(
              importedItems,
              chosenMemberId,
              chosenAccountId
            );
            setLocalDemoHoldings((prev) => [...newHoldings, ...prev]);
          }
        }}
        isManageFamilyOpen={isManageFamilyOpen}
        onCloseManageFamily={() => setIsManageFamilyOpen(false)}
        holdingToDelete={holdingToDelete}
        isDeleting={Boolean(deletingId)}
        onConfirmDelete={() => {
          if (holdingToDelete) {
            deleteHoldingMutation.mutate(holdingToDelete.holdingId);
            setHoldingToDelete(null);
          }
        }}
        onCancelDelete={() => setHoldingToDelete(null)}
      />
    </div>
  );
}
