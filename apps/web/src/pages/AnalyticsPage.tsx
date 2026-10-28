import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/supabase/auth-context';
import { useRepositories } from '@/lib/persistence/repository-context';
import {
  HoldingDetailDto,
  TransactionDetailDto,
} from '@wealthnest/application';
import {
  CurrencyCode,
  Money,
  AllocationModelType,
  calculatePortfolioAnalytics,
  AnalyticsInputHolding,
  AnalyticsInputTransaction,
  PortfolioAnalyticsSummary,
  calculateCapitalGainsTaxSummary,
  PortfolioTaxSummary,
  RawHoldingTaxInput,
} from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  TrendingUp,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Scale,
  Award,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  SlidersHorizontal,
  Coins,
  Scissors,
  Receipt,
  Users,
} from 'lucide-react';
import { useFamily } from '@/lib/family/family-context';
import { FamilyFilterBar } from '@/components/family/FamilyFilterBar';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';

// Demo initial positions tailored for Indian investors (matches Portfolio demo)
const DEMO_HOLDINGS: HoldingDetailDto[] = [
  {
    holdingId: 'demo-1',
    assetId: 'asset-1',
    memberId: 'mem-self',
    accountId: 'acc-zerodha',
    name: 'Reliance Industries Ltd',
    ticker: 'RELIANCE',
    assetClassId: 'equity',
    assetClassName: 'Equities & Stocks',
    assetClassColor: '#3b82f6',
    quantity: 80,
    unitCostCents: 250000, // ₹2,500.00
    currentValueCents: 23600000, // ₹2,36,000.00 (+₹36,000)
    currency: 'INR',
    updatedAt: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(),
  },
  {
    holdingId: 'demo-2',
    assetId: 'asset-2',
    memberId: 'mem-spouse',
    accountId: 'acc-groww',
    name: 'Parag Parikh Flexi Cap Fund',
    ticker: 'PPFAS-FLEXI',
    assetClassId: 'equity',
    assetClassName: 'Equities & Mutual Funds',
    assetClassColor: '#06b6d4',
    quantity: 1500,
    unitCostCents: 5500, // ₹55.00
    currentValueCents: 11000000, // ₹1,10,000.00 (+₹27,500)
    currency: 'INR',
    updatedAt: new Date(Date.now() - 300 * 24 * 3600 * 1000).toISOString(),
  },
  {
    holdingId: 'demo-3',
    assetId: 'asset-3',
    memberId: 'mem-huf',
    accountId: 'acc-icici',
    name: 'Tata Consultancy Services',
    ticker: 'TCS',
    assetClassId: 'equity',
    assetClassName: 'Equities & Stocks',
    assetClassColor: '#3b82f6',
    quantity: 40,
    unitCostCents: 360000, // ₹3,600.00
    currentValueCents: 16600000, // ₹1,66,000.00 (+₹22,000)
    currency: 'INR',
    updatedAt: new Date(Date.now() - 250 * 24 * 3600 * 1000).toISOString(),
  },
  {
    holdingId: 'demo-4',
    assetId: 'asset-4',
    memberId: 'mem-self',
    accountId: 'acc-zerodha',
    name: 'Sovereign Gold Bond 2028',
    ticker: 'SGB2028',
    assetClassId: 'commodity',
    assetClassName: 'Gold & Precious Metals',
    assetClassColor: '#eab308',
    quantity: 20,
    unitCostCents: 520000, // ₹5,200.00
    currentValueCents: 13200000, // ₹1,32,000.00 (+₹28,000)
    currency: 'INR',
    updatedAt: new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString(),
  },
  {
    holdingId: 'demo-5',
    assetId: 'asset-5',
    memberId: 'mem-child',
    accountId: 'acc-cams',
    name: 'HDFC Corporate Bond Fund',
    ticker: 'HDFCBOND',
    assetClassId: 'fixed_income',
    assetClassName: 'Fixed Income & Debt',
    assetClassColor: '#8b5cf6',
    quantity: 5000,
    unitCostCents: 2400, // ₹24.00
    currentValueCents: 13800000, // ₹1,38,000.00 (+₹18,000)
    currency: 'INR',
    updatedAt: new Date(Date.now() - 200 * 24 * 3600 * 1000).toISOString(),
  },
  {
    holdingId: 'demo-6',
    assetId: 'asset-6',
    memberId: 'mem-self',
    accountId: 'acc-sbi-ppf',
    name: 'ICICI Emergency Liquid Fund',
    ticker: 'ICICILIQ',
    assetClassId: 'cash',
    assetClassName: 'Cash & Liquid Savings',
    assetClassColor: '#10b981',
    quantity: 500,
    unitCostCents: 10000, // ₹100.00
    currentValueCents: 5400000, // ₹54,000.00 (+₹4,000)
    currency: 'INR',
    updatedAt: new Date(Date.now() - 150 * 24 * 3600 * 1000).toISOString(),
  },
];

