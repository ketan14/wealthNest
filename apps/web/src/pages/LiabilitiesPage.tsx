import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/supabase/auth-context';
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
import { NetWorthSummary, Money, PropertyEquityDetail } from '@wealthnest/domain';
import { AddLiabilityModal } from '@/components/liabilities/AddLiabilityModal';
import { UpdateBalanceModal } from '@/components/liabilities/UpdateBalanceModal';
import { RecordEmiPaymentModal } from '@/components/liabilities/RecordEmiPaymentModal';
import { UpdateValuationModal } from '@/components/liabilities/UpdateValuationModal';
import { LoanPrepaymentSimulatorCard } from '@/components/liabilities/LoanPrepaymentSimulatorCard';
import { PropertyEquitySection } from '@/components/liabilities/PropertyEquitySection';
import { DEMO_LIABILITIES } from '@/components/liabilities/liabilities-demo-data';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useFamily } from '@/lib/family/family-context';
import { useSupportSession } from '@/lib/admin/support-session-context';
import { usePreferences } from '@/lib/preferences/preferences-context';
import { FamilyFilterBar } from '@/components/family/FamilyFilterBar';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';
import {
  Landmark,
  Plus,
  RefreshCw,
  TrendingDown,
  Building2,
  Calendar,
  CheckCircle2,
  Edit2,
  Trash2,
  History,
  Percent,
  Wallet,
  Car,
  GraduationCap,
  CreditCard,
  CircleDollarSign,
  Briefcase,
  User,
  Users,
} from 'lucide-react';

