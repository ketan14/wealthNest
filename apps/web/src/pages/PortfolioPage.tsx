import { useState, useMemo, useCallback } from 'react';
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
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { MarketQuoteDto } from '@wealthnest/application';
import { useLiveMarketFeed } from '@/lib/market/useLiveMarketFeed';
import { useFamily } from '@/lib/family/family-context';
import { FamilyFilterBar } from '@/components/family/FamilyFilterBar';
import { FamilyDistributionWidget } from '@/components/family/FamilyDistributionWidget';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';

// Demo initial positions tailored for Indian investors (India First)
const DEMO_HOLDINGS: HoldingDetailDto[] = [
  {
    holdingId: 'demo-1',
    assetId: 'asset-1',
    name: 'Reliance Industries Ltd',
    ticker: 'RELIANCE',
    isin: 'INE002A01018',
    dematAccountId: '1208160000000000',
    assetClassId: 'equity',
    assetClassName: 'Equities & Stocks',
    assetClassColor: '#3b82f6',
    quantity: 80,
    unitCostCents: 250000, // ₹2,500.00
    currentValueCents: 23600000, // ₹2,36,000.00 (+₹36,000)
    currency: 'INR',
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-self',
    accountId: 'acc-zerodha',
  },
  {
    holdingId: 'demo-2',
    assetId: 'asset-2',
    name: 'Parag Parikh Flexi Cap Fund',
    ticker: 'PPFAS-FLEXI',
    isin: 'INF879O01019',
    amcName: 'PPFAS Mutual Fund',
    folioNumber: '10123456/90',
    schemePlan: 'Direct Plan - Growth',
    assetClassId: 'mutual_fund',
    assetClassName: 'Mutual Funds',
    assetClassColor: '#06b6d4',
    quantity: 1500,
    unitCostCents: 5500, // ₹55.00
    currentValueCents: 11000000, // ₹1,10,000.00 (+₹27,500)
    currency: 'INR',
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-spouse',
    accountId: 'acc-groww',
  },
  {
    holdingId: 'demo-3',
    assetId: 'asset-3',
    name: 'Tata Consultancy Services',
    ticker: 'TCS',
    isin: 'INE467B01029',
    dematAccountId: '1208160000000000',
    assetClassId: 'equity',
    assetClassName: 'Equities & Stocks',
    assetClassColor: '#3b82f6',
    quantity: 40,
    unitCostCents: 360000, // ₹3,600.00
    currentValueCents: 16600000, // ₹1,66,000.00 (+₹22,000)
    currency: 'INR',
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-huf',
    accountId: 'acc-icici',
  },
  {
    holdingId: 'demo-4',
    assetId: 'asset-4',
    name: 'Sovereign Gold Bond 2028',
    ticker: 'SGB-2028',
    isin: 'IN0020180017',
    dematAccountId: '1208160000000000',
    assetClassId: 'commodity',
    assetClassName: 'Gold & Precious Metals',
    assetClassColor: '#eab308',
    quantity: 30, // grams
    unitCostCents: 580000, // ₹5,800.00
    currentValueCents: 22950000, // ₹2,29,500.00 (+₹55,500)
    currency: 'INR',
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-self',
    accountId: 'acc-zerodha',
  },
  {
    holdingId: 'demo-2b',
    assetId: 'asset-2b',
    name: 'Bandhan Large & Mid Cap Fund',
    ticker: 'BANDHAN-LM',
    isin: 'INF194K01V89',
    amcName: 'Bandhan Mutual Fund',
    folioNumber: '209928335/70',
    schemePlan: 'Direct Plan - Growth',
    assetClassId: 'mutual_fund',
    assetClassName: 'Mutual Funds',
    assetClassColor: '#06b6d4',
    quantity: 2268.239,
    unitCostCents: 14720, // ₹147.20
    currentValueCents: 37671800, // ₹3,76,718.00
    currency: 'INR',
    costBasisVerified: false,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-child',
    accountId: 'acc-cams',
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
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-self',
    accountId: 'acc-sbi-ppf',
  },
  {
    holdingId: 'demo-6',
    assetId: 'asset-6',
    name: 'Bank of Baroda Senior Citizen FD',
    ticker: 'BOB-FD',
    assetClassId: 'fixed_income',
    assetClassName: 'Fixed Income & Debt',
    assetClassColor: '#8b5cf6',
    quantity: 1,
    unitCostCents: 50000000, // ₹5,00,000.00 (5 Lakhs)
    currentValueCents: 50000000, // ₹5,00,000.00
    currency: 'INR',
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-mother',
    accountId: 'acc-bob-fd',
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
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-self',
    accountId: 'acc-zerodha',
  },
  {
    holdingId: 'demo-8',
    assetId: 'asset-8',
    name: 'Embassy Office Parks REIT',
    ticker: 'EMBASSY',
    isin: 'INE041025011',
    dematAccountId: '1208160000000000',
    assetClassId: 'real_estate',
    assetClassName: 'Real Estate & Land',
    assetClassColor: '#f59e0b',
    quantity: 600,
    unitCostCents: 34000, // ₹340.00
    currentValueCents: 23700000, // ₹2,37,000.00 (+₹33,000)
    currency: 'INR',
    costBasisVerified: true,
    updatedAt: new Date().toISOString(),
    memberId: 'mem-huf',
    accountId: 'acc-icici',
  },
];