const DEMO_TRANSACTIONS: TransactionDetailDto[] = [
  {
    id: 'demo-tx-1',
    userId: 'demo-user',
    memberId: 'mem-self',
    accountId: 'acc-zerodha',
    type: 'deposit',
    amountCents: 50000000, // ₹5,00,000
    currency: 'INR',
    transactionDate: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-tx-2',
    userId: 'demo-user',
    memberId: 'mem-spouse',
    accountId: 'acc-groww',
    type: 'deposit',
    amountCents: 20000000, // ₹2,00,000
    currency: 'INR',
    transactionDate: new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-tx-3',
    userId: 'demo-user',
    memberId: 'mem-huf',
    accountId: 'acc-icici',
    type: 'dividend',
    amountCents: 1250000, // ₹12,500
    currency: 'INR',
    transactionDate: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

export function AnalyticsPage() {
  const { user } = useAuth();
  const userId = user?.id || '';
  const { selectedMemberId, selectedAccountId, members, activeMember } = useFamily();
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);
  const { holdingRepo, transactionRepo } = useRepositories();

  // Allocation strategy model state
  const [modelType, setModelType] = useState<AllocationModelType>('balanced');
  // Trajectory timeframe filter
  const [timeframe, setTimeframe] = useState<'1M' | '6M' | '1Y' | 'ALL'>('1Y');
  // Hovered trajectory point index
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // 1. Query holdings (Supabase or demo fallback)
  const { data: rawHoldings = [] } = useQuery<HoldingDetailDto[]>({
    queryKey: ['portfolio-holdings', userId],
    queryFn: async () => {
      if (!userId) return DEMO_HOLDINGS;
      const res = await holdingRepo.listDetailsByUser(userId);
      if (!res.success || res.value.length === 0) return DEMO_HOLDINGS;
      return res.value;
    },
    enabled: true,
  });

  // Filter holdings based on selected family member and demat account
  const holdings = useMemo(() => {
    return rawHoldings.filter((h) => {
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
  }, [rawHoldings, selectedMemberId, selectedAccountId]);

  // 2. Query transactions
  const { data: rawTransactions = [] } = useQuery<TransactionDetailDto[]>({
    queryKey: ['transactions-list', userId],
    queryFn: async () => {
      if (!userId) return DEMO_TRANSACTIONS;
      const res = await transactionRepo.listByUser(userId);
      if (!res.success || res.value.length === 0) return DEMO_TRANSACTIONS;
      return res.value;
    },
    enabled: true,
  });

  // Filter transactions based on selected family member and demat account
  const transactions = useMemo(() => {
    return rawTransactions.filter((t) => {
      if (selectedMemberId !== 'all') {
        const belongs =
          t.memberId === selectedMemberId || (!t.memberId && selectedMemberId === 'mem-self');
        if (!belongs) return false;
      }
      if (selectedAccountId !== 'all') {
        if (t.accountId !== selectedAccountId) return false;
      }
      return true;
    });
  }, [rawTransactions, selectedMemberId, selectedAccountId]);

  // 3. Compute pure domain analytics
  const analytics: PortfolioAnalyticsSummary = useMemo(() => {
    const domainHoldings: AnalyticsInputHolding[] = holdings.map((h) => {
      const hCurrency = (h.currency as CurrencyCode) || 'INR';
      const totalCostCents = BigInt(Math.round(h.quantity * h.unitCostCents));
      const totalValCents = BigInt(Math.round(h.currentValueCents));
      return {
        holdingId: h.holdingId,
        name: h.name,
        ticker: h.ticker,
        assetClassId: h.assetClassId,
        assetClassName: h.assetClassName,
        colorHex: h.assetClassColor,
        costBasis: Money.fromCents(totalCostCents, hCurrency),
        currentValue: Money.fromCents(totalValCents, hCurrency),
        acquisitionDate: h.updatedAt,
      };
    });

    const domainTransactions: AnalyticsInputTransaction[] = transactions.map((t) => ({
      date: t.transactionDate,
      type: t.type as 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'dividend',
      amountCents: BigInt(Math.round(t.amountCents)),
      currency: t.currency,
    }));

    return calculatePortfolioAnalytics(domainHoldings, domainTransactions, 'INR', modelType);
  }, [holdings, transactions, modelType]);

  const taxSummary: PortfolioTaxSummary = useMemo(() => {
    const rawInputs: RawHoldingTaxInput[] = holdings.map((h) => ({
      holdingId: h.holdingId,
      name: h.name,
      assetClassId: h.assetClassId,
      isin: h.isin,
      quantity: h.quantity,
      unitCostCents: h.unitCostCents,
      currentValueCents: h.currentValueCents,
      purchaseDate: h.updatedAt ? h.updatedAt.slice(0, 10) : undefined,
    }));
    return calculateCapitalGainsTaxSummary(rawInputs);
  }, [holdings]);

  const xirrDisplay = analytics.xirr !== null ? `${(analytics.xirr * 100).toFixed(2)}%` : 'N/A';
  const cagrDisplay = `${(analytics.cagr * 100).toFixed(2)}%`;
  const alphaDisplay = `${analytics.alphaVsNifty >= 0 ? '+' : ''}${(analytics.alphaVsNifty * 100).toFixed(2)}%`;

  // Filter trajectory points based on timeframe
  const filteredTrajectory = useMemo(() => {
    const pts = analytics.trajectory;
    if (timeframe === '1M') return pts.slice(-2);
    if (timeframe === '6M') return pts.slice(-6);
    if (timeframe === '1Y') return pts.slice(-12);
    return pts;
  }, [analytics.trajectory, timeframe]);

  // SVG Chart Dimensions & Scaling
  const chartHeight = 240;
  const chartWidth = 720;
  const paddingX = 40;
  const paddingY = 25;

  const maxValCents = useMemo(() => {
    let max = 0n;
    for (const pt of filteredTrajectory) {
      if (pt.portfolioValueCents > max) max = pt.portfolioValueCents;
      if (pt.benchmarkValueCents > max) max = pt.benchmarkValueCents;
      if (pt.investedAmountCents > max) max = pt.investedAmountCents;
    }
    return max > 0n ? max : 100000000n;
  }, [filteredTrajectory]);

  // Generate SVG coordinate points
  const points = useMemo(() => {
    const count = filteredTrajectory.length;
    if (count < 2) return [];

    return filteredTrajectory.map((pt, i) => {
      const x = paddingX + (i / (count - 1)) * (chartWidth - paddingX * 2);
      const yVal = chartHeight - paddingY - (Number(pt.portfolioValueCents) / Number(maxValCents)) * (chartHeight - paddingY * 2);
      const yInv = chartHeight - paddingY - (Number(pt.investedAmountCents) / Number(maxValCents)) * (chartHeight - paddingY * 2);
      const yBench = chartHeight - paddingY - (Number(pt.benchmarkValueCents) / Number(maxValCents)) * (chartHeight - paddingY * 2);

      return {
        x,
        yVal,
        yInv,
        yBench,
        date: pt.date,
        val: Money.fromCents(pt.portfolioValueCents, 'INR'),
        inv: Money.fromCents(pt.investedAmountCents, 'INR'),
        bench: Money.fromCents(pt.benchmarkValueCents, 'INR'),
      };
    });
  }, [filteredTrajectory, maxValCents]);

  const valuePath = useMemo(() => {
    if (points.length < 2) return '';
    return points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yVal.toFixed(1)}`, '');
  }, [points]);

  const valueAreaPath = useMemo(() => {
    if (points.length < 2) return '';
    const first = points[0]!;
    const last = points[points.length - 1]!;
    const baseline = chartHeight - paddingY;
    return `${valuePath} L ${last.x.toFixed(1)} ${baseline} L ${first.x.toFixed(1)} ${baseline} Z`;
  }, [valuePath, points]);

  const investedPath = useMemo(() => {
    if (points.length < 2) return '';
    return points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yInv.toFixed(1)}`, '');
  }, [points]);

  const activePoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : points[points.length - 1];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Phase 4: Wealth & Performance Analytics
            </span>
            <Badge variant="outline" className="text-[11px] font-mono border-border/80">
              India First (₹ INR)
            </Badge>
            {selectedMemberId !== 'all' && activeMember ? (
              <Badge
                variant="secondary"
                className="text-[11px] font-medium flex items-center gap-1 border"
                style={{
                  backgroundColor: `${activeMember.colorHex}22`,
                  borderColor: `${activeMember.colorHex}55`,
                  color: activeMember.colorHex,
                }}
              >
                <Users className="w-3 h-3" />
                {activeMember.name} ({activeMember.relationship.toUpperCase()})
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[11px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                <Users className="w-3 h-3 mr-1 inline" />
                Combined Family Portfolio ({members.length} Entities)
              </Badge>
            )}
            {userId && (
              <Badge variant="secondary" className="text-[11px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                <Database className="w-3 h-3 mr-1 inline" />
                Live PostgreSQL Data
              </Badge>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Performance & Wealth Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Institutional return engine (XIRR, CAGR), benchmark alpha, and strategic asset allocation drift.
          </p>
        </div>

        {/* Model Strategy Pills */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-card border border-border">
          {(['balanced', 'aggressive', 'conservative'] as AllocationModelType[]).map((type) => (
            <button
              key={type}
              onClick={() => setModelType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                modelType === type
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
              }`}
            >
              {type === 'aggressive' ? 'Aggressive (75/15)' : type === 'conservative' ? 'Conservative (30/50)' : 'Balanced (55/30)'}
            </button>
          ))}
        </div>
      </div>

      {/* Phase 6A: Multi-Entity Family & Demat Filter Bar */}
      <FamilyFilterBar onOpenManageModal={() => setIsManageFamilyOpen(true)} />

      {/* Top 4 Performance KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: XIRR */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Portfolio XIRR</span>
              <Award className="w-4 h-4 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-emerald-400 font-mono">
                {analytics.xirr !== null && analytics.xirr >= 0 ? `+${xirrDisplay}` : xirrDisplay}
              </span>
              <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                Annualized
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span>{analytics.isOutperforming ? 'Outperforming' : 'Tracking'} Nifty 50 by</span>
              <span className={`font-semibold font-mono ${analytics.isOutperforming ? 'text-emerald-400' : 'text-amber-400'}`}>
                {alphaDisplay} Alpha
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Absolute Gain & CAGR */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Return & CAGR</span>
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
                +{analytics.returnPercentage.toFixed(2)}%
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                (CAGR {cagrDisplay})
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
              <span className="text-emerald-400 font-semibold">
                +{analytics.absoluteGain.formatIndianCompact()}
              </span>
              <span>net capital gain</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Alpha vs Nifty 50 TRI */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Benchmark Alpha</span>
              <Scale className="w-4 h-4 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold tracking-tight font-mono ${
                analytics.isOutperforming ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {alphaDisplay}
              </span>
              <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-500/30">
                vs Nifty 50 TRI
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Nifty 50 5Y CAGR: <span className="font-semibold text-foreground font-mono">14.20%</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Diversification Score */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Diversification Score</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {analytics.concentration.diversificationScore}
              </span>
              <span className="text-xs text-muted-foreground">/ 100</span>
              <Badge
                variant="outline"
                className={`text-[10px] uppercase font-bold ${
                  analytics.concentration.riskLevel === 'low'
                    ? 'text-emerald-400 border-emerald-500/30'
                    : analytics.concentration.riskLevel === 'moderate'
                    ? 'text-amber-400 border-amber-500/30'
                    : 'text-rose-400 border-rose-500/30'
                }`}
              >
                {analytics.concentration.riskLevel} Risk
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              Top Asset: <span className="font-semibold text-foreground">{analytics.concentration.topAssetName}</span> ({analytics.concentration.topAssetWeight.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trajectory Growth Area Chart */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Portfolio Trajectory & Capital Growth Timeline
              </CardTitle>
              <CardDescription className="text-xs">
                Monthly progression comparing Current Portfolio Valuation, Cost Basis (Capital Invested), and Benchmark.
              </CardDescription>
            </div>

            {/* Timeframe selector */}
            <div className="flex items-center gap-1 p-1 bg-accent/40 rounded-lg border border-border/80">
              {(['1M', '6M', '1Y', 'ALL'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    timeframe === tf
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Active tooltip KPI bar */}
          {activePoint && (
            <div className="mt-4 p-3 rounded-xl bg-accent/30 border border-border/70 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Snapshot Date:</span>
                <span className="font-bold text-foreground">{activePoint.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-muted-foreground">Portfolio Value:</span>
                <span className="font-bold text-emerald-400">{activePoint.val.formatIndianCompact()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span className="text-muted-foreground">Invested Capital:</span>
                <span className="font-bold text-foreground">{activePoint.inv.formatIndianCompact()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span className="text-muted-foreground">Benchmark (Nifty):</span>
                <span className="font-bold text-blue-400">{activePoint.bench.formatIndianCompact()}</span>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          <div className="w-full overflow-x-auto">
            <svg
              data-testid="analytics-trajectory-svg"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full max-w-full h-auto select-none"
            >
              <defs>
                <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {[0.25, 0.5, 0.75].map((pct) => {
                const y = chartHeight - paddingY - pct * (chartHeight - paddingY * 2);
                return (
                  <line
                    key={pct}
                    x1={paddingX}
                    y1={y}
                    x2={chartWidth - paddingX}
                    y2={y}
                    stroke="currentColor"
                    className="text-border/40"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Area fill for Portfolio Value */}
              {valueAreaPath && <path d={valueAreaPath} fill="url(#valGrad)" />}

              {/* Invested amount line (Dashed Slate) */}
              {investedPath && (
                <path
                  d={investedPath}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                />
              )}

              {/* Portfolio Value line (Solid Emerald) */}
              {valuePath && (
                <path
                  d={valuePath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points */}
              {points.map((p, idx) => (
                <g key={idx} onMouseEnter={() => setHoveredIndex(idx)} className="cursor-pointer">
                  {/* Invisible hit area */}
                  <circle cx={p.x} cy={p.yVal} r="14" fill="transparent" />
                  {/* Visible point */}
                  <circle
                    cx={p.x}
                    cy={p.yVal}
                    r={hoveredIndex === idx ? '6' : '4'}
                    className={`transition-all ${
                      hoveredIndex === idx ? 'fill-emerald-300 stroke-background stroke-2' : 'fill-emerald-400'
                    }`}
                  />
                </g>
              ))}
            </svg>
          </div>

          {/* Chart Legend */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-4 text-xs font-medium text-muted-foreground border-t border-border/60 pt-3">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1 rounded-full bg-emerald-400" />
              <span>WealthNest Portfolio Valuation (CMP)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1 rounded-full border-t border-dashed border-slate-400" />
              <span>Cumulative Cost Basis (Capital Inflows)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1 rounded-full bg-blue-400" />
              <span>Nifty 50 TRI Synthetic Benchmark</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid: Benchmark Comparison & Asset Rebalancing Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Indian Benchmarks Comparison */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Scale className="w-5 h-5 text-purple-400" />
                Indian Market Benchmarks & Alpha
              </CardTitle>
              <Badge variant="outline" className="text-xs font-mono">
                5-Year Annualized
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Comparison against standard Indian equity, sovereign gold, and debt benchmarks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {/* WealthNest Portfolio Bar */}
            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-foreground flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-primary" />
                  Your WealthNest Portfolio
                </span>
                <span className="font-mono text-emerald-400 text-sm font-bold">
                  {xirrDisplay}
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-400 h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(10, (analytics.xirr || 0.15) * 400))}%` }}
                />
              </div>
            </div>

            {/* Standard Benchmarks */}
            <div className="space-y-2.5">
              {analytics.benchmarks.map((bm) => {
                const bmReturnPct = (bm.annualizedReturn * 100).toFixed(1);
                const diff = (analytics.xirr || 0.15) - bm.annualizedReturn;
                const outperforming = diff >= 0;

                return (
                  <div key={bm.id} className="p-3 rounded-lg bg-accent/20 border border-border/60 hover:bg-accent/40 transition-all space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-foreground">{bm.name}</span>
                        <span className="text-[11px] text-muted-foreground ml-2">({bm.category})</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-foreground">{bmReturnPct}%</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            outperforming
                              ? 'text-emerald-400 border-emerald-500/30'
                              : 'text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {outperforming ? '+' : ''}{(diff * 100).toFixed(1)}% Alpha
                        </Badge>
                      </div>
                    </div>
                    <div className="w-full bg-secondary/80 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-400/80 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, bm.annualizedReturn * 400)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right: Asset Allocation Drift & Rebalancing Radar */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
                Asset Allocation Drift & Rebalancing
              </CardTitle>
              <Badge variant="outline" className="text-xs capitalize font-medium">
                {modelType} Model
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Deviations from your target strategy with calculated rebalancing buy/sell amounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.drifts.map((drift) => {
              const isOver = drift.driftPercentage > 0;
              const isBalanced = Math.abs(drift.driftPercentage) < 1.0;

              return (
                <div key={drift.assetClassId} className="p-3 rounded-lg bg-accent/20 border border-border/60 hover:bg-accent/40 transition-all space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: drift.colorHex }} />
                      <span className="font-semibold text-foreground">{drift.name}</span>
                    </div>

                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-muted-foreground">
                        {drift.currentPercentage.toFixed(1)}% / {drift.targetPercentage}%
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          isBalanced
                            ? 'text-slate-400 border-slate-500/30'
                            : isOver
                            ? 'text-amber-400 border-amber-500/30'
                            : 'text-blue-400 border-blue-500/30'
                        }`}
                      >
                        {isBalanced
                          ? 'Balanced'
                          : `${isOver ? '+' : ''}${drift.driftPercentage.toFixed(1)}% Drift`}
                      </Badge>
                    </div>
                  </div>

                  {/* Rebalance recommendation action */}
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">
                      Current Value: <span className="font-mono text-foreground">{drift.currentValue.formatIndianCompact()}</span>
                    </span>
                    {isBalanced ? (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Optimal Allocation
                      </span>
                    ) : drift.rebalanceAction === 'buy' ? (
                      <span className="text-blue-400 font-medium flex items-center gap-1">
                        <ArrowUpRight className="w-3.5 h-3.5" /> Buy +{drift.rebalanceAmount.formatIndianCompact()}
                      </span>
                    ) : (
                      <span className="text-amber-400 font-medium flex items-center gap-1">
                        <ArrowDownRight className="w-3.5 h-3.5" /> Trim -{drift.rebalanceAmount.formatIndianCompact()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Union Budget 2024 Tax Intelligence & Loss Harvesting */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                  Budget 2024 Rules Enforced
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  {taxSummary.fiscalYear} • Period Ending Mar 31
                </span>
              </div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-400" />
                Capital Gains Tax & Loss Harvesting Intelligence
              </CardTitle>
              <CardDescription className="text-xs">
                Indian Section 112A Equity LTCG (12.5% over ₹1.25L exemption), Section 111A STCG (20%), and actionable tax loss offsets.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 4 Tax Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl bg-accent/30 border border-border/60 space-y-1">
              <span className="text-xs text-muted-foreground">
                {activeMember?.relationship === 'huf' ? 'HUF Section 112A Exemption' : 'Section 112A LTCG Exemption'}
              </span>
              <div className="text-lg font-bold font-mono text-emerald-400">
                {taxSummary.annualLtcgExemption.formatIndianCompact()}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {activeMember?.relationship === 'huf'
                  ? 'Independent HUF PAN exemption'
                  : 'Tax-free headroom per financial year'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-accent/30 border border-border/60 space-y-1">
              <span className="text-xs text-muted-foreground">Taxable LTCG (&gt;1 Year @ 12.5%)</span>
              <div className="text-lg font-bold font-mono text-foreground">
                {taxSummary.taxableLtcg.formatIndianCompact()}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Estimated Tax: {taxSummary.estimatedLtcgTax.formatIndianCompact()}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-accent/30 border border-border/60 space-y-1">
              <span className="text-xs text-muted-foreground">Taxable STCG (&le;1 Year @ 20%)</span>
              <div className="text-lg font-bold font-mono text-foreground">
                {taxSummary.netStcg.formatIndianCompact()}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Estimated Tax: {taxSummary.estimatedStcgTax.formatIndianCompact()}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <Scissors className="w-3.5 h-3.5" />
                Loss Harvesting Savings
              </span>
              <div className="text-lg font-bold font-mono text-emerald-400">
                {taxSummary.potentialTaxSavings.formatIndianCompact()}
              </div>
              <p className="text-[11px] text-emerald-300">
                From {taxSummary.harvestableLossPotential.formatIndianCompact()} in bookable losses
              </p>
            </div>
          </div>

          {/* Tax-loss harvesting action list if opportunities exist */}
          {taxSummary.holdings.some((h) => !h.isGain) && (
            <div className="p-4 rounded-xl bg-accent/20 border border-border/60 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-foreground flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  Tax Loss Harvesting Opportunities (Actionable Before March 31)
                </span>
                <span className="text-emerald-400 font-mono">
                  Offset against STCG / LTCG
                </span>
              </div>
              <div className="space-y-2">
                {taxSummary.holdings
                  .filter((h) => !h.isGain)
                  .map((h) => (
                    <div
                      key={h.holdingId}
                      className="p-3 rounded-lg bg-card/60 border border-border/60 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-foreground">{h.assetName}</span>
                        <span className="text-muted-foreground ml-2">
                          ({h.term === 'short_term' ? 'STCG Loss' : 'LTCG Loss'} • {h.holdingPeriodDays} days held)
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-rose-400 font-bold">
                          -{h.harvestableLoss.formatIndianCompact()}
                        </span>
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/20 bg-emerald-500/10 text-[10px]">
                          Save ~₹{(Number(h.harvestableLoss.cents) * (h.term === 'short_term' ? 0.20 : 0.125) / 100).toFixed(0)}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Concentration Risk Alert & Guidance */}
      {analytics.concentration.warning && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground">
              Institutional Concentration Advisory
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {analytics.concentration.warning} Consider diversifying into debt or index funds to smooth out drawdowns.
            </p>
          </div>
        </div>
      )}

      {/* Phase 6A: Manage Family Entities & Demat Accounts Modal */}
      <ManageFamilyModal
        isOpen={isManageFamilyOpen}
        onClose={() => setIsManageFamilyOpen(false)}
      />
    </div>
  );
}
export default AnalyticsPage;
