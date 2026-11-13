import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  GetNetWorthSummaryUseCase,
  GetCashflowSummaryUseCase,
  ManageDocumentVaultUseCase,
  HoldingDetailDto,
} from '@wealthnest/application';
import {
  Money,
  NetWorthSummary,
  CashflowSummary,
  calculatePortfolioSummary,
  HoldingValuationItem,
  evaluateEmergencyRunway,
  generateHouseholdAttentionAlerts,
  FinancialAlert,
  summarizeDocumentVault,
} from '@wealthnest/domain';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useRepositories } from '@/lib/persistence/repository-context';
import { useAuth } from '@/lib/supabase/auth-context';
import { useFamily } from '@/lib/family/family-context';
import { usePreferences } from '@/lib/preferences/preferences-context';
import { FamilyFilterBar } from '@/components/family/FamilyFilterBar';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  Landmark,
  ShieldCheck,
  Target,
  ArrowRight,
  Plus,
  PieChart,
  ArrowUpRight,
  Calendar,
  Sparkles,
  Percent,
  AlertTriangle,
  AlertCircle,
  Info,
  Building2,
  FolderLock,
} from 'lucide-react';

export function HomePage() {
  const { user } = useAuth();
  const userId = user?.id || 'demo-user';
  const { holdingRepo, liabilityRepo, transactionRepo, documentVaultRepo } = useRepositories();
  const { selectedMemberId } = useFamily();
  const { currencySymbol, preferences } = usePreferences();
  const locale = preferences.numberFormat || 'en-IN';

  // 1. Fetch Holdings for Portfolio & Asset Allocation
  const { data: holdings = [] } = useQuery<HoldingDetailDto[]>({
    queryKey: ['holdings', userId, selectedMemberId],
    queryFn: async () => {
      const result = await holdingRepo.listDetailsByUser(userId);
      if (!result.success) return [];
      let list = result.value;
      if (selectedMemberId !== 'all') {
        list = list.filter((h: HoldingDetailDto) => h.memberId === selectedMemberId);
      }
      return list;
    },
  });

  // 2. Fetch Net Worth Summary (Assets vs Liabilities)
  const { data: netWorthSummary } = useQuery<NetWorthSummary | null>({
    queryKey: ['net-worth-summary', userId],
    queryFn: async () => {
      const useCase = new GetNetWorthSummaryUseCase(holdingRepo, liabilityRepo);
      const result = await useCase.execute({ userId });
      if (!result.success) return null;
      return result.value;
    },
  });

  // 3. Fetch Cashflow Summary (Inflows & Outflows)
  const { data: cashflowSummary } = useQuery<CashflowSummary | null>({
    queryKey: ['cashflow-summary', userId],
    queryFn: async () => {
      const useCase = new GetCashflowSummaryUseCase(transactionRepo);
      const result = await useCase.execute(userId);
      if (!result.success) return null;
      return result.value.summary;
    },
  });

  // 4. Fetch Document Vault Summary (for renewal & record counts)
  const { data: vaultSummary } = useQuery({
    queryKey: ['vault-summary', userId],
    queryFn: async () => {
      if (!user) return null;
      const useCase = new ManageDocumentVaultUseCase(documentVaultRepo);
      const result = await useCase.listDocuments(user.id);
      if (!result.success) return null;
      return summarizeDocumentVault(result.value);
    },
  });

  const propertyEquities = netWorthSummary?.propertyEquities ?? [];
  const totalRealEstateEquity = propertyEquities.reduce(
    (sum, pe) => sum + pe.equity.toDecimal(),
    0
  );

  // Pure domain portfolio summary
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

  // Liquid assets estimation (Cash, Deposits, Mutual Funds)
  const liquidAssetClasses = new Set(['cash_and_bank', 'liquid_funds', 'mutual_fund']);
  const liquidHoldings = holdings.filter((h) => liquidAssetClasses.has(h.assetClassId));
  const liquidValuationCents = liquidHoldings.reduce(
    (sum, h) => sum + BigInt(h.currentValueCents || 0),
    0n
  );
  const liquidAssets = Money.fromCents(liquidValuationCents, 'INR').toDecimal();

  // Metrics derived safely
  const totalAssets = netWorthSummary?.totalAssets.toDecimal() ?? portfolioSummary.totalValue.toDecimal();
  const totalLiabilities = netWorthSummary?.totalLiabilities.toDecimal() ?? 0;
  const netWorth = totalAssets - totalLiabilities;
  const isSolvent = netWorth >= 0;
  const debtToAssets = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
  const totalMonthlyEmi = netWorthSummary?.totalMonthlyEmi.toDecimal() ?? 0;

  // Monthly Cashflow figures
  const monthlyInflow = cashflowSummary?.totalInflows.toDecimal() ?? 0;
  const monthlyOutflow = cashflowSummary?.totalOutflows.toDecimal() ?? 0;
  const netMonthlySavings = monthlyInflow - monthlyOutflow;

  // Emergency runway evaluation using pure domain engine
  const monthlyBurnMoney = Money.fromCents(
    BigInt(
      Math.round(
        (monthlyOutflow > 0
          ? monthlyOutflow
          : totalMonthlyEmi > 0
            ? totalMonthlyEmi * 1.5
            : 100000) * 100
      )
    ),
    'INR'
  );
  const liquidCorpusMoney = Money.fromCents(liquidValuationCents, 'INR');

  const emergencyRunwayAssessment = evaluateEmergencyRunway({
    liquidCorpus: liquidCorpusMoney,
    monthlyExpenses: monthlyBurnMoney,
    targetMonths: 6,
  });

  const householdAlerts = generateHouseholdAttentionAlerts({
    emergencyRunway: emergencyRunwayAssessment,
    totalMonthlyEmi: netWorthSummary?.totalMonthlyEmi ?? Money.zero('INR'),
    hasStaleValuations: false,
    section112aEligible: true,
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Family Entity Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
            Family Wealth Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Combined position, liquidity reserves, and financial commitments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/transactions?action=new">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5 text-primary" />
              Add Transaction
            </Button>
          </Link>
          <Link to="/portfolio?action=new">
            <Button size="sm" className="gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold">
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Add Asset
            </Button>
          </Link>
        </div>
      </div>

      <FamilyFilterBar />

      {/* Top 4 Executive Financial Health KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Net Worth */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm relative overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>Family Net Worth</span>
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <CardTitle
              className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight pt-1 ${
                isSolvent ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isSolvent ? currencySymbol : `-${currencySymbol}`}
              {Math.abs(netWorth).toLocaleString(locale, { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Assets {currencySymbol}{totalAssets.toLocaleString(locale, { maximumFractionDigits: 0 })} - Debt {currencySymbol}{totalLiabilities.toLocaleString(locale, { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
          <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />
        </Card>

        {/* 2. Liquid Reserves & Runway */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm relative overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>Liquid Reserves</span>
              <ShieldCheck className="w-4 h-4 text-blue-400" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground pt-1">
              {currencySymbol}{liquidAssets.toLocaleString(locale, { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Cash, Bank & Mutual Funds</p>
            <Badge
              variant="outline"
              className={`text-[10px] ${
                emergencyRunwayAssessment.status === 'adequate'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : emergencyRunwayAssessment.status === 'warning'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/30 font-bold'
              }`}
            >
              ~{emergencyRunwayAssessment.runwayMonths.toFixed(1)} mos runway
            </Badge>
          </CardContent>
          <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-blue-500/10 blur-xl pointer-events-none" />
        </Card>

        {/* 3. Monthly Debt Service (EMI) */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm relative overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>Monthly EMI Outflow</span>
              <Landmark className="w-4 h-4 text-amber-400" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground pt-1">
              {currencySymbol}{totalMonthlyEmi.toLocaleString(locale, { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex items-center justify-between">
            <Link
              to="/liabilities"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Manage debt obligations →
            </Link>
            <Badge
              variant={debtToAssets <= 30 ? 'success' : debtToAssets <= 50 ? 'secondary' : 'destructive'}
              className="text-[10px]"
            >
              {debtToAssets.toFixed(1)}% Leverage
            </Badge>
          </CardContent>
          <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />
        </Card>

        {/* 4. Monthly Net Savings / Cashflow */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm relative overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>Net Monthly Flow</span>
              {netMonthlySavings >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <CardTitle
              className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight pt-1 ${
                netMonthlySavings >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {netMonthlySavings >= 0 ? `+${currencySymbol}` : `-${currencySymbol}`}
              {Math.abs(netMonthlySavings).toLocaleString(locale, { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              +{currencySymbol}{monthlyInflow.toLocaleString(locale, { maximumFractionDigits: 0 })} in / -{currencySymbol}{monthlyOutflow.toLocaleString(locale, { maximumFractionDigits: 0 })} out
            </p>
          </CardContent>
          <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />
        </Card>
      </div>

      {/* Grid: Asset Allocation Breakdown & Actionable Attention Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Asset Allocation Portfolio Distribution */}
        <Card className="lg:col-span-2 border-border/80 bg-card/60 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-primary" />
                  <CardTitle className="text-base font-semibold">Asset Allocation Distribution</CardTitle>
                </div>
                <Link to="/portfolio" className="text-xs text-primary hover:underline flex items-center gap-1">
                  View Full Portfolio <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <CardDescription>
                Diversification across physical assets, demat equities, mutual funds, and cash
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Distribution Horizontal Progress Bar */}
              <div className="h-3 w-full bg-secondary/60 rounded-full overflow-hidden flex gap-0.5">
                {portfolioSummary.allocations.length > 0 ? (
                  portfolioSummary.allocations.map((alloc) => (
                    <div
                      key={alloc.assetClassId}
                      style={{
                        width: `${Math.max(alloc.percentage, 2)}%`,
                        backgroundColor: alloc.colorHex || '#3b82f6',
                      }}
                      title={`${alloc.name}: ${alloc.percentage.toFixed(1)}%`}
                    />
                  ))
                ) : (
                  <div className="w-full bg-muted" />
                )}
              </div>

              {/* Allocation Legend Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                {portfolioSummary.allocations.map((alloc) => (
                  <div
                    key={alloc.assetClassId}
                    className="p-3 rounded-xl bg-secondary/30 border border-border/50 flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: alloc.colorHex || '#3b82f6' }}
                      />
                      <span className="text-xs font-medium text-foreground truncate">
                        {alloc.name}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-sm font-bold font-mono text-foreground">
                        {currencySymbol}
                        {alloc.totalValue.toDecimal().toLocaleString(locale, { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground font-mono">
                        {alloc.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </div>

          <div className="p-4 border-t border-border/50 bg-secondary/10 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Tracked Capital: <strong className="text-foreground">{currencySymbol}{portfolioSummary.totalValue.toDecimal().toLocaleString(locale, { maximumFractionDigits: 0 })}</strong></span>
            <span>Positions: <strong className="text-foreground">{holdings.length}</strong></span>
          </div>
        </Card>

        {/* Right (1 col): Actionable Family Attention Items */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <CardTitle className="text-base font-semibold">Action & Attention</CardTitle>
              </div>
              {emergencyRunwayAssessment.alert && (
                <Badge
                  variant={
                    emergencyRunwayAssessment.alert.severity === 'critical'
                      ? 'destructive'
                      : 'secondary'
                  }
                  className="text-[10px]"
                >
                  {emergencyRunwayAssessment.alert.severity.toUpperCase()}
                </Badge>
              )}
            </div>
            <CardDescription>
              Upcoming commitments, valuations, and emergency runway signals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-2.5">
              {householdAlerts.map((alert: FinancialAlert) => {
                const isCrit = alert.severity === 'critical';
                const isWarn = alert.severity === 'warning';
                return (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                      isCrit
                        ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                        : isWarn
                          ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                          : 'bg-secondary/40 border-border/60 text-foreground'
                    }`}
                  >
                    {isCrit ? (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    ) : isWarn ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : alert.type === 'emi_obligation' ? (
                      <Calendar className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : alert.type === 'tax_harvesting_opportunity' ? (
                      <Percent className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    )}
                    <div className="text-xs space-y-0.5 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-foreground">{alert.title}</p>
                        {alert.actionHref && (
                          <Link
                            to={alert.actionHref}
                            className="text-[11px] text-primary hover:underline font-medium ml-2 shrink-0"
                          >
                            {alert.actionLabel || 'Details'} →
                          </Link>
                        )}
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{alert.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3">
              <Link to="/analytics" className="w-full inline-block">
                <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                  Inspect Tax & Performance Radar
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Navigation Row for Modules */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Link to="/portfolio" className="group">
          <Card className="p-4 border-border/70 hover:border-primary/50 transition-all bg-card/40 hover:bg-card/70 group-hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/15 text-blue-400 group-hover:scale-105 transition-transform">
                <PieChart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Portfolio</p>
                <p className="text-xs text-muted-foreground">{holdings.length} assets recorded</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/real-estate" className="group">
          <Card className="p-4 border-border/70 hover:border-amber-500/50 transition-all bg-card/40 hover:bg-card/70 group-hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/15 text-amber-400 group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Real Estate</p>
                <p className="text-xs text-muted-foreground">
                  {propertyEquities.length > 0
                    ? `${currencySymbol}${totalRealEstateEquity.toLocaleString(locale, { maximumFractionDigits: 0 })} equity`
                    : 'Equity, LTV & Yield'}
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/liabilities" className="group">
          <Card className="p-4 border-border/70 hover:border-amber-500/50 transition-all bg-card/40 hover:bg-card/70 group-hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/15 text-amber-400 group-hover:scale-105 transition-transform">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Liabilities</p>
                <p className="text-xs text-muted-foreground">
                  {currencySymbol}{totalLiabilities.toLocaleString(locale, { maximumFractionDigits: 0 })} outstanding
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/goals" className="group">
          <Card className="p-4 border-border/70 hover:border-purple-500/50 transition-all bg-card/40 hover:bg-card/70 group-hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-500/15 text-purple-400 group-hover:scale-105 transition-transform">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Goals</p>
                <p className="text-xs text-muted-foreground">Education & Retirement</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/transactions" className="group">
          <Card className="p-4 border-border/70 hover:border-emerald-500/50 transition-all bg-card/40 hover:bg-card/70 group-hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 group-hover:scale-105 transition-transform">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Transactions</p>
                <p className="text-xs text-muted-foreground">Cashflow & Trade Ledger</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/documents" className="group">
          <Card className="p-4 border-border/70 hover:border-cyan-500/50 transition-all bg-card/40 hover:bg-card/70 group-hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/15 text-cyan-400 group-hover:scale-105 transition-transform">
                <FolderLock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Document Vault</p>
                <p className="text-xs text-muted-foreground">
                  {vaultSummary
                    ? `${vaultSummary.totalDocuments} docs${
                        vaultSummary.expiringSoonCount + vaultSummary.expiredCount > 0
                          ? ` · ${vaultSummary.expiringSoonCount + vaultSummary.expiredCount} renewal`
                          : ''
                      }`
                    : 'PAN, HUF & Policies'}
                </p>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
export default HomePage;
