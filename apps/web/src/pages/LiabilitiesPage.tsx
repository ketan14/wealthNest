import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { useRepositories } from '@/lib/persistence/repository-context';
import {
  GetNetWorthSummaryUseCase,
  CreateLiabilityUseCase,
  UpdateLiabilityUseCase,
  DeleteLiabilityUseCase,
  LiabilityDto,
  CreateLiabilityParams,
  UpdateLiabilityParams,
} from '@wealthnest/application';
import {
  NetWorthSummary,
  Money,
  PropertyEquityDetail,
  evaluatePlanQuota,
} from '@wealthnest/domain';
import { AddLiabilityModal } from '@/components/liabilities/AddLiabilityModal';
import { UpdateBalanceModal } from '@/components/liabilities/UpdateBalanceModal';
import { RecordEmiPaymentModal } from '@/components/liabilities/RecordEmiPaymentModal';
import { UpdateValuationModal } from '@/components/liabilities/UpdateValuationModal';
import { LoanPrepaymentSimulatorCard } from '@/components/liabilities/LoanPrepaymentSimulatorCard';
import { PropertyEquitySection } from '@/components/liabilities/PropertyEquitySection';
import { LoanPortfolioSection } from '@/components/liabilities/LoanPortfolioSection';
import { DEMO_LIABILITIES } from '@/components/liabilities/liabilities-demo-data';
import { shouldAllowDemoData } from '@/lib/config/mobile-runtime';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useFamily } from '@/lib/family/family-context';
import { useSupportSession } from '@/lib/admin/support-session-context';
import { usePreferences } from '@/lib/preferences/preferences-context';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { SyncingIndicator } from '@/components/ui/SyncingIndicator';
import { EntitySelectorChips } from '@/components/family/EntitySelectorChips';
import { PlanQuotaBadge } from '@/components/plans/PlanQuotaBadge';
import { PlanLimitModal } from '@/components/plans/PlanLimitModal';
import {
  Plus,
  RefreshCw,
  TrendingDown,
  Calendar,
  Building2,
} from 'lucide-react';

