import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { useRepositories } from '@/lib/persistence/repository-context';
import { HoldingDetailDto, LiabilityDto, TransactionDetailDto } from '@wealthnest/application';
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
  filterRecordsByPrivacy,
} from '@wealthnest/domain';
import { AnalyticsKpiGrid } from '@/components/analytics/AnalyticsKpiGrid';
import { CasReconciliationCard } from '@/components/analytics/CasReconciliationCard';
import { AnalyticsTrajectoryChartCard } from '@/components/analytics/AnalyticsTrajectoryChartCard';
import { BenchmarkAndRebalanceSection } from '@/components/analytics/BenchmarkAndRebalanceSection';
import { TaxHarvestingIntelligenceCard } from '@/components/analytics/TaxHarvestingIntelligenceCard';
import { Card } from '@/components/ui/Card';
import { formatInr } from '@/utils/formatInr';
import { AlertTriangle, CheckCircle2, ChevronRight, Sparkles, TrendingUp } from 'lucide-react';
import { useFamily } from '@/lib/family/family-context';
import { shouldAllowDemoData } from '@/lib/config/mobile-runtime';
import { usePreferences } from '@/lib/preferences/preferences-context';
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
  const { activeHouseholdId } = useHousehold();
  const {
    selectedMemberId,
    setSelectedMemberId,
    selectedAccountId,
    setSelectedAccountId,
    members,
    accounts,
    activeMember,
    privacyRules,
  } = useFamily();
  const { currencySymbol, preferences, legalName } = usePreferences();
  const locale = preferences.numberFormat || 'en-IN';
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const { holdingRepo, transactionRepo, liabilityRepo, mode } = useRepositories();

  const isDemoMode = mode === 'supabase' && (!user?.id || user.id.startsWith('demo-'));
  const hasLiveBackend = !isDemoMode && Boolean(activeHouseholdId || user?.id);
  const scopeId = activeHouseholdId || user?.id || '';

  // Allocation strategy model state
  const [modelType, setModelType] = useState<AllocationModelType>('balanced');

  // 1. Query holdings (Household backend or demo fallback on web only)
  const { data: rawHoldings = [] } = useQuery<HoldingDetailDto[]>({
    queryKey: ['portfolio-holdings', hasLiveBackend ? scopeId : 'demo'],
    queryFn: async () => {
      if (!hasLiveBackend || !scopeId) {
        return shouldAllowDemoData(isDemoMode) ? DEMO_HOLDINGS : [];
      }
      const res = await (holdingRepo.listDetailsByHousehold
        ? holdingRepo.listDetailsByHousehold(scopeId)
        : holdingRepo.listDetailsByUser(scopeId));
      return res.success ? res.value : [];
    },
    enabled: true,
  });

  // Filter holdings based on selected family member, demat account & privacy rules
  const holdings = useMemo(() => {
    const memberAccountFiltered = rawHoldings.filter((h) => {
      if (selectedMemberId !== 'all') {
        const belongs =
          h.memberId === selectedMemberId ||
          h.owners?.some((o) => o.familyMemberId === selectedMemberId) ||
          (!h.memberId && !h.owners?.length && selectedMemberId === 'mem-self');
        if (!belongs) return false;
      }
      if (selectedAccountId !== 'all') {
        if (h.accountId !== selectedAccountId) return false;
      }
      if (selectedCategoryFilter !== 'all') {
        if (selectedCategoryFilter === 'equity') {
          if (h.assetClassId !== 'equity' && h.assetClassId !== 'mutual_fund') return false;
        } else if (h.assetClassId !== selectedCategoryFilter) {
          return false;
        }
      }
      return true;
    });
    return filterRecordsByPrivacy(memberAccountFiltered, selectedMemberId, privacyRules);
  }, [rawHoldings, selectedMemberId, selectedAccountId, selectedCategoryFilter, privacyRules]);

  // 2. Query liabilities for unified Assets / Liabilities / Net Worth summary
  const { data: rawLiabilities = [] } = useQuery<readonly LiabilityDto[]>({
    queryKey: ['analytics-liabilities', hasLiveBackend ? scopeId : 'demo'],
    queryFn: async () => {
      if (!hasLiveBackend || !scopeId) return [];
      const res = await (liabilityRepo.listLiabilitiesByHousehold
        ? liabilityRepo.listLiabilitiesByHousehold(scopeId)
        : liabilityRepo.listLiabilitiesByUser(scopeId));
      return res.success ? res.value : [];
    },
    enabled: true,
  });

  const totalAssetsRupees = useMemo(() => {
    const cents = holdings.reduce((sum, h) => sum + Math.round(h.currentValueCents || 0), 0);
    return cents / 100;
  }, [holdings]);

  const totalLiabilitiesRupees = useMemo(() => {
    const active = rawLiabilities.filter((l) => {
      if (l.status !== 'active') return false;
      if (selectedMemberId !== 'all') {
        return (
          l.memberId === selectedMemberId ||
          l.parties?.some((p) => p.familyMemberId === selectedMemberId) ||
          l.coBorrowerMemberIds?.includes(selectedMemberId)
        );
      }
      return true;
    });
    const cents = active.reduce((sum, l) => sum + Number(l.currentBalanceCents || 0n), 0);
    return cents / 100;
  }, [rawLiabilities, selectedMemberId]);

  const totalNetWorthRupees = totalAssetsRupees - totalLiabilitiesRupees;

  // 2. Query transactions
  const { data: rawTransactions = [] } = useQuery<TransactionDetailDto[]>({
    queryKey: ['transactions-list', hasLiveBackend ? scopeId : 'demo'],
    queryFn: async () => {
      if (!hasLiveBackend || !scopeId) {
        return shouldAllowDemoData(isDemoMode) ? DEMO_TRANSACTIONS : [];
      }
      const res = await (transactionRepo.listByHousehold
        ? transactionRepo.listByHousehold(scopeId)
        : transactionRepo.listByUser(scopeId));
      return res.success ? res.value : [];
    },
    enabled: true,
  });

  // Filter transactions based on selected family member, demat account & privacy rules
  const transactions = useMemo(() => {
    const memberAccountFiltered = rawTransactions.filter((t) => {
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
    return filterRecordsByPrivacy(memberAccountFiltered, selectedMemberId, privacyRules);
  }, [rawTransactions, selectedMemberId, selectedAccountId, privacyRules]);

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

  // Top gain/loss contributors ("What Changed")
  const topContributors = useMemo(() => {
    return holdings
      .map((h) => {
        const costCents = Math.round((h.quantity || 0) * (h.unitCostCents || 0));
        const valCents = Math.round(h.currentValueCents || 0);
        const gainCents = valCents - costCents;
        const pct = costCents > 0 ? (gainCents / costCents) * 100 : 0;
        return {
          id: h.holdingId,
          name: h.name,
          ticker: h.ticker,
          valMoney: Money.fromCents(BigInt(valCents), 'INR'),
          gainMoney: Money.fromCents(BigInt(Math.abs(gainCents)), 'INR'),
          isGain: gainCents >= 0,
          pct,
          absGain: Math.abs(gainCents),
        };
      })
      .sort((a, b) => b.absGain - a.absGain)
      .slice(0, 4);
  }, [holdings]);

  // Actionable completeness & data health nudges
  const dataHealthNudges = useMemo(() => {
    const items: { id: string; title: string; detail: string; to: string; cta: string }[] = [];
    const missingCostCount = holdings.filter(
      (h) => !h.unitCostCents || h.unitCostCents <= 0
    ).length;

    if (missingCostCount > 0) {
      items.push({
        id: 'missing-cost',
        title: `${missingCostCount} ${missingCostCount === 1 ? 'holding lacks' : 'holdings lack'} purchase cost basis`,
        detail: 'Add average buy prices so unrealized gain and tax shields are exact.',
        to: '/portfolio',
        cta: 'Fix in Portfolio',
      });
    }
    if (!legalName) {
      items.push({
        id: 'missing-kyc',
        title: 'Legal / KYC Name not set',
        detail: 'Required for accurate CDSL / NSDL CAS statement and PAN matching.',
        to: '/settings',
        cta: 'Set in Settings',
      });
    }
    if (analytics.xirr === null) {
      items.push({
        id: 'missing-xirr',
        title: 'XIRR needs dated cashflows',
        detail: 'Record buy/deposit dates in Cashflow to unlock annualized XIRR.',
        to: '/transactions',
        cta: 'Go to Cashflow',
      });
    }
    if (analytics.concentration.warning) {
      items.push({
        id: 'concentration',
        title: 'Single-asset concentration risk',
        detail: analytics.concentration.warning,
        to: '/portfolio',
        cta: 'Review Holdings',
      });
    }
    return items;
  }, [holdings, legalName, analytics.xirr, analytics.concentration.warning]);

  const asOfLabel = useMemo(() => {
    const latest = holdings.reduce((acc, h) => {
      if (!h.updatedAt) return acc;
      return h.updatedAt > acc ? h.updatedAt : acc;
    }, '');
    return latest
      ? new Date(latest).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      : 'Today';
  }, [holdings]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Compact Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">
            Performance & Wealth Analytics
          </h1>
          <p className="hidden sm:block text-xs sm:text-sm text-muted-foreground mt-0.5">
            Returns (XIRR, CAGR), benchmark alpha, and allocation drift · As of {asOfLabel}
          </p>
        </div>

        {/* Model Strategy Pills */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-card border border-border overflow-x-auto no-scrollbar self-start md:self-auto max-w-full">
          {(['balanced', 'aggressive', 'conservative'] as AllocationModelType[]).map((type) => (
            <button
              key={type}
              onClick={() => setModelType(type)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
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

      {/* Compact "MY FAMILY" Horizontal Scroll Strip (Matches Transactions, Portfolio, Liabilities) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground sm:hidden">
          <span className="font-semibold uppercase tracking-wider text-slate-400 text-[11px]">
            My Family
          </span>
          <button
            type="button"
            onClick={() => setIsManageFamilyOpen(true)}
            className="text-[10px] text-primary hover:underline"
          >
            Manage
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setSelectedMemberId('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
              selectedMemberId === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary/60 text-muted-foreground hover:bg-secondary border border-border/60'
            }`}
          >
            Combined Family ({members.length})
          </button>

          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMemberId(m.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                selectedMemberId === m.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-secondary border border-border/60'
              }`}
            >
              {m.name}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setIsManageFamilyOpen(true)}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary border border-border/60 whitespace-nowrap shrink-0"
          >
            <span>+ Manage</span>
          </button>
        </div>
      </div>

      {/* Unified Net Worth, Assets & Liabilities Strip (Standardized formatInr) */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-md p-3 sm:p-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 divide-x divide-border/60">
          <div className="pr-2">
            <div className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground truncate">
              Total Net Worth
            </div>
            <div className="text-base sm:text-xl font-bold font-mono text-white mt-0.5 truncate">
              {formatInr(totalNetWorthRupees, { compact: true })}
            </div>
          </div>

          <Link to="/portfolio" className="pl-2.5 sm:pl-4 group block min-w-0">
            <div className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground group-hover:text-emerald-300 truncate">
              Assets
            </div>
            <div className="text-base sm:text-xl font-bold font-mono text-emerald-400 mt-0.5 truncate">
              {formatInr(totalAssetsRupees, { compact: true })}
            </div>
          </Link>

          <Link to="/liabilities" className="pl-2.5 sm:pl-4 group block min-w-0">
            <div className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground group-hover:text-rose-300 truncate">
              Liabilities
            </div>
            <div className="text-base sm:text-xl font-bold font-mono text-rose-400 mt-0.5 truncate">
              {formatInr(totalLiabilitiesRupees, { compact: true })}
            </div>
          </Link>
        </div>
      </Card>

      {/* Account & Category Filter Bar with Comfortable Spacing */}
      <div className="mt-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
          <button
            type="button"
            onClick={() => setSelectedAccountId('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap shrink-0 transition-colors ${
              selectedAccountId === 'all'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            All Accounts
          </button>
          {accounts.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => setSelectedAccountId(acc.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap shrink-0 transition-colors ${
                selectedAccountId === acc.id
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {acc.accountName}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
          {(
            [
              { id: 'all', label: 'All Categories' },
              { id: 'equity', label: 'Equities & MF' },
              { id: 'fixed_income', label: 'Fixed Income' },
              { id: 'commodity', label: 'Gold' },
              { id: 'cash', label: 'Cash & Liquid' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap shrink-0 transition-colors ${
                selectedCategoryFilter === cat.id
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 4 Performance KPI Cards */}
      <AnalyticsKpiGrid
        analytics={analytics}
        xirrDisplay={xirrDisplay}
        alphaDisplay={alphaDisplay}
        cagrDisplay={cagrDisplay}
      />

      {/* Trajectory Growth Area Chart */}
      <AnalyticsTrajectoryChartCard
        trajectory={analytics.trajectory}
        netWorthRupees={totalNetWorthRupees}
      />

      {/* Actionable Movers ("What Changed") & Data Health Nudges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/80 bg-card/60 backdrop-blur-md p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Top Contributors &amp; Movers
            </h3>
            <Link to="/portfolio" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>
          {topContributors.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              Add holdings in Portfolio to see performance contributors.
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {topContributors.map((item) => (
                <Link
                  key={item.id}
                  to="/portfolio"
                  className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3 hover:bg-secondary/30 rounded-lg px-1.5 -mx-1.5 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      Value {formatInr(item.valMoney.toDecimal(), { compact: true })}
                    </div>
                  </div>
                  <div className="text-right shrink-0 font-mono">
                    <div
                      className={`text-xs font-bold ${
                        item.isGain ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatInr(
                        item.isGain ? item.gainMoney.toDecimal() : -item.gainMoney.toDecimal(),
                        { compact: true, showSign: true }
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {item.isGain ? '+' : ''}
                      {item.pct.toFixed(1)}%
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="border-border/80 bg-card/60 backdrop-blur-md p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Data Health &amp; Accuracy Nudges
            </h3>
            <span className="text-[11px] text-muted-foreground">As of {asOfLabel}</span>
          </div>
          {dataHealthNudges.length === 0 ? (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>All valuation, cost-basis, and KYC inputs look complete.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {dataHealthNudges.map((nudge) => (
                <Link
                  key={nudge.id}
                  to={nudge.to}
                  className="p-2.5 rounded-lg bg-secondary/30 border border-border/60 hover:border-amber-500/40 flex items-center justify-between gap-3 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{nudge.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{nudge.detail}</div>
                  </div>
                  <span className="text-[11px] font-medium text-amber-300 shrink-0 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    {nudge.cta}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

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
