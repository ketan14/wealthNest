import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/supabase/auth-context';
import { SupabaseLiabilityAdapter } from '@/lib/supabase/liability.adapter';
import { SupabaseHoldingAdapter } from '@/lib/supabase/holding.adapter';
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
import { UpdateValuationModal } from '@/components/liabilities/UpdateValuationModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
} from 'lucide-react';

const DEMO_LIABILITIES: LiabilityDto[] = [
  {
    id: 'demo-loan-1',
    userId: 'demo-user',
    name: 'SBI Green Home Loan',
    loanType: 'home_loan',
    lender: 'State Bank of India',
    accountNumber: '38192004812',
    originalPrincipalCents: 500000000n, // ₹50,00,000 (50L)
    currentBalanceCents: 412500000n, // ₹41,25,000 (41.25L)
    interestRate: 8.5,
    interestType: 'floating',
    tenureMonths: 240,
    emiAmountCents: 4339100n, // ₹43,391/mo
    currency: 'INR',
    startDate: '2023-01-15',
    endDate: '2043-01-15',
    status: 'active',
    linkedAssetId: 'asset-home-1',
    linkedAssetName: '3BHK Apartment - Bengaluru',
    notes: 'Pegged to EBLR repo rate',
    lastBalanceDate: '2026-01-10',
    createdAt: '2023-01-15T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'demo-loan-2',
    userId: 'demo-user',
    name: 'HDFC EV Auto Loan',
    loanType: 'vehicle_loan',
    lender: 'HDFC Bank',
    accountNumber: '89102938129',
    originalPrincipalCents: 150000000n, // ₹15,00,000 (15L)
    currentBalanceCents: 85000000n, // ₹8,50,000 (8.5L)
    interestRate: 7.9,
    interestType: 'fixed',
    tenureMonths: 60,
    emiAmountCents: 3034000n, // ₹30,340/mo
    currency: 'INR',
    startDate: '2024-03-01',
    endDate: '2029-03-01',
    status: 'active',
    notes: 'Electric Vehicle concessional green loan',
    lastBalanceDate: '2026-01-05',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2026-01-05T00:00:00Z',
  },
];