export function LiabilitiesPage() {
  const { user } = useAuth();
  const { activeHouseholdId, canEditFinancials, planTier, customLimits } = useHousehold();
  const { mode } = useRepositories();
  const isDemoMode = mode === 'supabase' && (!user?.id || user.id.startsWith('demo-'));
  const hasLiveBackend = !isDemoMode && Boolean(activeHouseholdId || user?.id);
  const scopeId = activeHouseholdId || user?.id || '';
  const userId = user?.id || scopeId;
  const queryClient = useQueryClient();
  const { members, selectedMemberId, setSelectedMemberId } = useFamily();
  const { isSupportModeActive, supportData } = useSupportSession();
  const { currencySymbol, preferences } = usePreferences();
  const locale = preferences.numberFormat || 'en-IN';

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPlanLimitOpen, setIsPlanLimitOpen] = useState(false);
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState<LiabilityDto | null>(null);
  const [balanceModalLiability, setBalanceModalLiability] = useState<LiabilityDto | null>(null);
  const [emiModalLiability, setEmiModalLiability] = useState<LiabilityDto | null>(null);
  const [liabilityToDelete, setLiabilityToDelete] = useState<LiabilityDto | null>(null);

  // Valuation modal state
  const [valuationModalAsset, setValuationModalAsset] = useState<{
    id: string;
    name: string;
    valuationCents: bigint;
  } | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('active');

  // Local state for demo liabilities when logged out or when previewing sample loans (disabled on Android / native mobile)
  const [localDemoLiabilities, setLocalDemoLiabilities] =
    useState<LiabilityDto[]>(shouldAllowDemoData(isDemoMode) ? DEMO_LIABILITIES : []);

  const { liabilityRepo, holdingRepo } = useRepositories();

  // Query 1: Liabilities list
  const {
    data: liabilities = [],
    isLoading: isLoadingLiabilities,
    isFetching: isFetchingLiabilities,
    refetch: refetchLiabilities,
  } = useQuery({
    queryKey: ['liabilities-list', scopeId],
    queryFn: async () => {
      if (!scopeId) return [];
      const res = await (liabilityRepo.listLiabilitiesByHousehold
        ? liabilityRepo.listLiabilitiesByHousehold(scopeId)
        : liabilityRepo.listLiabilitiesByUser(scopeId));
      if (!res.success) throw res.error;
      return res.value;
    },
    enabled: hasLiveBackend,
  });

  // Query 2: Integrated Net Worth and Property Equities Summary
  const {
    data: netWorthSummary,
    isLoading: isLoadingSummary,
    isFetching: isFetchingSummary,
    refetch: refetchSummary,
  } = useQuery<NetWorthSummary | null>({
    queryKey: ['net-worth-summary', scopeId, selectedMemberId],
    queryFn: async () => {
      if (!scopeId) return null;
      const useCase = new GetNetWorthSummaryUseCase(holdingRepo, liabilityRepo);
      const res = await useCase.execute({
        userId: userId || 'demo-user',
        householdId: activeHouseholdId || undefined,
        memberId: selectedMemberId,
      });
      if (!res.success) throw res.error;
      return res.value;
    },
    enabled: hasLiveBackend,
  });

  const invalidateLiabilityCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['liabilities-list'] });
    queryClient.invalidateQueries({ queryKey: ['liabilities'] });
    queryClient.invalidateQueries({ queryKey: ['net-worth-summary'] });
    queryClient.invalidateQueries({ queryKey: ['analytics-liabilities'] });
    queryClient.invalidateQueries({ queryKey: ['holdings-details'] });
    queryClient.invalidateQueries({ queryKey: ['liability-balances'] });
  };

  // Mutation: Save / Create / Update Liability
  const saveLiabilityMutation = useMutation({
    mutationFn: async (params: CreateLiabilityParams | UpdateLiabilityParams) => {
      if (hasLiveBackend && !canEditFinancials) {
        throw new Error('View-only household role cannot modify liabilities.');
      }
      if ('id' in params) {
        if (params.id.startsWith('demo-') || !hasLiveBackend) {
          const existing = localDemoLiabilities.find((l) => l.id === params.id);
          if (!existing) {
            throw new Error('Demo liability not found.');
          }
          const updatedDemo: LiabilityDto = {
            ...existing,
            name: params.name ?? existing.name,
            loanType: params.loanType ?? existing.loanType,
            lender: params.lender ?? existing.lender,
            accountNumber:
              params.accountNumber !== undefined ? params.accountNumber : existing.accountNumber,
            originalPrincipalCents:
              params.originalPrincipalCents ?? existing.originalPrincipalCents,
            currentBalanceCents: params.currentBalanceCents ?? existing.currentBalanceCents,
            interestRate: params.interestRate ?? existing.interestRate,
            interestType: params.interestType ?? existing.interestType,
            tenureMonths:
              params.tenureMonths !== undefined ? params.tenureMonths : existing.tenureMonths,
            emiAmountCents: params.emiAmountCents ?? existing.emiAmountCents,
            startDate: params.startDate !== undefined ? params.startDate : existing.startDate,
            endDate: params.endDate !== undefined ? params.endDate : existing.endDate,
            status: params.status ?? existing.status,
            linkedAssetId:
              params.linkedAssetId === null
                ? undefined
                : (params.linkedAssetId ?? existing.linkedAssetId),
            memberId: params.memberId ?? existing.memberId,
            coBorrowerMemberIds: params.coBorrowerMemberIds ?? existing.coBorrowerMemberIds,
            parties: params.parties ?? existing.parties,
            notes: params.notes !== undefined ? params.notes : existing.notes,
            visibility: params.visibility ?? existing.visibility,
            updatedAt: new Date().toISOString(),
          };
          setLocalDemoLiabilities((prev) =>
            prev.map((l) => (l.id === params.id ? updatedDemo : l))
          );
          return updatedDemo;
        }
        const useCase = new UpdateLiabilityUseCase(liabilityRepo);
        const res = await useCase.execute(params);
        if (!res.success) throw res.error;
        return res.value;
      } else {
        if (!hasLiveBackend) {
          const now = new Date().toISOString();
          const newDemo: LiabilityDto = {
            id: `demo-${Date.now()}`,
            userId: params.userId,
            householdId: params.householdId,
            visibility: params.visibility ?? 'household_shared',
            name: params.name,
            loanType: params.loanType,
            lender: params.lender,
            accountNumber: params.accountNumber,
            originalPrincipalCents: params.originalPrincipalCents,
            currentBalanceCents: params.initialBalanceCents ?? params.originalPrincipalCents,
            interestRate: params.interestRate,
            interestType: params.interestType ?? 'floating',
            tenureMonths: params.tenureMonths,
            emiAmountCents: params.emiAmountCents ?? 0n,
            currency: params.currency ?? 'INR',
            startDate: params.startDate,
            endDate: params.endDate,
            status: 'active',
            linkedAssetId: params.linkedAssetId,
            memberId: params.memberId,
            coBorrowerMemberIds: params.coBorrowerMemberIds,
            parties: params.parties,
            notes: params.notes,
            createdAt: now,
            updatedAt: now,
          };
          setLocalDemoLiabilities((prev) => [newDemo, ...prev]);
          return newDemo;
        }
        const useCase = new CreateLiabilityUseCase(liabilityRepo);
        const res = await useCase.execute(params);
        if (!res.success) throw res.error;
        return res.value;
      }
    },
    onSuccess: () => {
      invalidateLiabilityCaches();
    },
  });

  // Mutation: Delete Liability
  const deleteLiabilityMutation = useMutation({
    mutationFn: async (id: string) => {
      // 1. If it's a demo loan, remove from local state without sending invalid UUID to PostgreSQL
      if (id.startsWith('demo-')) {
        setLocalDemoLiabilities((prev) => prev.filter((l) => l.id !== id));
        return;
      }

      if (!canEditFinancials) {
        throw new Error('View-only household role cannot delete liabilities.');
      }

      // 2. Real database loan for active household
      const useCase = new DeleteLiabilityUseCase(liabilityRepo);
      const res = await useCase.execute(id, scopeId || userId);
      if (!res.success) throw res.error;
    },
    onSuccess: () => {
      if (scopeId || userId) {
        invalidateLiabilityCaches();
      }
    },
  });

  const handleDelete = (l: LiabilityDto) => {
    if (!canEditFinancials || isSupportModeActive) return;
    setLiabilityToDelete(l);
  };

  const handleRefresh = async () => {
    invalidateLiabilityCaches();
    await Promise.all([refetchLiabilities(), refetchSummary()]);
  };

  // Helper for loan icons
  const effectiveLiabilities = useMemo((): readonly LiabilityDto[] => {
    if (isSupportModeActive && supportData?.liabilities) {
      return supportData.liabilities.map((item) => ({
        id: item.id,
        userId: 'support-target',
        name: item.name,
        loanType: item.liabilityType as any,
        lender: item.lenderName,
        accountNumber: undefined,
        originalPrincipalCents: BigInt(item.originalAmountPaise),
        currentBalanceCents: BigInt(item.outstandingBalancePaise),
        interestRate: item.interestRate,
        interestType: 'fixed' as const,
        tenureMonths: 120,
        emiAmountCents: BigInt(item.monthlyPaymentPaise),
        currency: 'INR',
        startDate: item.startDate,
        maturityDate: item.targetPayoffDate,
        status: 'active' as const,
        memberId: undefined,
        coBorrowerMemberIds: [],
        lastBalanceDate: item.startDate,
        linkedAssetName: undefined,
        createdAt: item.startDate,
        updatedAt: item.startDate,
      }));
    }
    const base: readonly LiabilityDto[] = hasLiveBackend
      ? liabilities
      : shouldAllowDemoData(isDemoMode)
        ? localDemoLiabilities
        : [];
    if (!selectedMemberId || selectedMemberId === 'all') return base;
    return base.filter(
      (l) =>
        l.memberId === selectedMemberId ||
        l.parties?.some((p) => p.familyMemberId === selectedMemberId) ||
        (l.coBorrowerMemberIds && l.coBorrowerMemberIds.includes(selectedMemberId))
    );
  }, [isSupportModeActive, supportData, liabilities, localDemoLiabilities, selectedMemberId]);

  const effectiveSummary: NetWorthSummary = useMemo(() => {
    if (netWorthSummary) return netWorthSummary;

    const totalDebtCents = effectiveLiabilities.reduce(
      (sum, l) => sum + (l.status === 'active' ? l.currentBalanceCents : 0n),
      0n
    );
    const totalEmiCents = effectiveLiabilities.reduce(
      (sum, l) => sum + (l.status === 'active' ? l.emiAmountCents : 0n),
      0n
    );
    const grossAssetsCents = 1850000000n; // ₹1.85 Cr baseline gross assets
    const netWorthCents = grossAssetsCents - totalDebtCents;

    const propEquities: PropertyEquityDetail[] = [
      {
        assetId: 'asset-home-1',
        assetName: '3BHK Apartment - Bengaluru',
        propertyValue: Money.fromCents(850000000n, 'INR'), // ₹85 Lakh
        totalDebt: Money.fromCents(412500000n, 'INR'), // ₹41.25 Lakh
        equity: Money.fromCents(437500000n, 'INR'), // ₹43.75 Lakh
        isNegativeEquity: false,
        ltvRatioPercentage: 48.5,
        linkedLoans: [
          {
            liabilityId: 'demo-loan-1',
            name: 'SBI Green Home Loan',
            outstandingBalance: Money.fromCents(412500000n, 'INR'),
          },
        ],
      },
    ];

    return {
      asOfDate: new Date().toISOString().slice(0, 10),
      totalAssets: Money.fromCents(grossAssetsCents, 'INR'),
      totalLiabilities: Money.fromCents(totalDebtCents, 'INR'),
      netWorth: Money.fromCents(netWorthCents, 'INR'),
      isSolvent: netWorthCents > 0n,
      debtToAssetsRatio: Number(totalDebtCents) / Number(grossAssetsCents),
      totalMonthlyEmi: Money.fromCents(totalEmiCents, 'INR'),
      propertyEquities: propEquities,
      missingAssetValuations: [],
      missingLiabilityBalances: [],
    };
  }, [netWorthSummary, effectiveLiabilities]);

  const filteredLiabilities = effectiveLiabilities.filter((l) => {
    if (statusFilter === 'all') return true;
    return l.status === statusFilter;
  });

  const debtToAssets = (effectiveSummary.debtToAssetsRatio ?? 0) * 100;

  // Aggregate property equity
  const totalPropertyEquityDecimal = useMemo(() => {
    return (effectiveSummary.propertyEquities || []).reduce((acc, pe) => {
      return acc + (pe.equity?.toDecimal() ?? 0);
    }, 0);
  }, [effectiveSummary.propertyEquities]);

  const activeLoansCount = effectiveLiabilities.filter((l) => l.status === 'active').length;

  const allHouseholdLiabilities = hasLiveBackend
    ? liabilities
    : shouldAllowDemoData(isDemoMode)
      ? localDemoLiabilities
      : [];
  const totalActiveHouseholdLoans = allHouseholdLiabilities.filter(
    (l) => l.status !== 'closed'
  ).length;
  const liabilityQuota = useMemo(
    () => evaluatePlanQuota(planTier, 'activeLoans', totalActiveHouseholdLoans, 1, customLimits),
    [planTier, totalActiveHouseholdLoans, customLimits]
  );

  const handleOpenAddLiability = () => {
    if (!canEditFinancials || isSupportModeActive) return;
    if (!liabilityQuota.allowed) {
      setIsPlanLimitOpen(true);
      return;
    }
    setEditingLiability(null);
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Title Row */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              Loans & Liabilities
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
              Loans & Liabilities Engine
            </span>
            <SyncingIndicator isSyncing={isFetchingLiabilities || isFetchingSummary} />
            <PlanQuotaBadge
              resource="activeLoans"
              currentCount={totalActiveHouseholdLoans}
              onLimitClick={() => setIsPlanLimitOpen(true)}
            />
          </div>
          <p className="hidden sm:block text-xs sm:text-sm text-muted-foreground mt-0.5">
            Track mortgages, EMIs, property equity, LTV ratios, and dated balance repayments.
          </p>
        </div>

        {/* Header Actions (Compact on 360-420px, Full on Desktop) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoadingLiabilities || isLoadingSummary}
            className="h-8 w-8 sm:w-auto sm:px-2.5 p-0 text-xs gap-1.5 text-muted-foreground hover:text-foreground sm:border sm:border-border/80 rounded-lg whitespace-nowrap shrink-0"
            title="Sync Liabilities"
            aria-label="Sync Liabilities"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingLiabilities || isLoadingSummary ? 'animate-spin text-primary' : ''}`}
            />
            <span className="hidden sm:inline">Sync</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenAddLiability}
            disabled={isSupportModeActive || !canEditFinancials}
            title={
              isSupportModeActive
                ? 'Disabled in Support Impersonation Mode (Read-Only)'
                : !canEditFinancials
                  ? 'View-only household role cannot add liabilities'
                  : 'Add Liability'
            }
            className="h-8 px-2.5 sm:px-3 text-xs gap-1 sm:gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-sm whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
            <span>Add Liability</span>
          </Button>
        </div>
      </div>

      {/* 2. Compact "MY FAMILY" Horizontal Scroll Row (Matching Home and Portfolio Exactly) */}
      <EntitySelectorChips
        members={members}
        selectedMemberId={selectedMemberId}
        onSelectMember={setSelectedMemberId}
      />

      {/* 3. Core Essential KPI Cards (2x2 Grid on Mobile & Tablet, 3-Card Grid on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
        {/* Card 1: Total Outstanding Debt */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm hover:border-slate-700 transition-all p-3 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs uppercase font-semibold">
            <span className="truncate">Total Debt</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-foreground pt-1 sm:pt-1.5">
            <CurrencyDisplay
              amount={effectiveSummary.totalLiabilities?.toDecimal() ?? 0}
              className="text-lg sm:text-2xl text-foreground font-bold"
            />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
            {activeLoansCount} active {activeLoansCount === 1 ? 'loan' : 'loans'}
          </p>
        </Card>

        {/* Card 2: Monthly EMI Commitment */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm hover:border-slate-700 transition-all p-3 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs uppercase font-semibold">
            <span className="truncate">Monthly EMI</span>
            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-foreground pt-1 sm:pt-1.5">
            <CurrencyDisplay
              amount={effectiveSummary.totalMonthlyEmi?.toDecimal() ?? 0}
              className="text-lg sm:text-2xl text-foreground font-bold"
            />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate flex items-center gap-0.5">
            <CurrencyDisplay
              amount={(effectiveSummary.totalMonthlyEmi?.toDecimal() ?? 0) * 12}
              className="text-[10px] sm:text-xs text-muted-foreground"
            />
            <span>/yr</span>
          </p>
        </Card>

        {/* Card 3: Net Property Equity (Collateral Protection) */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm hover:border-slate-700 transition-all p-3 sm:p-5 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs uppercase font-semibold">
            <span className="truncate">Property Equity</span>
            <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-emerald-400 pt-1 sm:pt-1.5">
            <CurrencyDisplay
              amount={totalPropertyEquityDecimal}
              className="text-lg sm:text-2xl text-emerald-400 font-bold"
            />
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge
              variant={
                debtToAssets <= 30 ? 'success' : debtToAssets <= 50 ? 'secondary' : 'destructive'
              }
              className="text-[9px] sm:text-[10px] px-1.5 py-0"
            >
              {debtToAssets <= 30
                ? 'Conservative'
                : debtToAssets <= 50
                  ? 'Moderate'
                  : 'High Leverage'}
            </Badge>
            <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
              {(effectiveSummary.propertyEquities?.[0]?.ltvRatioPercentage ?? 0).toFixed(1)}% LTV
            </span>
          </div>
        </Card>
      </div>

      {/* Property Equity & LTV Section (Collateral Breakdown) */}
      {effectiveSummary.propertyEquities && effectiveSummary.propertyEquities.length > 0 && (
        <PropertyEquitySection
          propertyEquities={effectiveSummary.propertyEquities}
          currencySymbol={currencySymbol}
          locale={locale}
          canEditFinancials={canEditFinancials}
          onUpdateAppraisal={(asset) => {
            if (canEditFinancials && !isSupportModeActive) {
              setValuationModalAsset(asset);
            }
          }}
        />
      )}

      {/* Loans & Liabilities List */}
      <LoanPortfolioSection
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        effectiveLiabilities={effectiveLiabilities}
        filteredLiabilities={filteredLiabilities}
        members={members}
        currencySymbol={currencySymbol}
        locale={locale}
        canEditFinancials={canEditFinancials}
        onAddFirstLoan={handleOpenAddLiability}
        onPayEmi={(l) => {
          if (canEditFinancials && !isSupportModeActive) setEmiModalLiability(l);
        }}
        onUpdateBalance={(l) => {
          if (canEditFinancials && !isSupportModeActive) setBalanceModalLiability(l);
        }}
        onEditLiability={(l) => {
          if (!canEditFinancials || isSupportModeActive) return;
          setEditingLiability(l);
          setIsAddModalOpen(true);
        }}
        onDeleteLiability={handleDelete}
      />

      {/* Prepayment & Compound Amortization Simulator */}
      <LoanPrepaymentSimulatorCard liabilities={filteredLiabilities} />

      {/* Modals */}
      <AddLiabilityModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingLiability(null);
        }}
        onSave={async (params) => {
          await saveLiabilityMutation.mutateAsync(params);
        }}
        userId={userId}
        liabilityToEdit={editingLiability}
      />

      <UpdateBalanceModal
        isOpen={Boolean(balanceModalLiability)}
        onClose={() => setBalanceModalLiability(null)}
        liability={balanceModalLiability}
        userId={userId}
        onSuccess={() => {
          invalidateLiabilityCaches();
          refetchLiabilities();
          refetchSummary();
        }}
      />

      {/* Record EMI Payment with Automatic Interest & Principal Split */}
      <RecordEmiPaymentModal
        isOpen={Boolean(emiModalLiability)}
        onClose={() => setEmiModalLiability(null)}
        liability={emiModalLiability}
        userId={userId}
        onSuccess={() => {
          invalidateLiabilityCaches();
          refetchLiabilities();
          refetchSummary();
        }}
      />

      {valuationModalAsset && (
        <UpdateValuationModal
          isOpen={Boolean(valuationModalAsset)}
          onClose={() => setValuationModalAsset(null)}
          assetId={valuationModalAsset.id}
          assetName={valuationModalAsset.name}
          currentValuationCents={valuationModalAsset.valuationCents}
          userId={userId}
          onSuccess={() => {
            invalidateLiabilityCaches();
            refetchSummary();
          }}
        />
      )}

      {/* Phase 6A: Manage Family Modal */}
      <ManageFamilyModal isOpen={isManageFamilyOpen} onClose={() => setIsManageFamilyOpen(false)} />

      {/* Phase 9.2: Accessible Non-Blocking Delete Confirmation Modal */}
      <ConfirmActionModal
        isOpen={Boolean(liabilityToDelete)}
        title="Remove Loan / Liability"
        message={`Are you sure you want to remove the loan "${liabilityToDelete?.name}"? Historical balance records will also be removed.`}
        confirmLabel="Remove Loan"
        isLoading={deleteLiabilityMutation.isPending}
        onConfirm={async () => {
          if (liabilityToDelete) {
            await deleteLiabilityMutation.mutateAsync(liabilityToDelete.id);
            setLiabilityToDelete(null);
          }
        }}
        onCancel={() => setLiabilityToDelete(null)}
      />

      <PlanLimitModal
        isOpen={isPlanLimitOpen}
        onClose={() => setIsPlanLimitOpen(false)}
        resource="activeLoans"
        currentCount={totalActiveHouseholdLoans}
      />
    </div>
  );
}
