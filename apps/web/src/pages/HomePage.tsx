import { useQuery } from '@tanstack/react-query';
import {
  GetSystemStatusUseCase,
  SystemStatusDto,
  ListAssetClassesUseCase,
  GetNetWorthSummaryUseCase,
} from '@wealthnest/application';
import { Money, AssetClassDefinition, NetWorthSummary } from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AuthCard } from '@/components/auth/AuthCard';
import { SupabaseAssetClassAdapter } from '@/lib/supabase/asset-class.adapter';
import { SupabaseHoldingAdapter } from '@/lib/supabase/holding.adapter';
import { SupabaseLiabilityAdapter } from '@/lib/supabase/liability.adapter';
import { useAuth } from '@/lib/supabase/auth-context';
import {
  CheckCircle2,
  Layers,
  Cpu,
  Box,
  Sparkles,
  ArrowRight,
  Database,
  ExternalLink,
  Landmark,
  Wallet,
  TrendingDown,
  Percent,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function HomePage() {
  const { user } = useAuth();
  const userId = user?.id || '';

  // Query 1: System status use case
  const { data: systemStatus, isLoading } = useQuery<SystemStatusDto>({
    queryKey: ['system-status'],
    queryFn: () => {
      const useCase = new GetSystemStatusUseCase();
      const result = useCase.execute();
      if (!result.success) throw result.error;
      return result.value;
    },
  });

  // Query 2: Asset classes via Supabase adapter
  const { data: assetClasses, isLoading: isLoadingAssetClasses } = useQuery<AssetClassDefinition[]>(
    {
      queryKey: ['asset-classes'],
      queryFn: async () => {
        const adapter = new SupabaseAssetClassAdapter();
        const useCase = new ListAssetClassesUseCase(adapter);
        const result = await useCase.execute();
        if (!result.success) return [];
        return result.value;
      },
      retry: 0,
    }
  );

  // Query 3: Net Worth Summary (Assets minus Liabilities)
  const { data: netWorthSummary } = useQuery<NetWorthSummary | null>({
    queryKey: ['net-worth-summary', userId],
    queryFn: async () => {
      if (!userId) return null;
      const holdingAdapter = new SupabaseHoldingAdapter();
      const liabilityAdapter = new SupabaseLiabilityAdapter();
      const useCase = new GetNetWorthSummaryUseCase(holdingAdapter, liabilityAdapter);
      const result = await useCase.execute({ userId });
      if (!result.success) return null;
      return result.value;
    },
    enabled: Boolean(userId),
  });

  const totalAssets = netWorthSummary?.totalAssets.toDecimal() ?? 0;
  const totalLiabilities = netWorthSummary?.totalLiabilities.toDecimal() ?? 0;
  const netWorth = netWorthSummary?.netWorth.toDecimal() ?? 0;
  const isSolvent = netWorthSummary?.isSolvent ?? true;
  const debtToAssets = (netWorthSummary?.debtToAssetsRatio ?? 0) * 100;
  const totalMonthlyEmi = netWorthSummary?.totalMonthlyEmi.toDecimal() ?? 0;

  // Pure domain test calculation to verify domain package export boundary
  const demoMoneyA = Money.fromDecimal(150000.5, 'INR');
  const demoMoneyB = Money.fromDecimal(49999.5, 'INR');
  const totalDemo = demoMoneyA.add(demoMoneyB);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-emerald-950/20 p-8 shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            Phase 5: Loans & Liabilities Integration
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            WealthNest Financial Health
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Personal wealth operating system integrating verified assets, CAS imports, mortgages,
            and loan obligations into unified net worth and cash flow analytics.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            {!user && (
              <Link to="/signup">
                <Button className="gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs">
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
            <Link to="/portfolio">
              <Button variant={!user ? 'outline' : 'default'} className="gap-2 text-xs">
                Portfolio Module
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/liabilities">
              <Button variant="secondary" className="gap-2 text-xs">
                <Landmark className="w-4 h-4 text-primary" />
                Loans & Liabilities
              </Button>
            </Link>
            <a
              href="http://localhost:54323"
              target="_blank"
              rel="noreferrer"
              className="inline-block"
            >
              <Button variant="outline" className="gap-2 font-mono text-xs">
                <Database className="w-4 h-4 text-emerald-400" />
                Supabase Studio
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </Button>
            </a>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Integrated Net Worth Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Worth */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>Total Net Worth</span>
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <CardTitle
              className={`text-2xl font-bold font-mono tracking-tight pt-1 ${
                isSolvent ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isSolvent ? '₹' : '-₹'}
              {netWorth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Assets (₹{totalAssets.toLocaleString('en-IN', { maximumFractionDigits: 0 })}) - Debt
            </p>
          </CardContent>
        </Card>

        {/* Total Outstanding Liabilities */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>Outstanding Debt</span>
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <CardTitle className="text-2xl font-bold font-mono tracking-tight text-foreground pt-1">
              ₹{totalLiabilities.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Link
              to="/liabilities"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              View loans & mortgages →
            </Link>
          </CardContent>
        </Card>

        {/* Monthly EMI Outflow */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>Monthly EMI</span>
              <Landmark className="w-4 h-4 text-amber-400" />
            </div>
            <CardTitle className="text-2xl font-bold font-mono tracking-tight text-foreground pt-1">
              ₹{totalMonthlyEmi.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">Monthly cash outflow for debt service</p>
          </CardContent>
        </Card>

        {/* Debt-To-Assets Ratio */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>Debt-To-Assets</span>
              <Percent className="w-4 h-4 text-blue-400" />
            </div>
            <CardTitle className="text-2xl font-bold font-mono tracking-tight text-foreground pt-1">
              {debtToAssets.toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Badge
              variant={
                debtToAssets <= 30 ? 'success' : debtToAssets <= 50 ? 'secondary' : 'destructive'
              }
              className="text-[10px]"
            >
              {debtToAssets <= 30
                ? 'Low Leverage'
                : debtToAssets <= 50
                  ? 'Moderate'
                  : 'High Leverage'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Auth Card + Supabase Database Manager Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Authentication Card */}
        <AuthCard />

        {/* Database GUI (Supabase Studio) Card */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <CardTitle className="text-base">Database GUI (Supabase Studio)</CardTitle>
                </div>
                <Badge variant="success">phpMyAdmin Alternative</Badge>
              </div>
              <CardDescription>
                Visual PostgreSQL table browser, SQL editor, and RLS policy manager.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Supabase Studio is your local web-based database manager running at port{' '}
                <code className="text-primary font-mono font-semibold">54323</code>. You can inspect
                tables, edit rows directly, and test SQL queries with a spreadsheet-like GUI.
              </p>
              <div className="p-3 rounded-lg bg-secondary/40 border border-border/50 text-xs font-mono space-y-1">
                <p className="text-muted-foreground">
                  Postgres Port: <span className="text-foreground">54322</span>
                </p>
                <p className="text-muted-foreground">
                  Studio URL: <span className="text-primary">http://localhost:54323</span>
                </p>
                <p className="text-muted-foreground">
                  Auth API: <span className="text-foreground">http://localhost:54321</span>
                </p>
              </div>
            </CardContent>
          </div>
          <div className="p-6 pt-0">
            <a
              href="http://localhost:54323"
              target="_blank"
              rel="noreferrer"
              className="w-full inline-block"
            >
              <Button variant="outline" size="sm" className="w-full gap-2 font-mono">
                Launch Supabase Studio
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          </div>
        </Card>
      </div>

      {/* Asset Class Taxonomy (Database Seeded Table) */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-primary" />
              <CardTitle>Asset Class Taxonomy (Database Schema)</CardTitle>
            </div>
            <Badge variant="secondary">PostgreSQL Seed</Badge>
          </div>
          <CardDescription>
            Taxonomy classes defined in{' '}
            <code className="text-primary font-mono">
              supabase/migrations/20260101000001_core_schema.sql
            </code>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAssetClasses ? (
            <p className="text-xs text-muted-foreground">Connecting to local database...</p>
          ) : assetClasses && assetClasses.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 pt-1">
              {assetClasses.map((ac) => (
                <div
                  key={ac.id}
                  className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-center space-y-1"
                >
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: ac.colorHex }}
                  />
                  <p className="text-xs font-semibold text-foreground truncate">{ac.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{ac.id}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-secondary/30 border border-dashed border-border/60 text-xs text-muted-foreground">
              Run <code className="text-primary font-mono">npm run db:start</code> in your terminal
              to start the local Supabase PostgreSQL containers and seed the taxonomy table.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pure Domain Engine Verification */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-primary" />
              <CardTitle>Pure Domain Engine Scaffold Verification</CardTitle>
            </div>
            <Badge variant="success">Boundary Verified</Badge>
          </div>
          <CardDescription>
            Validating that framework-independent models from{' '}
            <code className="text-primary font-mono">@wealthnest/domain</code> execute without
            floating-point errors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-lg bg-secondary/40 border border-border/50">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Holding A Value
              </span>
              <p className="text-xl font-bold font-mono text-foreground mt-1">
                {demoMoneyA.format('en-IN')}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                BigInt paise: {demoMoneyA.cents.toString()}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/40 border border-border/50">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Holding B Value
              </span>
              <p className="text-xl font-bold font-mono text-foreground mt-1">
                {demoMoneyB.format('en-IN')}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                BigInt paise: {demoMoneyB.cents.toString()}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-xs text-primary font-semibold uppercase tracking-wider">
                Calculated Sum (A + B)
              </span>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {totalDemo.format('en-IN')}
              </p>
              <p className="text-[11px] text-emerald-400/80 mt-0.5">
                Strict ISO currency validation
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Architecture Layers Status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Active Architecture Layers</h3>
          </div>
          <Badge variant="secondary">npm workspaces</Badge>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading architecture status...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemStatus?.layers.map((layer) => (
              <Card
                key={layer.name}
                className="border-border/70 hover:border-border transition-colors"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <Box className="w-4 h-4 text-primary" />
                      {layer.name}
                    </CardTitle>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{layer.status}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {layer.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Local Domain & Docker Quick Status */}
      <Card className="border-border/60 bg-secondary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Environment & Access Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-md bg-secondary/50 border border-border/40">
              <span className="text-muted-foreground block mb-1">Local Web Domain</span>
              <span className="font-mono text-primary font-semibold">http://wealthnest.local</span>
            </div>
            <div className="p-3 rounded-md bg-secondary/50 border border-border/40">
              <span className="text-muted-foreground block mb-1">Supabase Studio (DB GUI)</span>
              <span className="font-mono text-emerald-400 font-semibold">
                http://localhost:54323
              </span>
            </div>
            <div className="p-3 rounded-md bg-secondary/50 border border-border/40">
              <span className="text-muted-foreground block mb-1">PostgreSQL Port</span>
              <span className="font-mono text-foreground font-semibold">127.0.0.1:54322</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
