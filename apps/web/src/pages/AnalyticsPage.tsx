import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/supabase/auth-context';
import { useRepositories } from '@/lib/persistence/repository-context';
import { HoldingDetailDto, TransactionDetailDto } from '@wealthnest/application';
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
  calculateSection112aHarvestingPlan,
  Section112aHarvestingPlan,
  RawHarvestInputHolding,
} from '@wealthnest/domain';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CasReconciliationCard } from '@/components/analytics/CasReconciliationCard';
import { AnalyticsTrajectoryChartCard } from '@/components/analytics/AnalyticsTrajectoryChartCard';
import { BenchmarkAndRebalanceSection } from '@/components/analytics/BenchmarkAndRebalanceSection';
import { TaxHarvestingIntelligenceCard } from '@/components/analytics/TaxHarvestingIntelligenceCard';
import {
  TrendingUp,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Scale,
  Award,
  Database,
  Users,
} from 'lucide-react';
import { useFamily } from '@/lib/family/family-context';
import { usePreferences } from '@/lib/preferences/preferences-context';
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
    updatedAt: new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString(),
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
  const { currencySymbol, preferences } = usePreferences();
  const locale = preferences.numberFormat || 'en-IN';
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);
  const { holdingRepo, transactionRepo } = useRepositories();

  // Allocation strategy model state
  const [modelType, setModelType] = useState<AllocationModelType>('balanced');

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

  // Section 112A Multi-Entity Tax Harvesting Plan
  const harvestingPlan: Section112aHarvestingPlan = useMemo(() => {
    const rawHarvestInputs: RawHarvestInputHolding[] = holdings.map((h) => {
      const parentMem = members.find((m) => m.id === (h.memberId || 'mem-self'));
      const isHuf =
        parentMem?.relationship === 'huf' ||
        h.memberId === 'mem-huf' ||
        (parentMem?.name && parentMem.name.toLowerCase().includes('huf')) ||
        (h.name && h.name.toLowerCase().includes('huf'));
      const memberName =
        parentMem?.name ||
        (isHuf
          ? 'Shamalbhai Vaghela HUF'
          : h.memberId === 'mem-spouse'
            ? 'Parul Vaghela'
            : 'Ketan Vaghela');

      return {
        holdingId: h.holdingId,
        assetName: h.name,
        ticker: h.ticker,
        isin: h.isin,
        memberId: h.memberId || 'mem-self',
        memberName,
        isHuf: Boolean(isHuf),
        quantity: h.quantity,
        unitCostCents: h.unitCostCents,
        currentValueCents: h.currentValueCents,
        purchaseDate: h.updatedAt ? h.updatedAt.slice(0, 10) : undefined,
      };
    });
    return calculateSection112aHarvestingPlan(rawHarvestInputs);
  }, [holdings, members]);

  const xirrDisplay = analytics.xirr !== null ? `${(analytics.xirr * 100).toFixed(2)}%` : 'N/A';
  const cagrDisplay = `${(analytics.cagr * 100).toFixed(2)}%`;
  const alphaDisplay = `${analytics.alphaVsNifty >= 0 ? '+' : ''}${(analytics.alphaVsNifty * 100).toFixed(2)}%`;

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
              <Badge
                variant="secondary"
                className="text-[11px] bg-blue-500/10 text-blue-400 border-blue-500/20"
              >
                <Users className="w-3 h-3 mr-1 inline" />
                Combined Family Portfolio ({members.length} Entities)
              </Badge>
            )}
            {userId && (
              <Badge
                variant="secondary"
                className="text-[11px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              >
                <Database className="w-3 h-3 mr-1 inline" />
                Live PostgreSQL Data
              </Badge>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Performance & Wealth Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Institutional return engine (XIRR, CAGR), benchmark alpha, and strategic asset
            allocation drift.
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
              {type === 'aggressive'
                ? 'Aggressive (75/15)'
                : type === 'conservative'
                  ? 'Conservative (30/50)'
                  : 'Balanced (55/30)'}
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
              <Badge
                variant="outline"
                className="text-[10px] text-emerald-400 border-emerald-500/30"
              >
                Annualized
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span>{analytics.isOutperforming ? 'Outperforming' : 'Tracking'} Nifty 50 by</span>
              <span
                className={`font-semibold font-mono ${analytics.isOutperforming ? 'text-emerald-400' : 'text-amber-400'}`}
              >
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
              <span className="text-xs font-semibold uppercase tracking-wider">
                Total Return & CAGR
              </span>
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
                +{analytics.returnPercentage.toFixed(2)}%
              </span>
              <span className="text-xs text-muted-foreground font-mono">(CAGR {cagrDisplay})</span>
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
              <span className="text-xs font-semibold uppercase tracking-wider">
                Benchmark Alpha
              </span>
              <Scale className="w-4 h-4 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl font-extrabold tracking-tight font-mono ${
                  analytics.isOutperforming ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {alphaDisplay}
              </span>
              <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-500/30">
                vs Nifty 50 TRI
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Nifty 50 5Y CAGR:{' '}
              <span className="font-semibold text-foreground font-mono">14.20%</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Diversification Score */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Diversification Score
              </span>
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
              Top Asset:{' '}
              <span className="font-semibold text-foreground">
                {analytics.concentration.topAssetName}
              </span>{' '}
              ({analytics.concentration.topAssetWeight.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trajectory Growth Area Chart */}
      <AnalyticsTrajectoryChartCard trajectory={analytics.trajectory} />

      {/* Grid: Benchmark Comparison & Asset Rebalancing Radar */}
      <BenchmarkAndRebalanceSection
        analytics={analytics}
        xirrDisplay={xirrDisplay}
        modelType={modelType}
      />

      {/* Union Budget 2024 Tax Intelligence & Loss Harvesting */}
      <TaxHarvestingIntelligenceCard
        taxSummary={taxSummary}
        harvestingPlan={harvestingPlan}
        activeMemberRelationship={activeMember?.relationship}
        currencySymbol={currencySymbol}
        locale={locale}
      />

      {/* CAS <-> Broker Tradebook Auto-Reconciliation */}
      <CasReconciliationCard holdings={holdings} />

      {/* Concentration Risk Alert & Guidance */}
      {analytics.concentration.warning && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground">
              Institutional Concentration Advisory
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {analytics.concentration.warning} Consider diversifying into debt or index funds to
              smooth out drawdowns.
            </p>
          </div>
        </div>
      )}

      {/* Phase 6A: Manage Family Entities & Demat Accounts Modal */}
      <ManageFamilyModal isOpen={isManageFamilyOpen} onClose={() => setIsManageFamilyOpen(false)} />
    </div>
  );
}
export default AnalyticsPage;