export function LiabilitiesPage() {
  const { user } = useAuth();
  const userId = user?.id || '';
  const queryClient = useQueryClient();
  const { members, selectedMemberId } = useFamily();
  const { isSupportModeActive, supportData } = useSupportSession();
  const { currencySymbol, preferences } = usePreferences();
  const locale = preferences.numberFormat || 'en-IN';

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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

  // Local state for demo liabilities when logged out or when previewing sample loans
  const [localDemoLiabilities, setLocalDemoLiabilities] = useState<LiabilityDto[]>(DEMO_LIABILITIES);

  const { liabilityRepo, holdingRepo } = useRepositories();

  // Query 1: Liabilities list
  const {
    data: liabilities = [],
    isLoading: isLoadingLiabilities,
    refetch: refetchLiabilities,
  } = useQuery({
    queryKey: ['liabilities-list', userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await liabilityRepo.listLiabilitiesByUser(userId);
      if (!res.success) throw res.error;
      return res.value;
    },
    enabled: Boolean(userId),
  });

  // Query 2: Integrated Net Worth and Property Equities Summary
  const {
    data: netWorthSummary,
    isLoading: isLoadingSummary,
    refetch: refetchSummary,
  } = useQuery<NetWorthSummary | null>({
    queryKey: ['net-worth-summary', userId, selectedMemberId],
    queryFn: async () => {
      if (!userId) return null;
      const useCase = new GetNetWorthSummaryUseCase(holdingRepo, liabilityRepo);
      const res = await useCase.execute({ userId, memberId: selectedMemberId });
      if (!res.success) throw res.error;
      return res.value;
    },
    enabled: Boolean(userId),
  });

  // Mutation: Save / Create / Update Liability
  const saveLiabilityMutation = useMutation({
    mutationFn: async (params: CreateLiabilityParams | UpdateLiabilityParams) => {
      if ('id' in params) {
        const useCase = new UpdateLiabilityUseCase(liabilityRepo);
        const res = await useCase.execute(params);
        if (!res.success) throw res.error;
        return res.value;
      } else {
        const useCase = new CreateLiabilityUseCase(liabilityRepo);
        const res = await useCase.execute(params);
        if (!res.success) throw res.error;
        return res.value;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liabilities-list', userId] });
      queryClient.invalidateQueries({ queryKey: ['net-worth-summary', userId] });
      queryClient.invalidateQueries({ queryKey: ['holdings-details', userId] });
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

      // 2. Real database loan for authenticated user
      const useCase = new DeleteLiabilityUseCase(liabilityRepo);
      const res = await useCase.execute(id, userId);
      if (!res.success) throw res.error;
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['liabilities-list', userId] });
        queryClient.invalidateQueries({ queryKey: ['net-worth-summary', userId] });
      }
    },
  });

  const handleDelete = (l: LiabilityDto) => {
    setLiabilityToDelete(l);
  };

  const handleRefresh = async () => {
    await Promise.all([refetchLiabilities(), refetchSummary()]);
  };

  // Helper for loan icons
  const getLoanIcon = (type: string) => {
    switch (type) {
      case 'home_loan':
        return <Building2 className="w-4 h-4 text-amber-400" />;
      case 'vehicle_loan':
        return <Car className="w-4 h-4 text-blue-400" />;
      case 'education_loan':
        return <GraduationCap className="w-4 h-4 text-emerald-400" />;
      case 'credit_card':
        return <CreditCard className="w-4 h-4 text-rose-400" />;
      case 'gold_loan':
        return <CircleDollarSign className="w-4 h-4 text-yellow-400" />;
      case 'business_loan':
        return <Briefcase className="w-4 h-4 text-indigo-400" />;
      default:
        return <Landmark className="w-4 h-4 text-muted-foreground" />;
    }
  };

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
    const base: readonly LiabilityDto[] = liabilities.length > 0 ? liabilities : localDemoLiabilities;
    if (!selectedMemberId || selectedMemberId === 'all') return base;
    return base.filter(
      (l) =>
        l.memberId === selectedMemberId ||
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

  const totalOutstanding = effectiveSummary.totalLiabilities.toDecimal();
  const totalMonthlyEmi = effectiveSummary.totalMonthlyEmi.toDecimal();
  const debtToAssets = (effectiveSummary.debtToAssetsRatio ?? 0) * 100;
  const netWorthVal = effectiveSummary.netWorth.toDecimal();
  const isSolvent = effectiveSummary.isSolvent ?? true;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-2">
            <Landmark className="w-3.5 h-3.5" />
            Phase 5: Loans & Liabilities Engine
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Loans & Liabilities</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track mortgages, EMIs, property equity, LTV ratios, and dated balance repayments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleRefresh}
            className="gap-2 text-xs"
            disabled={isLoadingLiabilities || isLoadingSummary}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingLiabilities || isLoadingSummary ? 'animate-spin' : ''}`}
            />
            Sync
          </Button>
          <Button
            onClick={() => {
              setEditingLiability(null);
              setIsAddModalOpen(true);
            }}
            disabled={isSupportModeActive}
            title={
              isSupportModeActive ? 'Disabled in Support Impersonation Mode (Read-Only)' : undefined
            }
            className="gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add Loan / Liability
          </Button>
        </div>
      </div>

      {/* Phase 6A: Family Entity Switcher Bar */}
      <FamilyFilterBar onOpenManageModal={() => setIsManageFamilyOpen(true)} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Outstanding Debt */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>Total Outstanding Debt</span>
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <CardTitle className="text-2xl font-bold font-mono tracking-tight text-foreground pt-1">
              {currencySymbol}{totalOutstanding.toLocaleString(locale, { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Across {effectiveLiabilities.filter((l) => l.status === 'active').length} active loan
              obligations
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Monthly EMI */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>Monthly EMI Commitment</span>
              <Calendar className="w-4 h-4 text-amber-400" />
            </div>
            <CardTitle className="text-2xl font-bold font-mono tracking-tight text-foreground pt-1">
              {currencySymbol}{totalMonthlyEmi.toLocaleString(locale, { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {currencySymbol}{(totalMonthlyEmi * 12).toLocaleString(locale, { maximumFractionDigits: 0 })}/year
              in debt service
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Debt-To-Assets Ratio */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>Debt-To-Assets Ratio</span>
              <Percent className="w-4 h-4 text-blue-400" />
            </div>
            <CardTitle className="text-2xl font-bold font-mono tracking-tight text-foreground pt-1">
              {debtToAssets.toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-1.5">
              <Badge
                variant={
                  debtToAssets <= 30 ? 'success' : debtToAssets <= 50 ? 'secondary' : 'destructive'
                }
                className="text-[10px]"
              >
                {debtToAssets <= 30
                  ? 'Conservative'
                  : debtToAssets <= 50
                    ? 'Moderate'
                    : 'High Leverage'}
              </Badge>
              <span className="text-[11px] text-muted-foreground">of total asset base</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Net Worth */}
        <Card className="border-border/80 bg-gradient-to-br from-card to-accent/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>True Net Worth</span>
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <CardTitle
              className={`text-2xl font-bold font-mono tracking-tight pt-1 ${
                isSolvent ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isSolvent ? currencySymbol : `-${currencySymbol}`}
              {netWorthVal.toLocaleString(locale, { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Gross Assets minus Total Outstanding Debt
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Property Equity & LTV Section (Collateral Breakdown) */}
      {effectiveSummary.propertyEquities && effectiveSummary.propertyEquities.length > 0 && (
        <PropertyEquitySection
          propertyEquities={effectiveSummary.propertyEquities}
          currencySymbol={currencySymbol}
          locale={locale}
          onUpdateAppraisal={(asset) => setValuationModalAsset(asset)}
        />
      )}

      {/* Loans & Liabilities List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Loan Portfolio & Balances
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filter:</span>
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Active ({effectiveLiabilities.filter((l) => l.status === 'active').length})
              </button>
              <button
                onClick={() => setStatusFilter('closed')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'closed'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Closed ({effectiveLiabilities.filter((l) => l.status === 'closed').length})
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({effectiveLiabilities.length})
              </button>
            </div>
          </div>
        </div>

        {filteredLiabilities.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                {statusFilter === 'closed'
                  ? 'No closed loans found'
                  : 'Debt Free / No Loans Recorded'}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {statusFilter === 'closed'
                  ? 'Closed and fully paid loans will appear here.'
                  : 'Add home loans, car loans, education debt, or credit lines to keep an accurate, reconciled net-worth balance.'}
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingLiability(null);
                setIsAddModalOpen(true);
              }}
              className="gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              Add First Loan
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Loan & Lender</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Original Principal</th>
                    <th className="py-3 px-4 text-right">Outstanding Balance</th>
                    <th className="py-3 px-4 text-right">Interest Rate</th>
                    <th className="py-3 px-4 text-right">Monthly EMI</th>
                    <th className="py-3 px-4">Linked Collateral</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredLiabilities.map((l) => {
                    const origPrincipal = Number(l.originalPrincipalCents) / 100;
                    const currentBal = Number(l.currentBalanceCents) / 100;
                    const emi = Number(l.emiAmountCents) / 100;

                    return (
                      <tr key={l.id} className="hover:bg-accent/30 transition-colors">
                        {/* Name & Lender */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-accent border border-border/80">
                              {getLoanIcon(l.loanType)}
                            </div>
                            <div>
                              <span className="font-semibold text-foreground text-sm block">
                                {l.name}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] text-muted-foreground">
                                  {l.lender}
                                  {l.accountNumber ? ` • #${l.accountNumber}` : ''}
                                </span>
                                {l.memberId && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                                    style={{
                                      backgroundColor: `${members.find((m) => m.id === l.memberId)?.colorHex || '#3b82f6'}15`,
                                      color:
                                        members.find((m) => m.id === l.memberId)?.colorHex ||
                                        '#3b82f6',
                                      borderColor: `${members.find((m) => m.id === l.memberId)?.colorHex || '#3b82f6'}30`,
                                    }}
                                  >
                                    <User className="w-2.5 h-2.5" />
                                    {members.find((m) => m.id === l.memberId)?.name || 'Borrower'}
                                  </span>
                                )}
                                {l.coBorrowerMemberIds && l.coBorrowerMemberIds.length > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-accent/40 px-1.5 py-0.5 rounded-md border border-border/50">
                                    <Users className="w-2.5 h-2.5" />
                                    Joint:{' '}
                                    {l.coBorrowerMemberIds
                                      .map((id) => members.find((m) => m.id === id)?.name)
                                      .filter(Boolean)
                                      .join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Loan Type */}
                        <td className="py-3.5 px-4">
                          <Badge variant="secondary" className="capitalize text-[10px]">
                            {l.loanType.replace('_', ' ')}
                          </Badge>
                        </td>

                        {/* Original Principal */}
                        <td className="py-3.5 px-4 text-right font-mono text-muted-foreground">
                          {currencySymbol}{origPrincipal.toLocaleString(locale, { maximumFractionDigits: 0 })}
                        </td>

                        {/* Current Outstanding */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-mono font-bold text-foreground">
                            {currencySymbol}{currentBal.toLocaleString(locale, { maximumFractionDigits: 0 })}
                          </div>
                          {l.lastBalanceDate && (
                            <span className="text-[10px] text-muted-foreground font-sans">
                              as of {l.lastBalanceDate}
                            </span>
                          )}
                        </td>

                        {/* Interest Rate */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <span className="font-semibold text-foreground">{l.interestRate}%</span>
                          <span className="text-[10px] text-muted-foreground block uppercase">
                            {l.interestType}
                          </span>
                        </td>

                        {/* Monthly EMI */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          {emi > 0 ? (
                            <span className="font-medium text-foreground">
                              {currencySymbol}{emi.toLocaleString(locale, { maximumFractionDigits: 0 })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Linked Collateral */}
                        <td className="py-3.5 px-4">
                          {l.linkedAssetName ? (
                            <div className="flex items-center gap-1.5 text-amber-400">
                              <Building2 className="w-3.5 h-3.5" />
                              <span className="font-medium text-foreground text-[11px]">
                                {l.linkedAssetName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Unsecured</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="default"
                              size="sm"
                              className="h-7 text-[11px] gap-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                              onClick={() => setEmiModalLiability(l)}
                              title="Record monthly EMI and interest split"
                            >
                              <Landmark className="w-3 h-3" />
                              Pay EMI
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 text-[11px] gap-1 px-2.5"
                              onClick={() => setBalanceModalLiability(l)}
                              title="Record a new outstanding balance"
                            >
                              <History className="w-3 h-3 text-primary" />
                              Bal
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setEditingLiability(l);
                                setIsAddModalOpen(true);
                              }}
                              title="Edit loan details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(l)}
                              title="Delete loan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

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
            refetchSummary();
            queryClient.invalidateQueries({ queryKey: ['holdings-details', userId] });
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
    </div>
  );
}
