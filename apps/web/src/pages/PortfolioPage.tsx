import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CurrencyCode,
  Money,
  calculatePortfolioSummary,
  PortfolioSummary,
  HoldingValuationItem,
} from '@wealthnest/domain';
import {
  GetPortfolioSummaryUseCase,
  AddHoldingUseCase,
  DeleteHoldingUseCase,
  HoldingDetailDto,
} from '@wealthnest/application';
import { SupabaseHoldingAdapter } from '@/lib/supabase/holding.adapter';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AddHoldingModal, NewHoldingFormValues } from '@/components/portfolio/AddHoldingModal';
import { ImportCasModal } from '@/components/portfolio/ImportCasModal';
import {
  PieChart,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Scale,
  Layers,
  ArrowUpRight,
  Database,
  Sparkles,
  Search,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Demo initial positions tailored for Indian investors (India First)
const DEMO_HOLDINGS: HoldingDetailDto[] = [
  {
    holdingId: 'demo-1',
    assetId: 'asset-1',
    name: 'Reliance Industries Ltd',
    ticker: 'RELIANCE',
    assetClassId: 'equity',
    assetClassName: 'Equities & Mutual Funds',
    assetClassColor: '#3b82f6',
    quantity: 80,
    unitCostCents: 250000, // ₹2,500.00
    currentValueCents: 23600000, // ₹2,36,000.00 (+₹36,000)
    currency: 'INR',
    updatedAt: new Date().toISOString(),
  },
  {
    holdingId: 'demo-2',
    assetId: 'asset-2',
    name: 'Nifty 50 Index ETF',
    ticker: 'NIFTYBEES',
    assetClassId: 'equity',
    assetClassName: 'Equities & Mutual Funds',
    assetClassColor: '#3b82f6',
    quantity: 500,
    unitCostCents: 24000, // ₹240.00
    currentValueCents: 14000000, // ₹1,40,000.00 (+₹20,000)
    currency: 'INR',
    updatedAt: new Date().toISOString(),
  },
  {
    holdingId: 'demo-3',
    assetId: 'asset-3',
    name: 'Tata Consultancy Services',
    ticker: 'TCS',
    assetClassId: 'equity',
    assetClassName: 'Equities & Mutual Funds',
    assetClassColor: '#3b82f6',
    quantity: 40,
    unitCostCents: 360000, // ₹3,600.00
    currentValueCents: 16600000, // ₹1,66,000.00 (+₹22,000)
    currency: 'INR',
    updatedAt: new Date().toISOString(),
  },
  {
    holdingId: 'demo-4',
    assetId: 'asset-4',
    name: 'Sovereign Gold Bond 2028',
    ticker: 'SGB-2028',
    assetClassId: 'commodity',
    assetClassName: 'Gold & Precious Metals',
    assetClassColor: '#eab308',
    quantity: 30, // grams
    unitCostCents: 580000, // ₹5,800.00
    currentValueCents: 22950000, // ₹2,29,500.00 (+₹55,500)
    currency: 'INR',
    updatedAt: new Date().toISOString(),
  },
  {
    holdingId: 'demo-5',
    assetId: 'asset-5',
    name: 'Public Provident Fund (PPF)',
    ticker: 'PPF',
    assetClassId: 'fixed_income',
    assetClassName: 'Fixed Income & Debt',
    assetClassColor: '#8b5cf6',
    quantity: 1,
    unitCostCents: 150000000, // ₹15,00,000.00 (15 Lakhs)
    currentValueCents: 150000000, // ₹15,00,000.00
    currency: 'INR',
    updatedAt: new Date().toISOString(),
  },
  {
    holdingId: 'demo-6',
    assetId: 'asset-6',
    name: 'HDFC Bank Fixed Deposit',
    ticker: 'HDFC-FD',
    assetClassId: 'fixed_income',
    assetClassName: 'Fixed Income & Debt',
    assetClassColor: '#8b5cf6',
    quantity: 1,
    unitCostCents: 50000000, // ₹5,00,000.00 (5 Lakhs)
    currentValueCents: 50000000, // ₹5,00,000.00
    currency: 'INR',
    updatedAt: new Date().toISOString(),
  },
  {
    holdingId: 'demo-7',
    assetId: 'asset-7',
    name: 'Emergency Bank Savings',
    ticker: 'CASH',
    assetClassId: 'cash',
    assetClassName: 'Cash & Liquid Savings',
    assetClassColor: '#10b981',
    quantity: 1,
    unitCostCents: 25000000, // ₹2,50,000.00 (2.5 Lakhs)
    currentValueCents: 25000000, // ₹2,50,000.00
    currency: 'INR',
    updatedAt: new Date().toISOString(),
  },
  {
    holdingId: 'demo-8',
    assetId: 'asset-8',
    name: 'Embassy Office Parks REIT',
    ticker: 'EMBASSY',
    assetClassId: 'real_estate',
    assetClassName: 'Real Estate & Land',
    assetClassColor: '#f59e0b',
    quantity: 600,
    unitCostCents: 34000, // ₹340.00
    currentValueCents: 23700000, // ₹2,37,000.00 (+₹33,000)
    currency: 'INR',
    updatedAt: new Date().toISOString(),
  },
];

const ASSET_CLASS_META_MAP: Record<string, { name: string; color: string }> = {
  equity: { name: 'Equities & Mutual Funds', color: '#3b82f6' },
  mutual_fund: { name: 'Equities & Mutual Funds', color: '#3b82f6' },
  fixed_income: { name: 'Fixed Income & Debt', color: '#8b5cf6' },
  commodity: { name: 'Gold & Precious Metals', color: '#eab308' },
  real_estate: { name: 'Real Estate & Land', color: '#f59e0b' },
  cash: { name: 'Cash & Liquid Savings', color: '#10b981' },
  crypto: { name: 'Digital Assets & Crypto', color: '#ec4899' },
};

export function PortfolioPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Local state for interactive demo mode when not logged in
  const [localDemoHoldings, setLocalDemoHoldings] = useState<HoldingDetailDto[]>(DEMO_HOLDINGS);

  const holdingAdapter = useMemo(() => new SupabaseHoldingAdapter(), []);

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

  // Calculate live portfolio values:
  // If user is authenticated, use their Supabase database data.
  // Otherwise, calculate live from local interactive demo data.
  const activeHoldings: HoldingDetailDto[] = useMemo(() => {
    if (user && dbPortfolioData) {
      return [...dbPortfolioData.holdings];
    }
    return localDemoHoldings;
  }, [user, dbPortfolioData, localDemoHoldings]);

  // Pure Domain Summary calculation with Money value objects
  const summary: PortfolioSummary = useMemo(() => {
    if (user && dbPortfolioData) {
      return dbPortfolioData.summary;
    }

    const valuationItems: HoldingValuationItem[] = localDemoHoldings.map((h) => {
      const holdingCurrency = (h.currency as CurrencyCode) || 'INR';
      const totalCostCents = BigInt(Math.round((Number(h.quantity) || 0) * (Number(h.unitCostCents) || 0)));
      const costBasis = Money.fromCents(totalCostCents, holdingCurrency);
      const currentValue = Money.fromCents(BigInt(Math.round(Number(h.currentValueCents) || 0)), holdingCurrency);

      return {
        holdingId: h.holdingId,
        assetClassId: h.assetClassId,
        assetClassName: h.assetClassName,
        colorHex: h.assetClassColor,
        quantity: h.quantity,
        costBasis,
        currentValue,
      };
    });

    return calculatePortfolioSummary(valuationItems, 'INR');
  }, [user, dbPortfolioData, localDemoHoldings]);

  // Filter holdings based on search and selected class
  const filteredHoldings = useMemo(() => {
    return activeHoldings.filter((h) => {
      const matchesSearch =
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (h.ticker && h.ticker.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesClass = !selectedClassFilter || h.assetClassId === selectedClassFilter;
      return matchesSearch && matchesClass;
    });
  }, [activeHoldings, searchQuery, selectedClassFilter]);

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
          assetClassId: values.assetClassId,
          currency: values.currency || 'INR',
          quantity: values.quantity,
          unitCostCents,
          currentValueCents,
        });

        if (!res.success) throw res.error;
        return res.value;
      } else {
        // Demo Mode: Add into local state
        const newDemoItem: HoldingDetailDto = {
          holdingId: `demo-${Date.now()}`,
          assetId: `asset-${Date.now()}`,
          name: values.name,
          ticker: values.ticker,
          assetClassId: values.assetClassId,
          assetClassName: values.assetClassId.toUpperCase(),
          assetClassColor: '#3b82f6',
          quantity: values.quantity,
          unitCostCents,
          currentValueCents,
          currency: values.currency || 'INR',
          updatedAt: new Date().toISOString(),
        };
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
      } else {
        setLocalDemoHoldings((prev) => prev.filter((h) => h.holdingId !== holdingId));
      }
    },
    onSuccess: () => {
      setDeletingId(null);
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['portfolio-summary', user.id] });
        refetch();
      }
    },
    onError: (err) => {
      setDeletingId(null);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete holding.');
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Portfolio & Asset Allocation
            </h2>
            <Badge variant="default" className="font-mono text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30">
              India First (₹ INR)
            </Badge>
            <Badge variant={user ? 'success' : 'secondary'} className="font-mono text-[10px]">
              {user ? 'Database Active' : 'Demo Mode'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Indian multi-asset wealth tracker with Lakh/Crore precision and pure domain valuation engine.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            className="gap-2 shadow-sm border-primary/20 hover:bg-primary/5 text-foreground"
          >
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            Import CAS
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="gap-2 shadow-sm">
            <Plus className="w-4 h-4" />
            Add Holding
          </Button>
        </div>
      </div>

      {/* Mode Alert Banner if not authenticated */}
      {!user && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                India-First Demonstration Portfolio Active
              </p>
              <p className="text-xs text-muted-foreground">
                Sample portfolio featuring Indian Equities (Reliance, Nifty 50, TCS), Sovereign Gold Bonds (SGB), PPF, and FDs.
                Sign in to save and sync your real portfolio in PostgreSQL.
              </p>
            </div>
          </div>
          <Link to="/">
            <Button variant="default" size="sm" className="whitespace-nowrap text-xs gap-1.5">
              Sign In to Save
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Top Portfolio Valuation Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Net Portfolio Value */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Portfolio Value
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {summary.totalValue.format('en-IN')}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {summary.totalValue.formatIndianCompact()}
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                {summary.totalValue.currency}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Total Cost Basis */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Cost Basis
            </CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {summary.totalCostBasis.format('en-IN')}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-secondary/80 text-foreground border border-border">
                {summary.totalCostBasis.formatIndianCompact()}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Net capital invested
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Unrealized Profit / Loss */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Unrealized Profit/Loss
            </CardTitle>
            {summary.isProfitable ? (
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-rose-400" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-mono ${
                summary.isProfitable ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {summary.isProfitable ? '+' : '-'}
              {summary.unrealizedGainLoss.format('en-IN')}
            </div>
            <p className="text-[11px] font-mono mt-1 flex items-center gap-1.5">
              <span
                className={`font-semibold ${
                  summary.isProfitable ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {summary.isProfitable ? '+' : ''}
                {summary.returnPercentage.toFixed(2)}%
              </span>
              <span className="text-muted-foreground">all-time yield</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Positions & Asset Classes */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Asset Diversity
            </CardTitle>
            <Layers className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {activeHoldings.length} Positions
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Across {summary.allocations.length} Indian asset categories
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Asset Allocation Breakdown */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Asset Class Allocation (India Taxonomy)</CardTitle>
            </div>
            <Badge variant="secondary">Zero Float Drift</Badge>
          </div>
          <CardDescription>
            Calculated distribution across Indian financial instruments and asset classes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Segmented allocation progress bar */}
          <div className="w-full h-3.5 rounded-full overflow-hidden flex bg-secondary/60 p-0.5 border border-border/50">
            {summary.allocations.map((alloc) => (
              <div
                key={alloc.assetClassId}
                title={`${alloc.name}: ${alloc.percentage.toFixed(1)}% (${alloc.totalValue.format('en-IN')})`}
                style={{
                  width: `${alloc.percentage}%`,
                  backgroundColor: alloc.colorHex,
                }}
                className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 hover:opacity-80"
              />
            ))}
          </div>

          {/* Asset Class Pills & Percentages */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
            {summary.allocations.map((alloc) => (
              <div
                key={alloc.assetClassId}
                onClick={() =>
                  setSelectedClassFilter((prev) =>
                    prev === alloc.assetClassId ? null : alloc.assetClassId
                  )
                }
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  selectedClassFilter === alloc.assetClassId
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border/60 bg-secondary/30 hover:border-border hover:bg-secondary/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: alloc.colorHex }}
                  />
                  <span className="text-xs font-medium text-foreground truncate">
                    {alloc.name}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-sm font-bold font-mono text-foreground">
                    {alloc.percentage.toFixed(1)}%
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {alloc.totalValue.formatIndianCompact()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Holdings Management Table */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Portfolio Holdings</CardTitle>
              <CardDescription>
                Positions with unit cost basis, current market value, and unrealized yield in Indian Rupees (₹).
              </CardDescription>
            </div>

            {/* Filter and Search */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter asset or ticker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-3 text-xs rounded-lg bg-secondary/50 border border-border focus:outline-none focus:ring-1 focus:ring-primary w-44 md:w-56 font-mono text-foreground"
                />
              </div>

              {selectedClassFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedClassFilter(null)}
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
                onClick={() => setDeleteError(null)}
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
                <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  Add Holding
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsImportModalOpen(true)}
                  className="gap-1.5 text-xs font-mono"
                >
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  Import CAS
                </Button>
                {user && activeHoldings.length === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSeedStarterHoldings}
                    className="gap-1.5 text-xs font-mono"
                  >
                    Seed 4 Starter Assets
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-y border-border/80 bg-secondary/20 text-muted-foreground">
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">Asset / Ticker</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">Class</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Quantity</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Cost Basis</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Current Value</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Gain / Loss</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 font-mono">
                  {filteredHoldings.map((h) => {
                    const totalCostCents = Math.round(h.quantity * h.unitCostCents);
                    const gainLossCents = h.currentValueCents - totalCostCents;
                    const isGain = gainLossCents >= 0;
                    const returnPct = totalCostCents > 0 ? (gainLossCents / totalCostCents) * 100 : 0;

                    const costBasisFormatted = (totalCostCents / 100).toLocaleString('en-IN', {
                      style: 'currency',
                      currency: h.currency || 'INR',
                    });
                    const currentValueFormatted = (h.currentValueCents / 100).toLocaleString('en-IN', {
                      style: 'currency',
                      currency: h.currency || 'INR',
                    });
                    const gainLossFormatted = (Math.abs(gainLossCents) / 100).toLocaleString('en-IN', {
                      style: 'currency',
                      currency: h.currency || 'INR',
                    });

                    return (
                      <tr key={h.holdingId} className="hover:bg-secondary/30 transition-colors">
                        {/* Name & Ticker */}
                        <td className="py-3.5 px-4 font-sans">
                          <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                            {h.name}
                            {h.ticker && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary/80 border border-border text-primary font-bold">
                                {h.ticker}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Asset Class */}
                        <td className="py-3.5 px-4 font-sans">
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border"
                            style={{
                              borderColor: `${h.assetClassColor}40`,
                              backgroundColor: `${h.assetClassColor}15`,
                              color: h.assetClassColor,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: h.assetClassColor }}
                            />
                            {h.assetClassName}
                          </span>
                        </td>

                        {/* Quantity */}
                        <td className="py-3.5 px-4 text-right text-foreground">
                          {h.quantity.toLocaleString('en-IN', { maximumFractionDigits: 6 })}
                        </td>

                        {/* Cost Basis */}
                        <td className="py-3.5 px-4 text-right text-muted-foreground">
                          <div>{costBasisFormatted}</div>
                          <div className="text-[10px] text-muted-foreground/80">
                            ₹{(h.unitCostCents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}/u
                          </div>
                        </td>

                        {/* Current Value */}
                        <td className="py-3.5 px-4 text-right font-bold text-foreground">
                          {currentValueFormatted}
                        </td>

                        {/* Gain / Loss */}
                        <td className="py-3.5 px-4 text-right">
                          <span className={isGain ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                            {isGain ? '+' : '-'}
                            {gainLossFormatted}
                          </span>
                          <div
                            className={`text-[10px] font-medium ${
                              isGain ? 'text-emerald-400/80' : 'text-rose-400/80'
                            }`}
                          >
                            {isGain ? '+' : ''}
                            {returnPct.toFixed(2)}%
                          </div>
                        </td>

                        {/* Delete Action */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            disabled={deletingId === h.holdingId}
                            onClick={() => {
                              if (window.confirm(`Delete holding "${h.name}" from your portfolio?`)) {
                                deleteHoldingMutation.mutate(h.holdingId);
                              }
                            }}
                            title="Delete Position"
                            className="p-1.5 rounded-md text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {deletingId === h.holdingId ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Holding Modal Component */}
      <AddHoldingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={async (values) => {
          await addHoldingMutation.mutateAsync(values);
        }}
        isLoading={addHoldingMutation.isPending}
      />

      {/* Import CAS Modal Component */}
      <ImportCasModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(importedItems) => {
          if (user) {
            queryClient.invalidateQueries({ queryKey: ['portfolio-summary', user.id] });
            refetch();
          }
          if (importedItems && importedItems.length > 0) {
            setLocalDemoHoldings((prev) => {
              const updated = [...prev];
              for (const item of importedItems) {
                // Match existing holding by ticker, or name
                const idx = updated.findIndex((h) => {
                  const matchTicker = Boolean(
                    item.ticker && h.ticker && h.ticker.toUpperCase() === item.ticker.toUpperCase()
                  );
                  const matchName =
                    h.name.toLowerCase() === item.name.toLowerCase() ||
                    (item.name && h.name.toLowerCase().includes(item.name.toLowerCase())) ||
                    (item.name && item.name.toLowerCase().includes(h.name.toLowerCase()));
                  return matchTicker || matchName;
                });

                if (idx >= 0) {
                  // Update existing holding position: attach security name and ticker from CAS
                  updated[idx] = {
                    ...updated[idx]!,
                    name: item.name,
                    ticker: item.ticker || updated[idx]!.ticker,
                    quantity: item.quantity,
                    unitCostCents: item.unitCostCents,
                    currentValueCents: item.currentValueCents,
                    updatedAt: new Date().toISOString(),
                  };
                } else {
                  // Add as a new holding position
                  const classMeta = ASSET_CLASS_META_MAP[item.assetClassId] || {
                    name: item.assetClassId.toUpperCase(),
                    color: '#3b82f6',
                  };
                  updated.unshift({
                    holdingId: `cas-${item.isin || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    assetId: `asset-${item.isin || Date.now()}`,
                    name: item.name,
                    ticker: item.ticker,
                    assetClassId: item.assetClassId,
                    assetClassName: classMeta.name,
                    assetClassColor: classMeta.color,
                    quantity: item.quantity,
                    unitCostCents: item.unitCostCents,
                    currentValueCents: item.currentValueCents,
                    currency: item.currency || 'INR',
                    updatedAt: new Date().toISOString(),
                  });
                }
              }
              return updated;
            });
          }
        }}
      />
    </div>
  );
}
export default PortfolioPage;
