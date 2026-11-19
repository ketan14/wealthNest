import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  GetNetWorthSummaryUseCase,
  GetCashflowSummaryUseCase,
  ManageDocumentVaultUseCase,
  HoldingDetailDto,
  LiabilityDto,
  GoalDetailDto,
} from '@wealthnest/application';
import {
  Money,
  NetWorthSummary,
  CashflowSummary,
  calculatePortfolioSummary,
  HoldingValuationItem,
  evaluateEmergencyRunway,
  evaluateAutomatedHouseholdAlerts,
  summarizeDocumentVault,
  filterRecordsByPrivacy,
} from '@wealthnest/domain';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useRepositories } from '@/lib/persistence/repository-context';
import { useAuth } from '@/lib/supabase/auth-context';
import { useFamily } from '@/lib/family/family-context';
import { usePrivacy } from '@/lib/preferences/privacy-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { WealthTrajectoryChart } from '@/components/home/WealthTrajectoryChart';
import { GlobalQuickAddModal } from '@/components/layout/GlobalQuickAddModal';
import {
  TrendingDown,
  TrendingUp,
  Landmark,
  ShieldCheck,
  Target,
  Plus,
  PieChart,
  Building2,
  FolderLock,
  Eye,
  EyeOff,
  Users,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

type AssetCategoryFilter = 'all' | 'equity' | 'mutual_funds' | 'property' | 'gold';

export function HomePage() {
  const { user } = useAuth();
  const { activeHouseholdId, households } = useHousehold();
  const {
    holdingRepo,
    liabilityRepo,
    transactionRepo,
    documentVaultRepo,
    goalRepo,
    mode,
  } = useRepositories();
  const { members, selectedMemberId, setSelectedMemberId, privacyRules } = useFamily();
  const { hideBalances, toggleHideBalances } = usePrivacy();

  const [categoryFilter, setCategoryFilter] = useState<AssetCategoryFilter>('all');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  const isDemoMode = mode === 'supabase' && (!user?.id || user.id.startsWith('demo-'));
  const scopeId = isDemoMode ? user?.id || 'demo-user' : activeHouseholdId || user?.id || '';
  const effectiveHouseholdId = isDemoMode ? undefined : activeHouseholdId;

  // Active household name display
  const activeHousehold = households.find((h) => h.id === activeHouseholdId);
  const householdDisplayName = activeHousehold?.name || 'My Family';

  // 1. Fetch Holdings
  const { data: holdings = [] } = useQuery<HoldingDetailDto[]>({
    queryKey: ['holdings', scopeId, selectedMemberId, privacyRules],
    queryFn: async () => {
      if (!scopeId) return [];
      const result = await (holdingRepo.listDetailsByHousehold
        ? holdingRepo.listDetailsByHousehold(scopeId)
        : holdingRepo.listDetailsByUser(scopeId));
      if (!result.success) return [];
      let list = result.value;
      if (selectedMemberId !== 'all') {
        list = list.filter(
          (h: HoldingDetailDto) =>
            h.memberId === selectedMemberId ||
            h.owners?.some((o) => o.familyMemberId === selectedMemberId)
        );
      }
      return filterRecordsByPrivacy(list, selectedMemberId, privacyRules);
    },
  });

  // 2. Fetch Net Worth Summary
  const { data: netWorthSummary } = useQuery<NetWorthSummary | null>({
    queryKey: ['net-worth-summary', scopeId, selectedMemberId],
    queryFn: async () => {
      const useCase = new GetNetWorthSummaryUseCase(holdingRepo, liabilityRepo);
      const result = await useCase.execute({
        userId: user?.id || scopeId || 'demo-user',
        householdId: effectiveHouseholdId,
        memberId: selectedMemberId,
      });
      if (!result.success) return null;
      return result.value;
    },
  });

  // 3. Fetch Cashflow Summary
  const { data: cashflowSummary } = useQuery<CashflowSummary | null>({
    queryKey: ['cashflow-summary', scopeId],
    queryFn: async () => {
      if (!scopeId) return null;
      const useCase = new GetCashflowSummaryUseCase(transactionRepo);
      const result = await useCase.execute(scopeId);
      if (!result.success) return null;
      return result.value.summary;
    },
  });

  // 4. Fetch Goals Summary
  const { data: goals = [] } = useQuery<readonly GoalDetailDto[]>({
    queryKey: ['goals', scopeId, selectedMemberId],
    queryFn: async () => {
      if (!goalRepo || !scopeId) return [];
      const res = await (goalRepo.listGoalsByHousehold
        ? goalRepo.listGoalsByHousehold(scopeId)
        : goalRepo.listGoalsByUser(scopeId));
      if (!res.success) return [];
      let list = res.value;
      if (selectedMemberId !== 'all') {
        list = list.filter((g) => g.memberId === selectedMemberId);
      }
      return list;
    },
  });

  // 5. Fetch Liabilities
  const { data: liabilities = [] } = useQuery<readonly LiabilityDto[]>({
    queryKey: ['liabilities', scopeId, selectedMemberId],
    queryFn: async () => {
      if (!scopeId) return [];
      const result = await (liabilityRepo.listLiabilitiesByHousehold
        ? liabilityRepo.listLiabilitiesByHousehold(scopeId)
        : liabilityRepo.listLiabilitiesByUser(scopeId));
      if (!result.success) return [];
      let list = result.value;
      if (selectedMemberId !== 'all') {
        list = list.filter(
          (l: LiabilityDto) =>
            l.memberId === selectedMemberId ||
            l.parties?.some((p) => p.familyMemberId === selectedMemberId) ||
            l.coBorrowerMemberIds?.includes(selectedMemberId)
        );
      }
      return list;
    },
  });

  // 6. Fetch Document Vault Summary
  const { data: vaultSummary } = useQuery({
    queryKey: ['vault-summary', scopeId],
    queryFn: async () => {
      if (isDemoMode || !scopeId) return null;
      const useCase = new ManageDocumentVaultUseCase(documentVaultRepo);
      const result = await useCase.listDocuments(scopeId);
      if (!result.success) return null;
      return summarizeDocumentVault(result.value);
    },
  });

  // Domain portfolio valuation
  const valuationItems: HoldingValuationItem[] = holdings.map((h) => ({
    holdingId: h.holdingId,
    assetClassId: h.assetClassId,
    assetClassName: h.assetClassName || 'Asset',
    colorHex: h.assetClassColor || '#3b82f6',
    quantity: h.quantity,
    costBasis: Money.fromCents(BigInt(Math.round(h.quantity * (h.unitCostCents || 0))), 'INR'),
    currentValue: Money.fromCents(BigInt(h.currentValueCents || 0), 'INR'),
  }));

  const portfolioSummary = calculatePortfolioSummary(valuationItems, 'INR');

  // Total Assets & Liabilities
  const totalAssets =
    netWorthSummary?.totalAssets?.toDecimal() ?? portfolioSummary.totalValue.toDecimal();
  const totalLiabilities = netWorthSummary?.totalLiabilities?.toDecimal() ?? 0;
  const netWorth = totalAssets - totalLiabilities;
  const totalMonthlyEmi = netWorthSummary?.totalMonthlyEmi?.toDecimal() ?? 0;

  // Monthly Cashflow
  const monthlyInflow = cashflowSummary?.totalInflows?.toDecimal() ?? 0;
  const monthlyOutflow = cashflowSummary?.totalOutflows?.toDecimal() ?? 0;
  const netMonthlyCashflow = monthlyInflow - monthlyOutflow;

  // Goals progress calculation
  const goalsSummary = useMemo(() => {
    if (!goals || goals.length === 0) return { progressPct: 0, count: 0 };
    let totalTarget = 0;
    let totalSaved = 0;
    goals.forEach((g) => {
      totalTarget += g.targetAmountCents || 0;
      totalSaved += g.initialSavedCents || 0;
    });
    const pct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
    return { progressPct: Math.min(pct, 100), count: goals.length };
  }, [goals]);

  // Liquid assets estimation (Cash, Bank Deposits, Liquid Mutual Funds)
  const liquidAssetClasses = new Set(['cash_and_bank', 'liquid_funds', 'mutual_fund']);
  const liquidHoldings = holdings.filter((h) => liquidAssetClasses.has(h.assetClassId));
  const liquidAssets = liquidHoldings.reduce((sum, h) => sum + (h.currentValueCents || 0) / 100, 0);

  // Asset Class Allocation percentages for Left Desktop Column
  const assetAllocations = useMemo(() => {
    const total = portfolioSummary.totalValue.toDecimal();
    if (total <= 0) {
      return [
        { label: 'Equities', pct: 42, color: 'text-blue-400' },
        { label: 'Property', pct: 35, color: 'text-amber-400' },
        { label: 'Cash', pct: 15, color: 'text-emerald-400' },
        { label: 'Gold', pct: 8, color: 'text-yellow-400' },
      ];
    }
    return portfolioSummary.allocations.slice(0, 4).map((a) => ({
      label: a.name,
      pct: Math.round(a.percentage),
      color: 'text-foreground',
    }));
  }, [portfolioSummary]);

  // Counts per asset class for category pill badges
  const categoryCounts = useMemo(() => {
    const counts = { equity: 0, mutual_funds: 0, property: 0, gold: 0 };
    holdings.forEach((h) => {
      const cls = h.assetClassId.toLowerCase();
      if (cls.includes('stock') || cls.includes('equity') || cls.includes('shares')) counts.equity++;
      if (cls.includes('mutual') || cls.includes('liquid') || cls.includes('index')) counts.mutual_funds++;
      if (cls.includes('real_estate') || cls.includes('property') || cls.includes('land')) counts.property++;
      if (cls.includes('gold') || cls.includes('sgb') || cls.includes('metal')) counts.gold++;
    });
    return counts;
  }, [holdings]);

  // Contextual Hero Filter Calculations
  const categoryDisplay = useMemo(() => {
    if (categoryFilter === 'all') {
      return {
        title: 'FAMILY NET WORTH',
        isCategoryView: false,
        amount: netWorth,
        assets: totalAssets,
        debt: totalLiabilities,
      };
    }

    const filterMap: Record<AssetCategoryFilter, string[]> = {
      all: [],
      equity: ['stocks', 'equity', 'shares'],
      mutual_funds: ['mutual_fund', 'liquid_funds', 'index_funds'],
      property: ['real_estate', 'property', 'land'],
      gold: ['gold', 'sgb', 'precious_metals'],
    };

    const targetClasses = filterMap[categoryFilter];
    const filteredHoldings = holdings.filter((h) =>
      targetClasses.some((tc) => h.assetClassId.toLowerCase().includes(tc))
    );
    const catValue = filteredHoldings.reduce(
      (sum, h) => sum + (h.currentValueCents || 0) / 100,
      0
    );

    const titleMap: Record<AssetCategoryFilter, string> = {
      all: 'FAMILY NET WORTH',
      equity: 'EQUITY & STOCKS VALUE',
      mutual_funds: 'MUTUAL FUND VALUE',
      property: 'REAL ESTATE VALUE',
      gold: 'GOLD & SGB VALUE',
    };

    return {
      title: titleMap[categoryFilter],
      isCategoryView: true,
      amount: catValue,
      assets: catValue,
      debt: 0,
    };
  }, [categoryFilter, netWorth, totalAssets, totalLiabilities, holdings]);

  // Automated Household Alerts for Actionable Radar
  const householdAlerts = evaluateAutomatedHouseholdAlerts({
    emergencyRunway: evaluateEmergencyRunway({
      liquidCorpus: Money.fromCents(BigInt(Math.round(liquidAssets * 100)), 'INR'),
      monthlyExpenses: Money.fromCents(
        BigInt(Math.round((monthlyOutflow || totalMonthlyEmi || 50000) * 100)),
        'INR'
      ),
      targetMonths: 6,
    }),
    totalMonthlyEmi: netWorthSummary?.totalMonthlyEmi ?? Money.zero('INR'),
    holdings: holdings.map((h) => ({
      id: h.holdingId,
      name: h.name,
      assetClassId: h.assetClassId,
      updatedAt: h.updatedAt,
    })),
    liabilities,
    vaultSummary,
    section112aEligible: true,
  });

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Mobile-Only Sub-Header Bar */}
      <div className="flex md:hidden items-center justify-between py-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-sm">
            <ShieldCheck className="w-4 h-4 text-slate-950" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-foreground">WealthNest</span>
            <span className="block text-[10px] text-muted-foreground">{householdDisplayName}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleHideBalances}
            className="text-muted-foreground hover:text-foreground h-8 w-8 p-0 rounded-lg"
            title={hideBalances ? 'Show Balances' : 'Hide Balances'}
          >
            {hideBalances ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
          </Button>

          <Button
            size="sm"
            onClick={() => setIsQuickAddOpen(true)}
            className="h-8 px-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-lg shadow-sm flex items-center gap-1"
            title="Quick Add"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Quick Add</span>
          </Button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MOBILE LAYOUT (< 1024px)                                        */}
      {/* Matches user's mobile wireframe exactly                        */}
      {/* ============================================================== */}
      <div className="block lg:hidden space-y-5">
        {/* My Family & Member Filter Chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-slate-400">My Family</span>
            <span className="px-2 py-0.5 rounded-full bg-secondary text-[11px] border border-border/60">
              Household
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              type="button"
              onClick={() => setSelectedMemberId('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedMemberId === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-secondary border border-border/60'
              }`}
            >
              All Members
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMemberId(m.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  selectedMemberId === m.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-secondary/60 text-muted-foreground hover:bg-secondary border border-border/60'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* Hero Card: Family Net Worth / Contextual Asset Value */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm relative overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>{categoryDisplay.title}</span>
              <button
                type="button"
                onClick={toggleHideBalances}
                className="hover:text-foreground transition-colors"
              >
                {hideBalances ? (
                  <EyeOff className="w-4 h-4 text-amber-400" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <CardTitle className="text-3xl font-extrabold font-mono tracking-tight pt-1">
              <CurrencyDisplay
                amount={categoryDisplay.amount}
                isPositiveColor={categoryDisplay.amount >= 0}
                allowToggle
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            {/* Sub-Metrics: Assets vs Debt */}
            {!categoryDisplay.isCategoryView ? (
              <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/50 pb-3">
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-slate-400">
                    Total Assets
                  </span>
                  <CurrencyDisplay
                    amount={categoryDisplay.assets}
                    className="text-sm font-bold text-foreground"
                    allowToggle
                  />
                </div>
                <div className="text-right">
                  <span className="block text-[11px] uppercase tracking-wider text-slate-400">
                    Total Liabilities
                  </span>
                  <CurrencyDisplay
                    amount={categoryDisplay.debt}
                    className="text-sm font-bold text-foreground"
                    allowToggle
                  />
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground border-b border-border/50 pb-3 flex items-center justify-between">
                <span>Viewing {categoryDisplay.title.toLowerCase()}. Liabilities excluded.</span>
                {categoryDisplay.amount === 0 && (
                  <Link
                    to={categoryFilter === 'property' ? '/real-estate' : '/portfolio?action=new'}
                    className="text-emerald-400 font-semibold hover:underline"
                  >
                    + Add {categoryFilter === 'property' ? 'Property' : 'Asset'}
                  </Link>
                )}
              </div>
            )}

            {/* View By Asset Category Pills */}
            <div>
              <span className="block text-[10px] uppercase font-semibold text-muted-foreground mb-2">
                View By Asset Category
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { id: 'all', label: 'All', count: holdings.length },
                    { id: 'equity', label: 'Equity', count: categoryCounts.equity },
                    { id: 'mutual_funds', label: 'Mutual Funds', count: categoryCounts.mutual_funds },
                    { id: 'property', label: 'Property', count: categoryCounts.property },
                    { id: 'gold', label: 'Gold', count: categoryCounts.gold },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                      categoryFilter === cat.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-secondary/70 text-muted-foreground hover:bg-secondary border border-border/50'
                    }`}
                  >
                    <span>{cat.label}</span>
                    {cat.count > 0 && (
                      <span className="text-[10px] px-1 py-0.2 rounded-full bg-black/25 text-inherit opacity-85">
                        {cat.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2x2 Executive Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* 1. Liquid Assets */}
          <Card className="p-3.5 border-border/80 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-semibold uppercase">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Liquid Assets</span>
            </div>
            <div className="text-lg font-bold font-mono mt-1">
              <CurrencyDisplay amount={liquidAssets} allowToggle />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Cash, bank, deposits</p>
          </Card>

          {/* 2. Monthly EMI */}
          <Card className="p-3.5 border-border/80 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-semibold uppercase">
              <Landmark className="w-3.5 h-3.5 text-amber-400" />
              <span>Monthly EMI</span>
            </div>
            <div className="text-lg font-bold font-mono mt-1">
              <CurrencyDisplay amount={totalMonthlyEmi} allowToggle />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Monthly obligations</p>
          </Card>

          {/* 3. Monthly Cash Flow */}
          <Card className="p-3.5 border-border/80 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-semibold uppercase">
              {netMonthlyCashflow >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span>Monthly Cash Flow</span>
            </div>
            <div className="text-lg font-bold font-mono mt-1">
              <CurrencyDisplay
                amount={netMonthlyCashflow}
                showSign
                isPositiveColor={netMonthlyCashflow >= 0}
                allowToggle
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Income minus expenses</p>
          </Card>

          {/* 4. Goals Progress */}
          <Card className="p-3.5 border-border/80 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-semibold uppercase">
              <Target className="w-3.5 h-3.5 text-purple-400" />
              <span>Goals</span>
            </div>
            <p className="text-lg font-bold font-mono text-foreground mt-1">
              {goalsSummary.progressPct}%
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Overall progress</p>
          </Card>
        </div>

        {/* Wealth Trajectory Chart (Positioned Below Key Metrics) */}
        <WealthTrajectoryChart currentNetWorthRupees={netWorth} />

        {/* Manage Your Wealth (2x2 Grid) */}
        <div className="space-y-2 pb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Manage your wealth
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/portfolio" className="group">
              <Card className="p-3.5 border-border/70 hover:border-primary/50 transition-all bg-card/40 hover:bg-card/70">
                <div className="flex items-center gap-2 mb-1">
                  <PieChart className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold text-foreground">Portfolio</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Investments and assets</p>
              </Card>
            </Link>

            <Link to="/real-estate" className="group">
              <Card className="p-3.5 border-border/70 hover:border-amber-500/50 transition-all bg-card/40 hover:bg-card/70">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-semibold text-foreground">Real Estate</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Properties and rent</p>
              </Card>
            </Link>

            <Link to="/liabilities" className="group">
              <Card className="p-3.5 border-border/70 hover:border-rose-500/50 transition-all bg-card/40 hover:bg-card/70">
                <div className="flex items-center gap-2 mb-1">
                  <Landmark className="w-4 h-4 text-rose-400" />
                  <span className="text-sm font-semibold text-foreground">Liabilities</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Loans and EMIs</p>
              </Card>
            </Link>

            <Link to="/goals" className="group">
              <Card className="p-3.5 border-border/70 hover:border-purple-500/50 transition-all bg-card/40 hover:bg-card/70">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-semibold text-foreground">Financial Goals</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Targets and progress</p>
              </Card>
            </Link>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* DESKTOP THREE-COLUMN LAYOUT (≥ 1024px)                          */}
      {/* Matches user's desktop wireframe exactly                       */}
      {/* ============================================================== */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-6 items-start">
        {/* ------------------------------------------------------------ */}
        {/* LEFT COLUMN (22% -> 3/12 cols)                              */}
        {/* Household, Family Members, Asset Allocation                  */}
        {/* ------------------------------------------------------------ */}
        <div className="lg:col-span-3 space-y-6 bg-card/30 p-4 rounded-2xl border border-border/60">
          {/* Household Selector */}
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Household
            </span>
            <div className="mt-1.5 p-2 rounded-xl bg-secondary/50 border border-border/60 text-sm font-medium text-foreground flex items-center justify-between">
              <span>{householdDisplayName}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Active
              </span>
            </div>
          </div>

          {/* Family Members Selector */}
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Family Members
            </span>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSelectedMemberId('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  selectedMemberId === 'all'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                }`}
              >
                <span>All Members</span>
                <Users className="w-3.5 h-3.5" />
              </button>
              {members.map((m) => {
                const isSelected = selectedMemberId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMemberId(m.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                        : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                    }`}
                  >
                    <span>{m.name}</span>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: m.colorHex || '#3b82f6' }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Asset Allocation Breakdown */}
          <div className="border-t border-border/50 pt-5">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Asset Allocation
            </span>
            <div className="space-y-2.5">
              {assetAllocations.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{a.label}</span>
                  <span className="font-semibold font-mono text-foreground">{a.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* CENTER COLUMN (53% -> 6/12 cols)                            */}
        {/* Net Worth Hero, Wealth Trajectory, Wealth Modules           */}
        {/* ------------------------------------------------------------ */}
        <div className="lg:col-span-6 space-y-6">
          {/* Executive Hero Card */}
          <Card className="border-border/80 bg-card/60 backdrop-blur-sm relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
                <span>{categoryDisplay.title}</span>
                <button
                  type="button"
                  onClick={toggleHideBalances}
                  className="hover:text-foreground transition-colors"
                >
                  {hideBalances ? (
                    <EyeOff className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <CardTitle className="text-3xl font-extrabold font-mono tracking-tight pt-1">
                <CurrencyDisplay
                  amount={categoryDisplay.amount}
                  isPositiveColor={categoryDisplay.amount >= 0}
                  allowToggle
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 pt-1">
              {/* 3-Part Metric Breakdown (Assets, Debt, Net Worth) */}
              <div className="grid grid-cols-3 gap-2 border-t border-b border-border/50 py-3 text-xs">
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                    Assets
                  </span>
                  <div className="text-sm font-bold mt-0.5">
                    <CurrencyDisplay amount={categoryDisplay.assets} allowToggle />
                  </div>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                    Debt
                  </span>
                  <div className="text-sm font-bold mt-0.5">
                    <CurrencyDisplay amount={categoryDisplay.debt} allowToggle />
                  </div>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                    Net Worth
                  </span>
                  <div className="text-sm font-bold mt-0.5">
                    <CurrencyDisplay
                      amount={categoryDisplay.amount}
                      isPositiveColor={categoryDisplay.amount >= 0}
                      allowToggle
                    />
                  </div>
                </div>
              </div>

              {/* View By Asset Category Pills */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { id: 'all', label: 'All', count: holdings.length },
                      { id: 'equity', label: 'Equity', count: categoryCounts.equity },
                      { id: 'mutual_funds', label: 'Mutual Funds', count: categoryCounts.mutual_funds },
                      { id: 'property', label: 'Property', count: categoryCounts.property },
                      { id: 'gold', label: 'Gold', count: categoryCounts.gold },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                        categoryFilter === cat.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-secondary/70 text-muted-foreground hover:bg-secondary border border-border/50'
                      }`}
                    >
                      <span>{cat.label}</span>
                      {cat.count > 0 && (
                        <span className="text-[10px] px-1 py-0.2 rounded-full bg-black/25 text-inherit opacity-85">
                          {cat.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {categoryDisplay.isCategoryView && categoryDisplay.amount === 0 && (
                  <Link
                    to={categoryFilter === 'property' ? '/real-estate' : '/portfolio?action=new'}
                    className="text-xs text-emerald-400 font-semibold hover:underline"
                  >
                    + Register {categoryFilter === 'property' ? 'Property' : 'Asset'}
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Wealth Trajectory Chart */}
          <WealthTrajectoryChart currentNetWorthRupees={netWorth} />

          {/* Wealth Modules Shortcuts */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Wealth Modules
            </span>
            <div className="grid grid-cols-3 gap-3">
              <Link to="/portfolio" className="group">
                <Card className="p-4 border-border/70 hover:border-primary/50 transition-all bg-card/40 hover:bg-card/70">
                  <div className="flex items-center gap-2 mb-1">
                    <PieChart className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-semibold text-foreground">Portfolio</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Investments</p>
                </Card>
              </Link>

              <Link to="/real-estate" className="group">
                <Card className="p-4 border-border/70 hover:border-amber-500/50 transition-all bg-card/40 hover:bg-card/70">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-semibold text-foreground">Properties</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Real Estate</p>
                </Card>
              </Link>

              <Link to="/liabilities" className="group">
                <Card className="p-4 border-border/70 hover:border-rose-500/50 transition-all bg-card/40 hover:bg-card/70">
                  <div className="flex items-center gap-2 mb-1">
                    <Landmark className="w-4 h-4 text-rose-400" />
                    <span className="text-sm font-semibold text-foreground">Loans</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Liabilities</p>
                </Card>
              </Link>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* RIGHT COLUMN (25% -> 3/12 cols)                             */}
        {/* Financial Health, Liquid Reserves, EMIs, Attention Required */}
        {/* ------------------------------------------------------------ */}
        <div className="lg:col-span-3 space-y-4">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Financial Health
          </span>

          {/* Liquid Reserves Card */}
          <Card className="p-4 border-border/80 bg-card/60 backdrop-blur-sm">
            <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
              Liquid Reserves
            </span>
            <div className="text-2xl font-bold font-mono mt-1">
              <CurrencyDisplay amount={liquidAssets} allowToggle />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Cash, Bank & Mutual Funds</p>
          </Card>

          {/* Monthly EMIs Card */}
          <Card className="p-4 border-border/80 bg-card/60 backdrop-blur-sm">
            <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
              Monthly EMIs
            </span>
            <div className="text-2xl font-bold font-mono mt-1">
              <CurrencyDisplay amount={totalMonthlyEmi} allowToggle />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Outstanding obligations</p>
          </Card>

          {/* Actionable Attention Radar */}
          <Card className="p-4 border-border/80 bg-card/60 backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                Attention Required
              </span>
              {householdAlerts.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 font-mono">
                  {householdAlerts.length}
                </span>
              )}
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Upcoming loan payments tracked</span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>Quarterly property valuation check</span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <FolderLock className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span>Document & policy renewal alerts</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Global Quick Add Action Modal Triggered from Header or Nav */}
      <GlobalQuickAddModal isOpen={isQuickAddOpen} onClose={() => setIsQuickAddOpen(false)} />
    </div>
  );
}