const ASSET_CLASS_META_MAP: Record<string, { name: string; color: string }> = {
  equity: { name: 'Equities & Stocks', color: '#3b82f6' },
  mutual_fund: { name: 'Mutual Funds', color: '#06b6d4' },
  fixed_income: { name: 'Fixed Income & Debt', color: '#8b5cf6' },
  commodity: { name: 'Gold & Precious Metals', color: '#eab308' },
  real_estate: { name: 'Real Estate & Land', color: '#f59e0b' },
  cash: { name: 'Cash & Liquid Savings', color: '#10b981' },
  crypto: { name: 'Digital Assets & Crypto', color: '#ec4899' },
};

export function PortfolioPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { selectedMemberId, selectedAccountId, members, accounts } = useFamily();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'equities' | 'mutual_funds' | 'grouped'>('all');
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

  // Consolidated pool of all holdings (DB or local demo)
  const allHoldings: HoldingDetailDto[] = useMemo(() => {
    if (user && dbPortfolioData) {
      return [...dbPortfolioData.holdings];
    }
    return localDemoHoldings;
  }, [user, dbPortfolioData, localDemoHoldings]);

  // Active holdings filtered by Family Member / Legal Entity & Demat Account
  const activeHoldings: HoldingDetailDto[] = useMemo(() => {
    return allHoldings.filter((h) => {
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
  }, [allHoldings, selectedMemberId, selectedAccountId]);

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
  const summary: PortfolioSummary = useMemo(() => {
    const valuationItems: HoldingValuationItem[] = activeHoldings.map((h) => {
      const holdingCurrency = (h.currency as CurrencyCode) || 'INR';
      const totalCostCents = BigInt(
        Math.round((Number(h.quantity) || 0) * (Number(h.unitCostCents) || 0))
      );
      const costBasis = Money.fromCents(totalCostCents, holdingCurrency);
      const currentValue = Money.fromCents(
        BigInt(Math.round(Number(h.currentValueCents) || 0)),
        holdingCurrency
      );

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
  }, [activeHoldings]);

  // Filter holdings based on search and selected class
  const filteredHoldings = useMemo(() => {
    return activeHoldings.filter((h) => {
      const matchesSearch =
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (h.ticker && h.ticker.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (h.isin && h.isin.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (h.folioNumber && h.folioNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (h.amcName && h.amcName.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesClass = !selectedClassFilter || h.assetClassId === selectedClassFilter;
      return matchesSearch && matchesClass;
    });
  }, [activeHoldings, searchQuery, selectedClassFilter]);

  // Separate investment subsets for specialized views
  const equitiesHoldings = useMemo(() => {
    return filteredHoldings.filter(
      (h) => h.assetClassId === 'equity' || (h.assetClassId !== 'mutual_fund' && !h.folioNumber)
    );
  }, [filteredHoldings]);

  const mutualFundHoldings = useMemo(() => {
    return filteredHoldings.filter(
      (h) => h.assetClassId === 'mutual_fund' || Boolean(h.folioNumber)
    );
  }, [filteredHoldings]);

  // Group filtered holdings by asset class for categorized multi-table view
  const groupedHoldings = useMemo(() => {
    const map = new Map<
      string,
      {
        meta: { name: string; color: string };
        holdings: HoldingDetailDto[];
        totalValueCents: number;
        totalCostCents: number;
      }
    >();

    for (const h of filteredHoldings) {
      const classId = h.assetClassId || 'equity';
      if (!map.has(classId)) {
        map.set(classId, {
          meta: ASSET_CLASS_META_MAP[classId] || {
            name: h.assetClassName || classId.toUpperCase(),
            color: h.assetClassColor || '#3b82f6',
          },
          holdings: [],
          totalValueCents: 0,
          totalCostCents: 0,
        });
      }
      const grp = map.get(classId)!;
      grp.holdings.push(h);
      grp.totalValueCents += h.currentValueCents;
      grp.totalCostCents += Math.round(h.quantity * h.unitCostCents);
    }

    return Array.from(map.entries()).map(([classId, data]) => ({
      classId,
      ...data,
    }));
  }, [filteredHoldings]);

  // Subtotals for Equities
  const equitiesSubtotals = useMemo(() => {
    const totalShares = equitiesHoldings.reduce((acc, h) => acc + h.quantity, 0);
    const totalValueCents = equitiesHoldings.reduce((acc, h) => acc + h.currentValueCents, 0);
    const totalCostCents = equitiesHoldings.reduce(
      (acc, h) => acc + Math.round(h.quantity * h.unitCostCents),
      0
    );
    const gainLossCents = totalValueCents - totalCostCents;
    const returnPct = totalCostCents > 0 ? (gainLossCents / totalCostCents) * 100 : 0;
    return { totalShares, totalValueCents, totalCostCents, gainLossCents, returnPct };
  }, [equitiesHoldings]);

  // Subtotals for Mutual Funds
  const mfSubtotals = useMemo(() => {
    const totalUnits = mutualFundHoldings.reduce((acc, h) => acc + h.quantity, 0);
    const totalValueCents = mutualFundHoldings.reduce((acc, h) => acc + h.currentValueCents, 0);
    const verifiedHoldings = mutualFundHoldings.filter((h) => h.costBasisVerified);
    const totalVerifiedCostCents = verifiedHoldings.reduce(
      (acc, h) => acc + Math.round(h.quantity * h.unitCostCents),
      0
    );
    const verifiedValueCents = verifiedHoldings.reduce((acc, h) => acc + h.currentValueCents, 0);
    const verifiedGainLossCents = verifiedValueCents - totalVerifiedCostCents;
    const verifiedReturnPct =
      totalVerifiedCostCents > 0 ? (verifiedGainLossCents / totalVerifiedCostCents) * 100 : 0;
    return {
      totalUnits,
      totalValueCents,
      totalVerifiedCostCents,
      verifiedGainLossCents,
      verifiedReturnPct,
      hasUnverified: mutualFundHoldings.some((h) => !h.costBasisVerified),
    };
  }, [mutualFundHoldings]);

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
        const newDemoItem: HoldingDetailDto = {
          holdingId: `demo-${Date.now()}`,
          assetId: `asset-${Date.now()}`,
          name: values.name,
          ticker: values.ticker,
          isin: values.isin,
          dematAccountId: values.dematAccountId,
          folioNumber: values.folioNumber,
          amcName: values.amcName,
          schemePlan: values.schemePlan,
          costBasisVerified: values.costBasisVerified,
          memberId: values.memberId,
          accountId: values.accountId,
          assetClassId: values.assetClassId,
          assetClassName:
            values.assetClassId === 'mutual_fund'
              ? 'Mutual Funds'
              : ASSET_CLASS_META_MAP[values.assetClassId]?.name ||
                values.assetClassId.toUpperCase(),
          assetClassColor: ASSET_CLASS_META_MAP[values.assetClassId]?.color || '#3b82f6',
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
      }
    },
    onSuccess: () => {
      setDeletingId(null);
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['portfolio-summary', user.id] });
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Portfolio & Asset Allocation
            </h2>
            <Badge
              variant="default"
              className="font-mono text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30"
            >
              India First (₹ INR)
            </Badge>
            <Badge variant={user ? 'success' : 'secondary'} className="font-mono text-[10px]">
              {user ? 'Database Active' : 'Demo Mode'}
            </Badge>
            {/* Live Indian Market (NSE/BSE) Session Indicator */}
            <Badge
              variant="outline"
              className={`font-mono text-[10px] flex items-center gap-1.5 ${
                marketSession.isOpen
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-secondary/70 text-muted-foreground border-border'
              }`}
              title={`Indian Market Session: ${marketSession.description} (${marketSession.istTimeString})`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  marketSession.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                }`}
              />
              {marketSession.isOpen
                ? 'NSE/BSE: OPEN'
                : `NSE/BSE: CLOSED (${marketSession.istTimeString})`}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Indian multi-asset wealth tracker with Lakh/Crore precision, automated live stock CMP,
            and separated Direct Equities and Mutual Fund portfolios.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Live Auto-Polling Toggle Button */}
          <Button
            variant={isPolling ? 'default' : 'outline'}
            onClick={() => setIsPolling((prev) => !prev)}
            className={`gap-1.5 shadow-sm text-xs border ${
              isPolling
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/50'
                : 'border-border/80 text-muted-foreground hover:text-foreground'
            }`}
            title="Automatically poll live stock CMP and AMFI NAVs every 25 seconds"
          >
            <Radio
              className={`w-3.5 h-3.5 ${isPolling ? 'animate-pulse text-white' : 'text-muted-foreground'}`}
            />
            <span>Auto-Poll: {isPolling ? 'ON' : 'OFF'}</span>
          </Button>

          <Button
            variant="secondary"
            onClick={() => void handleRefreshLiveNavs()}
            disabled={isRefreshingNavs}
            className="gap-2 shadow-sm text-xs border border-border/80"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshingNavs ? 'animate-spin' : ''}`}
            />
            {isRefreshingNavs ? 'Fetching Feeds...' : 'Refresh Quotes (NSE & AMFI)'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            className="gap-2 shadow-sm border-primary/20 hover:bg-primary/5 text-foreground text-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            Import CAS
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="gap-2 shadow-sm text-xs">
            <Plus className="w-4 h-4" />
            Add Holding
          </Button>
        </div>
      </div>

      {/* Phase 6A: Multi-Entity Family & Demat Filter Bar */}
      <FamilyFilterBar onOpenManageModal={() => setIsManageFamilyOpen(true)} />

      {/* Phase 6A: Consolidated Family Distribution & HUF Shield */}
      {selectedMemberId === 'all' && <FamilyDistributionWidget />}

      {/* AMFI & NSE Refresh Success Alert */}
      {navRefreshMessage && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3.5 flex items-center justify-between text-xs text-cyan-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{navRefreshMessage}</span>
          </div>
          <span className="font-mono text-[10px] text-cyan-400/80">NSE/BSE & AMFI Feeds</span>
        </div>
      )}

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
                Sample portfolio featuring Indian Equities (Reliance, TCS), Mutual Funds (Parag
                Parikh, Bandhan), Sovereign Gold Bonds (SGB), PPF, and FDs. Sign in to save and sync
                your real portfolio in PostgreSQL.
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

      {/* Top Portfolio Valuation Summary Cards: Unified across all holdings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Portfolio Value */}
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
            <p className="text-[11px] font-mono text-muted-foreground mt-1">
              {summary.totalValue.formatIndianCompact()} (zero float drift)
            </p>
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
            <p className="text-[11px] font-mono text-muted-foreground mt-1">
              Historical cost of verified positions
            </p>
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
              <CardTitle className="text-base">
                Asset Class Allocation (Unified Net Worth)
              </CardTitle>
            </div>
            <Badge variant="secondary">Zero Float Drift</Badge>
          </div>
          <CardDescription>
            Unified distribution across Indian equities, mutual funds, gold bonds, debt, and cash
            instruments.
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
                  <span className="text-xs font-medium text-foreground truncate">{alloc.name}</span>
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
              <div className="flex items-center p-0.5 bg-secondary/60 rounded-lg border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
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
                  onClick={() => setViewMode('equities')}
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
                  onClick={() => setViewMode('mutual_funds')}
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
                  onClick={() => setViewMode('grouped')}
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
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-3 text-xs rounded-lg bg-secondary/50 border border-border focus:outline-none focus:ring-1 focus:ring-primary w-40 sm:w-56 font-mono text-foreground"
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
                    Seed Starter Assets
                  </Button>
                )}
              </div>
            </div>
          ) : viewMode === 'equities' ? (
            /* VIEW 1: Direct Equities & ETFs Tailored View */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-y border-border/80 bg-blue-500/5 text-muted-foreground">
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">Security</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">Ticker</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">ISIN</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">
                      Demat Account
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                      Quantity
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                      Market Price
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                      Value
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                      Gain / Loss
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-center">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 font-mono">
                  {equitiesHoldings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground font-sans">
                        No direct equity or ETF holdings match the filter.
                      </td>
                    </tr>
                  ) : (
                    equitiesHoldings.map((h) => {
                      const totalCostCents = Math.round(h.quantity * h.unitCostCents);
                      const gainLossCents = h.currentValueCents - totalCostCents;
                      const isGain = gainLossCents >= 0;
                      const returnPct =
                        totalCostCents > 0 ? (gainLossCents / totalCostCents) * 100 : 0;
                      const marketPricePerShare =
                        h.quantity > 0 ? h.currentValueCents / (h.quantity * 100) : 0;

                      return (
                        <tr key={h.holdingId} className="hover:bg-secondary/30 transition-colors">
                          <td className="py-3.5 px-4 font-sans font-semibold text-foreground">
                            <div>{h.name}</div>
                            {(() => {
                              const mem = members.find((m) => m.id === (h.memberId || 'mem-self'));
                              const acc = accounts.find((a) => a.id === h.accountId);
                              return (
                                <div className="flex items-center gap-1.5 mt-1 font-sans">
                                  {mem && (
                                    <span
                                      className="text-[10px] px-1.5 py-0.2 rounded font-medium flex items-center gap-1"
                                      style={{
                                        backgroundColor: `${mem.colorHex}22`,
                                        border: `1px solid ${mem.colorHex}55`,
                                        color: mem.colorHex,
                                      }}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: mem.colorHex }} />
                                      {mem.name.split(' ')[0]} {mem.relationship === 'huf' ? 'HUF' : ''}
                                    </span>
                                  )}
                                  {acc && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground font-mono border border-border">
                                      {acc.brokerName}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3.5 px-4">
                            {h.ticker ? (
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">
                                {h.ticker}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">
                            {h.isin || '—'}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">
                            {h.dematAccountId || 'Demat Main'}
                          </td>
                          <td className="py-3.5 px-4 text-right text-foreground font-semibold">
                            {h.quantity.toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                          </td>
                          <td className="py-3.5 px-4 text-right text-muted-foreground">
                            {(() => {
                              const q =
                                (h.isin && liveQuotesMap.get(h.isin)) ||
                                (h.ticker && liveQuotesMap.get(h.ticker)) ||
                                liveQuotesMap.get(h.holdingId);
                              const price = q ? q.priceCents / 100 : marketPricePerShare;
                              const isUp = q ? q.changePercent >= 0 : isGain;
                              return (
                                <div>
                                  <div className="font-bold text-foreground">
                                    ₹
                                    {price.toLocaleString('en-IN', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </div>
                                  {q && (
                                    <div className="flex items-center justify-end gap-1 text-[10px] mt-0.5 font-sans">
                                      <span
                                        className={`px-1 rounded text-[9px] font-semibold ${
                                          isUp
                                            ? 'text-emerald-400 bg-emerald-500/10'
                                            : 'text-rose-400 bg-rose-500/10'
                                        }`}
                                      >
                                        {isUp ? '+' : ''}
                                        {q.changePercent.toFixed(2)}%
                                      </span>
                                      <span className="font-mono text-[9px] text-blue-400">
                                        {q.source}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-foreground">
                            ₹
                            {(h.currentValueCents / 100).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span
                              className={
                                isGain
                                  ? 'text-emerald-400 font-semibold'
                                  : 'text-rose-400 font-semibold'
                              }
                            >
                              {isGain ? '+' : '-'}₹
                              {(Math.abs(gainLossCents) / 100).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                            <div
                              className={`text-[10px] font-medium ${isGain ? 'text-emerald-400/80' : 'text-rose-400/80'}`}
                            >
                              {isGain ? '+' : ''}
                              {returnPct.toFixed(2)}%
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              disabled={deletingId === h.holdingId}
                              onClick={() => {
                                if (
                                  window.confirm(`Delete equity "${h.name}" from your portfolio?`)
                                ) {
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
                    })
                  )}
                </tbody>
                {equitiesHoldings.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border/80 bg-blue-500/5 font-mono text-xs font-semibold">
                      <td colSpan={4} className="py-3 px-4 text-foreground font-sans">
                        Subtotal ({equitiesHoldings.length} Equities & ETFs)
                      </td>
                      <td className="py-3 px-4 text-right text-foreground font-bold">
                        {equitiesSubtotals.totalShares.toLocaleString('en-IN', {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        Cost: ₹
                        {(equitiesSubtotals.totalCostCents / 100).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-foreground">
                        ₹
                        {(equitiesSubtotals.totalValueCents / 100).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={
                            equitiesSubtotals.gainLossCents >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }
                        >
                          {equitiesSubtotals.gainLossCents >= 0 ? '+' : '-'}₹
                          {(Math.abs(equitiesSubtotals.gainLossCents) / 100).toLocaleString(
                            'en-IN',
                            { minimumFractionDigits: 2 }
                          )}
                        </span>
                        <div className="text-[10px] text-muted-foreground">
                          {equitiesSubtotals.gainLossCents >= 0 ? '+' : ''}
                          {equitiesSubtotals.returnPct.toFixed(2)}%
                        </div>
                      </td>
                      <td className="py-3 px-4"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : viewMode === 'mutual_funds' ? (
            /* VIEW 2: Mutual Funds Tailored View */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-y border-border/80 bg-cyan-500/5 text-muted-foreground">
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">
                      Scheme / Fund Name
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">AMC</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">Folio No.</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">Plan</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                      Units
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                      NAV
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                      Cost Basis
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                      Current Value
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                      Gain / Loss
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-center">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 font-mono">
                  {mutualFundHoldings.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-muted-foreground font-sans">
                        No mutual fund positions match the filter.
                      </td>
                    </tr>
                  ) : (
                    mutualFundHoldings.map((h) => {
                      const totalCostCents = Math.round(h.quantity * h.unitCostCents);
                      const gainLossCents = h.currentValueCents - totalCostCents;
                      const isGain = gainLossCents >= 0;
                      const returnPct =
                        totalCostCents > 0 ? (gainLossCents / totalCostCents) * 100 : 0;
                      const navPerUnit =
                        h.quantity > 0 ? h.currentValueCents / (h.quantity * 100) : 0;

                      return (
                        <tr key={h.holdingId} className="hover:bg-secondary/30 transition-colors">
                          <td className="py-3.5 px-4 font-sans font-semibold text-foreground">
                            <div>{h.name}</div>
                            {h.isin && (
                              <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                                ISIN: {h.isin}
                              </div>
                            )}
                            {(() => {
                              const mem = members.find((m) => m.id === (h.memberId || 'mem-self'));
                              const acc = accounts.find((a) => a.id === h.accountId);
                              return (
                                <div className="flex items-center gap-1.5 mt-1 font-sans">
                                  {mem && (
                                    <span
                                      className="text-[10px] px-1.5 py-0.2 rounded font-medium flex items-center gap-1"
                                      style={{
                                        backgroundColor: `${mem.colorHex}22`,
                                        border: `1px solid ${mem.colorHex}55`,
                                        color: mem.colorHex,
                                      }}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: mem.colorHex }} />
                                      {mem.name.split(' ')[0]} {mem.relationship === 'huf' ? 'HUF' : ''}
                                    </span>
                                  )}
                                  {acc && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground font-mono border border-border">
                                      {acc.brokerName}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3.5 px-4 font-sans text-muted-foreground text-[11px]">
                            {h.amcName || '—'}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-cyan-400 font-semibold">
                            {h.folioNumber || '—'}
                          </td>
                          <td className="py-3.5 px-4 font-sans text-muted-foreground text-[11px]">
                            <span className="px-1.5 py-0.5 rounded bg-secondary/80 border border-border">
                              {h.schemePlan || 'Direct'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right text-foreground font-semibold">
                            {h.quantity.toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                          </td>
                          <td className="py-3.5 px-4 text-right text-muted-foreground">
                            ₹
                            {navPerUnit.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {h.costBasisVerified ? (
                              <div>
                                <div className="text-foreground font-semibold">
                                  ₹
                                  {(totalCostCents / 100).toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                  })}
                                </div>
                                <div className="text-[10px] text-emerald-400 flex items-center justify-end gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>Verified</span>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="text-muted-foreground">—</span>
                                <div className="text-[10px] text-amber-400/90 flex items-center justify-end gap-1">
                                  <HelpCircle className="w-2.5 h-2.5" />
                                  <span>Unverified (CAS)</span>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-foreground">
                            ₹
                            {(h.currentValueCents / 100).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {h.costBasisVerified ? (
                              <>
                                <span
                                  className={
                                    isGain
                                      ? 'text-emerald-400 font-semibold'
                                      : 'text-rose-400 font-semibold'
                                  }
                                >
                                  {isGain ? '+' : '-'}₹
                                  {(Math.abs(gainLossCents) / 100).toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                                <div
                                  className={`text-[10px] font-medium ${isGain ? 'text-emerald-400/80' : 'text-rose-400/80'}`}
                                >
                                  {isGain ? '+' : ''}
                                  {returnPct.toFixed(2)}%
                                </div>
                              </>
                            ) : (
                              <span className="text-muted-foreground text-[11px] italic">
                                Pending txn history
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              disabled={deletingId === h.holdingId}
                              onClick={() => {
                                if (window.confirm(`Delete mutual fund folio "${h.name}"?`)) {
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
                    })
                  )}
                </tbody>
                {mutualFundHoldings.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border/80 bg-cyan-500/5 font-mono text-xs font-semibold">
                      <td colSpan={4} className="py-3 px-4 text-foreground font-sans">
                        Subtotal ({mutualFundHoldings.length} Mutual Fund Folios)
                      </td>
                      <td className="py-3 px-4 text-right text-foreground font-bold">
                        {mfSubtotals.totalUnits.toLocaleString('en-IN', {
                          maximumFractionDigits: 3,
                        })}
                      </td>
                      <td className="py-3 px-4"></td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        Verified: ₹
                        {(mfSubtotals.totalVerifiedCostCents / 100).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-foreground">
                        ₹
                        {(mfSubtotals.totalValueCents / 100).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={
                            mfSubtotals.verifiedGainLossCents >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }
                        >
                          {mfSubtotals.verifiedGainLossCents >= 0 ? '+' : '-'}₹
                          {(Math.abs(mfSubtotals.verifiedGainLossCents) / 100).toLocaleString(
                            'en-IN',
                            { minimumFractionDigits: 2 }
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : viewMode === 'grouped' ? (
            /* VIEW 3: Grouped by Asset Class */
            <div className="p-4 space-y-6">
              {groupedHoldings.map((grp) => {
                const grpGainLossCents = grp.totalValueCents - grp.totalCostCents;
                const isGrpGain = grpGainLossCents >= 0;
                const grpGainLossFormatted = (Math.abs(grpGainLossCents) / 100).toLocaleString(
                  'en-IN',
                  {
                    style: 'currency',
                    currency: 'INR',
                  }
                );
                const grpCostFormatted = (grp.totalCostCents / 100).toLocaleString('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                });
                const grpValueFormatted = (grp.totalValueCents / 100).toLocaleString('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                });
                const grpReturnPct =
                  grp.totalCostCents > 0 ? (grpGainLossCents / grp.totalCostCents) * 100 : 0;

                return (
                  <div
                    key={grp.classId}
                    className="rounded-xl border border-border/80 bg-background/50 overflow-hidden shadow-xs"
                  >
                    {/* Section Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-secondary/30 border-b border-border/60 gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: grp.meta.color }}
                        />
                        <h3 className="font-semibold text-sm text-foreground">{grp.meta.name}</h3>
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {grp.holdings.length}{' '}
                          {grp.holdings.length === 1 ? 'position' : 'positions'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono">
                        <span className="text-muted-foreground">
                          Cost: <span className="text-foreground">{grpCostFormatted}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Value:{' '}
                          <span className="font-bold text-foreground">{grpValueFormatted}</span>
                        </span>
                        <span
                          className={
                            isGrpGain
                              ? 'text-emerald-400 font-semibold'
                              : 'text-rose-400 font-semibold'
                          }
                        >
                          {isGrpGain ? '+' : '-'}
                          {grpGainLossFormatted} ({isGrpGain ? '+' : ''}
                          {grpReturnPct.toFixed(2)}%)
                        </span>
                      </div>
                    </div>

                    {/* Section Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/60 bg-secondary/15 text-muted-foreground">
                            <th className="py-2.5 px-4 font-semibold uppercase tracking-wider">
                              Asset / Ticker
                            </th>
                            <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">
                              Quantity
                            </th>
                            <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">
                              Cost Basis
                            </th>
                            <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">
                              Current Value
                            </th>
                            <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">
                              Gain / Loss
                            </th>
                            <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-center">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-mono">
                          {grp.holdings.map((h) => {
                            const totalCostCents = Math.round(h.quantity * h.unitCostCents);
                            const gainLossCents = h.currentValueCents - totalCostCents;
                            const isGain = gainLossCents >= 0;
                            const returnPct =
                              totalCostCents > 0 ? (gainLossCents / totalCostCents) * 100 : 0;

                            const costBasisFormatted = (totalCostCents / 100).toLocaleString(
                              'en-IN',
                              {
                                style: 'currency',
                                currency: h.currency || 'INR',
                              }
                            );
                            const currentValueFormatted = (
                              h.currentValueCents / 100
                            ).toLocaleString('en-IN', {
                              style: 'currency',
                              currency: h.currency || 'INR',
                            });
                            const gainLossFormatted = (
                              Math.abs(gainLossCents) / 100
                            ).toLocaleString('en-IN', {
                              style: 'currency',
                              currency: h.currency || 'INR',
                            });

                            return (
                              <tr
                                key={h.holdingId}
                                className="hover:bg-secondary/20 transition-colors"
                              >
                                <td className="py-3 px-4 font-sans">
                                  <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                                    {h.name}
                                    {h.ticker && (
                                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary/80 border border-border text-primary font-bold">
                                        {h.ticker}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right text-foreground">
                                  {h.quantity.toLocaleString('en-IN', { maximumFractionDigits: 6 })}
                                </td>
                                <td className="py-3 px-4 text-right text-muted-foreground">
                                  <div>{costBasisFormatted}</div>
                                  <div className="text-[10px] text-muted-foreground/80">
                                    ₹
                                    {(h.unitCostCents / 100).toLocaleString('en-IN', {
                                      minimumFractionDigits: 2,
                                    })}
                                    /u
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-foreground">
                                  {currentValueFormatted}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span
                                    className={
                                      isGain
                                        ? 'text-emerald-400 font-semibold'
                                        : 'text-rose-400 font-semibold'
                                    }
                                  >
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
                                <td className="py-3 px-4 text-center">
                                  <button
                                    disabled={deletingId === h.holdingId}
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Delete holding "${h.name}" from your portfolio?`
                                        )
                                      ) {
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
                        <tfoot>
                          <tr className="border-t-2 border-border/70 bg-secondary/25 font-mono text-xs font-semibold">
                            <td className="py-2.5 px-4 text-foreground font-sans">
                              Subtotal ({grp.meta.name})
                            </td>
                            <td className="py-2.5 px-4 text-right text-muted-foreground">
                              {grp.holdings
                                .reduce((sum, item) => sum + item.quantity, 0)
                                .toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-4 text-right text-muted-foreground">
                              {grpCostFormatted}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-foreground">
                              {grpValueFormatted}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <span className={isGrpGain ? 'text-emerald-400' : 'text-rose-400'}>
                                {isGrpGain ? '+' : '-'}
                                {grpGainLossFormatted}
                              </span>
                            </td>
                            <td className="py-2.5 px-4"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* VIEW 4: Consolidated All Investments View */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-y border-border/80 bg-secondary/20 text-muted-foreground">
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">
                      Asset / Ticker
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">Class</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                      Quantity
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                      Cost Basis
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                      Current Value
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                      Gain / Loss
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-center">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 font-mono">
                  {filteredHoldings.map((h) => {
                    const totalCostCents = Math.round(h.quantity * h.unitCostCents);
                    const gainLossCents = h.currentValueCents - totalCostCents;
                    const isGain = gainLossCents >= 0;
                    const returnPct =
                      totalCostCents > 0 ? (gainLossCents / totalCostCents) * 100 : 0;

                    const costBasisFormatted = (totalCostCents / 100).toLocaleString('en-IN', {
                      style: 'currency',
                      currency: h.currency || 'INR',
                    });
                    const currentValueFormatted = (h.currentValueCents / 100).toLocaleString(
                      'en-IN',
                      {
                        style: 'currency',
                        currency: h.currency || 'INR',
                      }
                    );
                    const gainLossFormatted = (Math.abs(gainLossCents) / 100).toLocaleString(
                      'en-IN',
                      {
                        style: 'currency',
                        currency: h.currency || 'INR',
                      }
                    );

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
                          {h.folioNumber && (
                            <div className="font-mono text-[10px] text-cyan-400 mt-0.5">
                              Folio: {h.folioNumber} {h.schemePlan ? `• ${h.schemePlan}` : ''}
                            </div>
                          )}
                          {(() => {
                            const mem = members.find((m) => m.id === (h.memberId || 'mem-self'));
                            const acc = accounts.find((a) => a.id === h.accountId);
                            return (
                              <div className="flex items-center gap-1.5 mt-1 font-sans">
                                {mem && (
                                  <span
                                    className="text-[10px] px-1.5 py-0.2 rounded font-medium flex items-center gap-1"
                                    style={{
                                      backgroundColor: `${mem.colorHex}22`,
                                      border: `1px solid ${mem.colorHex}55`,
                                      color: mem.colorHex,
                                    }}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: mem.colorHex }} />
                                    {mem.name.split(' ')[0]} {mem.relationship === 'huf' ? 'HUF' : ''}
                                  </span>
                                )}
                                {acc && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground font-mono border border-border">
                                    {acc.brokerName}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
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
                          {(h.costBasisVerified ?? true) ? (
                            <>
                              <div>{costBasisFormatted}</div>
                              <div className="text-[10px] text-muted-foreground/80">
                                ₹
                                {(h.unitCostCents / 100).toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                })}
                                /u
                              </div>
                            </>
                          ) : (
                            <div>
                              <span>—</span>
                              <div className="text-[10px] text-amber-400">Unverified in CAS</div>
                            </div>
                          )}
                        </td>

                        {/* Current Value / CMP */}
                        <td className="py-3.5 px-4 text-right font-bold text-foreground">
                          <div>{currentValueFormatted}</div>
                          {(() => {
                            const q =
                              (h.isin && liveQuotesMap.get(h.isin)) ||
                              (h.ticker && liveQuotesMap.get(h.ticker)) ||
                              liveQuotesMap.get(h.holdingId);
                            if (!q) return null;
                            const isStock = q.source === 'NSE' || q.source === 'BSE';
                            const isUp = q.changePercent >= 0;
                            return (
                              <div className="flex items-center justify-end gap-1 text-[10px] mt-0.5 font-normal">
                                <span className="text-muted-foreground font-mono">
                                  {isStock ? 'CMP: ' : 'NAV: '}₹
                                  {(q.priceCents / 100).toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                                <span
                                  className={`px-1 py-0.2 rounded font-semibold text-[9px] ${
                                    isUp
                                      ? 'text-emerald-400 bg-emerald-500/10'
                                      : 'text-rose-400 bg-rose-500/10'
                                  }`}
                                >
                                  {isUp ? '+' : ''}
                                  {q.changePercent.toFixed(2)}%
                                </span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Gain / Loss */}
                        <td className="py-3.5 px-4 text-right">
                          {(h.costBasisVerified ?? true) ? (
                            <>
                              <span
                                className={
                                  isGain
                                    ? 'text-emerald-400 font-semibold'
                                    : 'text-rose-400 font-semibold'
                                }
                              >
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
                            </>
                          ) : (
                            <span className="text-muted-foreground text-[11px] italic">
                              Pending txn history
                            </span>
                          )}
                        </td>

                        {/* Delete Action */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            disabled={deletingId === h.holdingId}
                            onClick={() => {
                              if (
                                window.confirm(`Delete holding "${h.name}" from your portfolio?`)
                              ) {
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

      {/* CAS PDF Importer Modal */}
      <ImportCasModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(importedItems, memberId, accountId) => {
          if (user) {
            queryClient.invalidateQueries({ queryKey: ['portfolio-summary', user.id] });
          } else if (importedItems && importedItems.length > 0) {
            const chosenMemberId =
              memberId || (selectedMemberId !== 'all' ? selectedMemberId : 'mem-self');
            const chosenAccountId =
              accountId || (selectedAccountId !== 'all' ? selectedAccountId : undefined);
            const newHoldings: HoldingDetailDto[] = importedItems.map((item, idx) => ({
              holdingId: `demo-imported-${idx}-${Date.now()}`,
              assetId: `asset-imported-${idx}`,
              name: item.name,
              ticker: item.ticker,
              isin: item.isin,
              dematAccountId: item.dematAccountId || chosenAccountId,
              folioNumber: item.folioNumber,
              amcName: item.amcName,
              schemePlan: item.schemePlan,
              costBasisVerified: item.costBasisVerified,
              assetClassId: item.assetClassId,
              assetClassName:
                item.assetClassId === 'mutual_fund'
                  ? 'Mutual Funds'
                  : ASSET_CLASS_META_MAP[item.assetClassId]?.name || 'Equities & Stocks',
              assetClassColor: ASSET_CLASS_META_MAP[item.assetClassId]?.color || '#3b82f6',
              quantity: item.quantity,
              unitCostCents: item.unitCostCents,
              currentValueCents: item.currentValueCents,
              currency: 'INR',
              updatedAt: new Date().toISOString(),
              memberId: chosenMemberId,
              accountId: chosenAccountId,
            }));
            setLocalDemoHoldings((prev) => [...newHoldings, ...prev]);
          }
        }}
      />

      {/* Phase 6A: Manage Family Entities & Demat Accounts Modal */}
      <ManageFamilyModal
        isOpen={isManageFamilyOpen}
        onClose={() => setIsManageFamilyOpen(false)}
      />
    </div>
  );
}