export function LiabilitiesPage() {
  const { user } = useAuth();
  const userId = user?.id || '';
  const queryClient = useQueryClient();

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState<LiabilityDto | null>(null);
  const [balanceModalLiability, setBalanceModalLiability] = useState<LiabilityDto | null>(null);

  // Valuation modal state
  const [valuationModalAsset, setValuationModalAsset] = useState<{
    id: string;
    name: string;
    valuationCents: bigint;
  } | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('active');

  // Query 1: Liabilities list
  const {
    data: liabilities = [],
    isLoading: isLoadingLiabilities,
    refetch: refetchLiabilities,
  } = useQuery({
    queryKey: ['liabilities-list', userId],
    queryFn: async () => {
      if (!userId) return [];
      const adapter = new SupabaseLiabilityAdapter();
      const res = await adapter.listLiabilitiesByUser(userId);
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
    queryKey: ['net-worth-summary', userId],
    queryFn: async () => {
      if (!userId) return null;
      const holdingAdapter = new SupabaseHoldingAdapter();
      const liabilityAdapter = new SupabaseLiabilityAdapter();
      const useCase = new GetNetWorthSummaryUseCase(holdingAdapter, liabilityAdapter);
      const res = await useCase.execute({ userId });
      if (!res.success) throw res.error;
      return res.value;
    },
    enabled: Boolean(userId),
  });

  // Mutation: Save / Create / Update Liability
  const saveLiabilityMutation = useMutation({
    mutationFn: async (params: CreateLiabilityParams | UpdateLiabilityParams) => {
      const adapter = new SupabaseLiabilityAdapter();
      if ('id' in params) {
        const useCase = new UpdateLiabilityUseCase(adapter);
        const res = await useCase.execute(params);
        if (!res.success) throw res.error;
        return res.value;
      } else {
        const useCase = new CreateLiabilityUseCase(adapter);
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
      const adapter = new SupabaseLiabilityAdapter();
      const useCase = new DeleteLiabilityUseCase(adapter);
      const res = await useCase.execute(id, userId);
      if (!res.success) throw res.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liabilities-list', userId] });
      queryClient.invalidateQueries({ queryKey: ['net-worth-summary', userId] });
    },
  });

  const handleDelete = async (l: LiabilityDto) => {
    if (
      window.confirm(
        `Are you sure you want to remove the loan "${l.name}"? Historical balance records will also be removed.`
      )
    ) {
      await deleteLiabilityMutation.mutateAsync(l.id);
    }
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

  const effectiveLiabilities = useMemo(() => {
    return liabilities.length > 0 ? liabilities : DEMO_LIABILITIES;
  }, [liabilities]);

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
            className="gap-2 shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Add Loan / Liability
          </Button>
        </div>
      </div>

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
              ₹{totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
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
              ₹{totalMonthlyEmi.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              ₹{(totalMonthlyEmi * 12).toLocaleString('en-IN', { maximumFractionDigits: 0 })}/year
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
              {isSolvent ? '₹' : '-₹'}
              {netWorthVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Property Equity & Loan-To-Value (LTV)
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Mortgage balances automatically offset property valuations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {effectiveSummary.propertyEquities.map((pe) => {
              const propVal = pe.propertyValue.toDecimal();
              const debtVal = pe.totalDebt.toDecimal();
              const eqVal = pe.equity.toDecimal();
              const ltv = pe.ltvRatioPercentage;

              return (
                <Card
                  key={pe.assetId}
                  className="border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden"
                >
                  <CardHeader className="pb-3 border-b border-border/50 bg-accent/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-amber-400" />
                        <CardTitle className="text-base font-semibold">{pe.assetName}</CardTitle>
                      </div>
                      <Badge
                        variant={pe.isNegativeEquity ? 'destructive' : 'success'}
                        className="text-xs"
                      >
                        {pe.isNegativeEquity ? 'Negative Equity / Underwater' : 'Positive Equity'}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-accent/30 border border-border/60">
                        <span className="block text-[11px] text-muted-foreground uppercase font-medium">
                          Property Value
                        </span>
                        <span className="text-sm font-bold font-mono text-foreground">
                          ₹{propVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-accent/30 border border-border/60">
                        <span className="block text-[11px] text-muted-foreground uppercase font-medium">
                          Secured Debt
                        </span>
                        <span className="text-sm font-bold font-mono text-rose-400">
                          ₹{debtVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <span className="block text-[11px] text-emerald-400 uppercase font-medium">
                          Net Home Equity
                        </span>
                        <span
                          className={`text-sm font-bold font-mono ${
                            pe.isNegativeEquity ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {pe.isNegativeEquity ? '-₹' : '₹'}
                          {eqVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>

                    {/* LTV Progress Bar */}
                    <div>
                      <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                        <span className="text-muted-foreground">Loan-To-Value (LTV):</span>
                        <span
                          className={`font-semibold ${
                            ltv > 80
                              ? 'text-rose-400'
                              : ltv > 60
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                          }`}
                        >
                          {ltv.toFixed(1)}% LTV
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-accent overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            ltv > 80 ? 'bg-rose-500' : ltv > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(ltv, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>0%</span>
                        <span>Bank Limit 80%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {/* Linked Loans List */}
                    {pe.linkedLoans.length > 0 && (
                      <div className="pt-2 border-t border-border/60">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5">
                          Secured Loans ({pe.linkedLoans.length})
                        </p>
                        <div className="space-y-1">
                          {pe.linkedLoans.map((l) => (
                            <div
                              key={l.liabilityId}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-accent/20"
                            >
                              <span className="text-foreground">{l.name}</span>
                              <span className="font-mono font-medium text-rose-400">
                                ₹
                                {l.outstandingBalance
                                  .toDecimal()
                                  .toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action button */}
                    <div className="flex justify-end pt-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs gap-1.5 h-8"
                        onClick={() =>
                          setValuationModalAsset({
                            id: pe.assetId,
                            name: pe.assetName,
                            valuationCents: BigInt(Math.round(propVal * 100)),
                          })
                        }
                      >
                        <Building2 className="w-3.5 h-3.5 text-amber-400" />
                        Update Appraisal
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
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
                              <span className="text-[11px] text-muted-foreground">
                                {l.lender}
                                {l.accountNumber ? ` • #${l.accountNumber}` : ''}
                              </span>
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
                          ₹{origPrincipal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>

                        {/* Current Outstanding */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-mono font-bold text-foreground">
                            ₹{currentBal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
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
                              ₹{emi.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
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
                              variant="secondary"
                              size="sm"
                              className="h-7 text-[11px] gap-1 px-2.5"
                              onClick={() => setBalanceModalLiability(l)}
                              title="Record a new outstanding balance"
                            >
                              <History className="w-3 h-3 text-primary" />
                              Update Bal
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
    </div>
  );
}
