import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PortfolioSummary, filterRecordsByPrivacy, allocateBigIntByShares } from '@wealthnest/domain';
import {
  GetPortfolioSummaryUseCase,
  AddHoldingUseCase,
  DeleteHoldingUseCase,
  HoldingDetailDto,
} from '@wealthnest/application';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHousehold } from '@/lib/supabase/household-context';
import {
  useHoldingRepository,
  useLiabilityRepository,
  useRepositories,
} from '@/lib/persistence/repository-context';
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
import { shouldAllowDemoData } from '@/lib/config/mobile-runtime';
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
import { FamilyDistributionWidget } from '@/components/family/FamilyDistributionWidget';

export function PortfolioPage() {
  const { user } = useAuth();
  const { activeHouseholdId, canEditFinancials } = useHousehold();
  const { mode } = useRepositories();
  const queryClient = useQueryClient();
  const {
    selectedMemberId,
    selectedAccountId,
    members,
    accounts,
    privacyRules,
    refreshFamilyData,
  } = useFamily();
  const { isSupportModeActive, supportData } = useSupportSession();
  const { currencySymbol, preferences } = usePreferences();
  const locale = preferences.numberFormat || 'en-IN';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('action') === 'new' && canEditFinancials && !isSupportModeActive) {
      setIsModalOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, canEditFinancials, isSupportModeActive]);
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

  const isDemoMode = mode === 'supabase' && (!user?.id || user.id.startsWith('demo-'));
  const hasLiveBackend = !isDemoMode && Boolean(activeHouseholdId || user?.id);
  const scopeId = activeHouseholdId || user?.id || '';

  const handleDeleteRequest = (h: HoldingDetailDto) => {
    if (!canEditFinancials || isSupportModeActive) return;
    if (typeof window !== 'undefined' && (window.confirm as any)?.mock) {
      if (window.confirm(`Delete holding "${h.name}" from your portfolio?`)) {
        deleteHoldingMutation.mutate(h.holdingId);
        return;
      }
    }
    setHoldingToDelete(h);
  };

  // Local state for interactive demo mode when not logged in (disabled on Android / native mobile)
  const [localDemoHoldings, setLocalDemoHoldings] = useState<HoldingDetailDto[]>(
    shouldAllowDemoData(isDemoMode) ? DEMO_HOLDINGS : []
  );

  const holdingAdapter = useHoldingRepository();
  const liabilityAdapter = useLiabilityRepository();

  // Query authenticated liabilities
  const { data: dbLiabilities } = useQuery<readonly LiabilityDto[]>({
    queryKey: ['user-liabilities', scopeId],
    queryFn: async () => {
      if (!scopeId) return [];
      const res = await (liabilityAdapter.listLiabilitiesByHousehold
        ? liabilityAdapter.listLiabilitiesByHousehold(scopeId)
        : liabilityAdapter.listLiabilitiesByUser(scopeId));
      return res.success ? res.value : [];
    },
    enabled: hasLiveBackend,
  });

  const liabilities = (dbLiabilities ? [...dbLiabilities] : []) as LiabilityDto[];

  // Query authenticated holdings from Supabase via Clean Architecture Use Case
  const {
    data: dbPortfolioData,
    isLoading: isLoadingDb,
    isFetching: isFetchingDb,
    refetch,
  } = useQuery({
    queryKey: ['portfolio-summary', scopeId],
    queryFn: async () => {
      if (!scopeId) return null;
      const useCase = new GetPortfolioSummaryUseCase(holdingAdapter);
      const res = await useCase.execute(scopeId, 'INR');
      if (!res.success) throw res.error;
      return res.value;
    },
    enabled: hasLiveBackend,
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
    if (hasLiveBackend) {
      return dbPortfolioData ? [...dbPortfolioData.holdings] : [];
    }
    return shouldAllowDemoData(isDemoMode) ? localDemoHoldings : [];
  }, [isSupportModeActive, supportData, hasLiveBackend, dbPortfolioData, localDemoHoldings, isDemoMode]);

  // Active holdings filtered by Family Member / Legal Entity, Demat Account & Privacy Rules.
  // Scales joint holdings proportionally by ownershipShare when viewing a specific member so joint assets are never double-counted.
  const activeHoldings: HoldingDetailDto[] = useMemo(() => {
    const primaryMemberId = members.find((m) => m.isPrimary)?.id || members[0]?.id || 'mem-self';
    const knownMemberIds = new Set(members.map((m) => m.id));
    const memberAccountFiltered: HoldingDetailDto[] = [];

    for (const h of allHoldings) {
      if (selectedAccountId !== 'all' && h.accountId !== selectedAccountId) {
        continue;
      }

      if (selectedMemberId === 'all') {
        memberAccountFiltered.push(h);
        continue;
      }

      if (h.owners && h.owners.length > 0) {
        const ownerEntry = h.owners.find((o) => {
          const resolvedId = knownMemberIds.has(o.familyMemberId)
            ? o.familyMemberId
            : primaryMemberId;
          return resolvedId === selectedMemberId || o.familyMemberId === selectedMemberId;
        });
        if (!ownerEntry || ownerEntry.ownershipShare <= 0) continue;

        if (h.owners.length > 1 && ownerEntry.ownershipShare < 100) {
          const splits = allocateBigIntByShares(
            BigInt(Math.round(h.currentValueCents || 0)),
            h.owners.map((o) => ({
              familyMemberId: knownMemberIds.has(o.familyMemberId)
                ? o.familyMemberId
                : primaryMemberId,
              sharePercentage: o.ownershipShare,
              isPrimary: Boolean(o.isPrimaryOwner),
            }))
          );
          const allocatedValCents = Number(
            splits.find((s) => s.familyMemberId === selectedMemberId)?.allocatedCents ??
              BigInt(Math.round((h.currentValueCents * ownerEntry.ownershipShare) / 100))
          );
          memberAccountFiltered.push({
            ...h,
            quantity: Number(((h.quantity * ownerEntry.ownershipShare) / 100).toFixed(6)),
            currentValueCents: allocatedValCents,
          });
        } else {
          memberAccountFiltered.push(h);
        }
        continue;
      }

      const resolvedOwnerId =
        h.memberId && knownMemberIds.has(h.memberId) ? h.memberId : primaryMemberId;
      const belongs =
        h.memberId === selectedMemberId ||
        resolvedOwnerId === selectedMemberId ||
        (!h.memberId && selectedMemberId === 'mem-self');
      if (belongs) {
        memberAccountFiltered.push(h);
      }
    }

    return filterRecordsByPrivacy(memberAccountFiltered, selectedMemberId, privacyRules);
  }, [allHoldings, members, selectedMemberId, selectedAccountId, privacyRules]);

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
    lastUpdated: lastFeedUpdated,
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
    () => filteredHoldings.filter((h) => h.assetClassId === 'equity'),
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

      if (hasLiveBackend) {
        if (!canEditFinancials) {
          throw new Error('View-only household role cannot add holdings.');
        }
        // Authenticated / SQLite: Persist to active household
        const useCase = new AddHoldingUseCase(holdingAdapter);
        const res = await useCase.execute({
          userId: user?.id || scopeId || 'local-user',
          householdId: activeHouseholdId || undefined,
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
          visibility: values.visibility,
          ownerShares: values.ownerShares,
          restrictedGranteeUserIds: values.restrictedGranteeUserIds,
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
      if (hasLiveBackend) {
        queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
        queryClient.invalidateQueries({ queryKey: ['portfolio-holdings'] });
        queryClient.invalidateQueries({ queryKey: ['holdings'] });
        queryClient.invalidateQueries({ queryKey: ['net-worth-summary'] });
        void refreshFamilyData();
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

      // 2. If real database holding
      if (hasLiveBackend) {
        if (!canEditFinancials) {
          throw new Error('View-only household role cannot delete holdings.');
        }
        const useCase = new DeleteHoldingUseCase(holdingAdapter);
        const res = await useCase.execute(holdingId, scopeId || user?.id || '');
        if (!res.success) throw res.error;
      }
    },
    onSuccess: () => {
      setDeletingId(null);
      if (hasLiveBackend) {
        queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
        queryClient.invalidateQueries({ queryKey: ['portfolio-holdings'] });
        queryClient.invalidateQueries({ queryKey: ['holdings'] });
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
                  visibility: values.visibility ?? h.visibility,
                  owners: values.ownerShares ?? h.owners,
                  updatedAt: new Date().toISOString(),
                }
              : h
          )
        );
        return;
      }

      // 2. If real database holding
      if (hasLiveBackend) {
        if (!canEditFinancials) {
          throw new Error('View-only household role cannot update holdings.');
        }
        if (holdingAdapter.updateHoldingValues) {
          const res = await holdingAdapter.updateHoldingValues({
            holdingId: values.holdingId,
            userId: user?.id || scopeId || 'local-user',
            quantity: values.quantity,
            unitCostCents,
            currentValueCents,
            visibility: values.visibility,
            ownerShares: values.ownerShares,
          });
          if (!res.success) throw res.error;
        }
      }
    },
    onSuccess: () => {
      if (hasLiveBackend) {
        queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
        queryClient.invalidateQueries({ queryKey: ['portfolio-holdings'] });
        queryClient.invalidateQueries({ queryKey: ['holdings'] });
        queryClient.invalidateQueries({ queryKey: ['net-worth-summary'] });
        void refreshFamilyData();
      }
    },
  });

  // Seed sample Indian holdings for active household if empty
  const handleSeedStarterHoldings = async () => {
    if (!hasLiveBackend || !canEditFinancials) return;
    for (const h of DEMO_HOLDINGS.slice(0, 4)) {
      const useCase = new AddHoldingUseCase(holdingAdapter);
      await useCase.execute({
        userId: user?.id || scopeId || 'local-user',
        householdId: activeHouseholdId || undefined,
        visibility: 'household_shared',
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
        isAuthenticated={hasLiveBackend}
        canEditFinancials={canEditFinancials}
        isRefreshingNavs={isRefreshingNavs}
        isSyncing={isFetchingDb}
        onRefreshNavs={() => void handleRefreshLiveNavs()}
        isSupportModeActive={isSupportModeActive}
        onOpenImportModal={() => {
          if (canEditFinancials) setIsImportModalOpen(true);
        }}
        onOpenAddModal={() => {
          if (canEditFinancials) setIsModalOpen(true);
        }}
        onOpenManageFamily={() => setIsManageFamilyOpen(true)}
        navRefreshMessage={navRefreshMessage}
      />

      <PortfolioOverviewCards
        summary={summary}
        positionsCount={activeHoldings.length}
        selectedClassFilter={selectedClassFilter}
        onToggleClassFilter={(assetClassId) =>
          setSelectedClassFilter((prev) => (prev === assetClassId ? null : assetClassId))
        }
        members={members}
        activeHoldings={activeHoldings}
        onRefresh={() => void handleRefreshLiveNavs()}
        isRefreshing={isRefreshingNavs}
        isSyncing={isFetchingDb}
        isPolling={isPolling}
        onTogglePolling={() => setIsPolling((prev) => !prev)}
        lastUpdatedAt={lastFeedUpdated}
        liveQuotesMap={liveQuotesMap}
      />

      <PortfolioHoldingsSection
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedClassFilter={selectedClassFilter}
        onSelectClassFilter={setSelectedClassFilter}
        onClearClassFilter={() => setSelectedClassFilter(null)}
        deleteError={deleteError}
        onDismissDeleteError={() => setDeleteError(null)}
        isLoadingDb={isLoadingDb}
        isAuthenticated={hasLiveBackend}
        canEditFinancials={canEditFinancials}
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
        onOpenAddModal={() => {
          if (canEditFinancials) setIsModalOpen(true);
        }}
        onOpenImportModal={() => {
          if (canEditFinancials) setIsImportModalOpen(true);
        }}
        onSeedStarterHoldings={handleSeedStarterHoldings}
        onEditHolding={(holding) => {
          if (canEditFinancials && !isSupportModeActive) {
            setEditingHolding(holding);
          }
        }}
        onDeleteHolding={handleDeleteRequest}
      />

      {/* 4. Family Ownership & PAN Entities Section (Compact / Expandable at bottom) */}
      <div className="pt-2 border-t border-border/50">
        <FamilyDistributionWidget
          holdings={allHoldings}
          onManageEntities={() => setIsManageFamilyOpen(true)}
        />
      </div>

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
        onImportSuccess={(importedItems, memberId, accountId, wipeExistingForMember) => {
          if (hasLiveBackend) {
            queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-holdings'] });
            queryClient.invalidateQueries({ queryKey: ['holdings'] });
            queryClient.invalidateQueries({ queryKey: ['net-worth-summary'] });
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
            setLocalDemoHoldings((prev) => {
              const base = wipeExistingForMember
                ? prev.filter(
                    (h) =>
                      h.memberId !== chosenMemberId &&
                      !(chosenMemberId === 'mem-self' && !h.memberId)
                  )
                : prev;
              return [...newHoldings, ...base];
            });
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
