import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CurrencyCode,
  Money,
  calculateCashflowSummary,
  CashflowSummary,
  CashflowTransactionItem,
  TransactionType,
  isInflow,
  isOutflow,
} from '@wealthnest/domain';
import {
  GetCashflowSummaryUseCase,
  RecordTransactionUseCase,
  DeleteTransactionUseCase,
  TransactionDetailDto,
} from '@wealthnest/application';
import { SupabaseTransactionAdapter } from '@/lib/supabase/transaction.adapter';
import { SupabaseHoldingAdapter } from '@/lib/supabase/holding.adapter';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  RecordTransactionModal,
  NewTransactionFormValues,
} from '@/components/transactions/RecordTransactionModal';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Scale,
  Receipt,
  Search,
  Sparkles,
  Database,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Realistic sample Indian cashflow audit history for demo mode
const DEMO_TRANSACTIONS: TransactionDetailDto[] = [
  {
    id: 'demo-tx-1',
    userId: 'demo-user',
    type: 'deposit',
    amountCents: 15000000, // ₹1,50,000.00
    currency: 'INR',
    transactionDate: '2026-04-01T09:30:00Z',
    notes: 'Monthly investment capital allocation from salary account',
    createdAt: '2026-04-01T09:30:00Z',
  },
  {
    id: 'demo-tx-2',
    userId: 'demo-user',
    assetId: 'asset-rel',
    assetName: 'Reliance Industries Ltd',
    assetTicker: 'RELIANCE',
    type: 'buy',
    quantity: 15,
    amountCents: 3750000, // ₹37,500.00
    currency: 'INR',
    transactionDate: '2026-04-03T11:15:00Z',
    notes: 'Accumulation on market dip (NSE)',
    createdAt: '2026-04-03T11:15:00Z',
  },
  {
    id: 'demo-tx-3',
    userId: 'demo-user',
    assetId: 'asset-nifty',
    assetName: 'Nifty 50 Index ETF',
    assetTicker: 'NIFTYBEES',
    type: 'buy',
    quantity: 100,
    amountCents: 2400000, // ₹24,000.00
    currency: 'INR',
    transactionDate: '2026-04-05T10:00:00Z',
    notes: 'Systematic Investment Plan (SIP) auto-execution',
    createdAt: '2026-04-05T10:00:00Z',
  },
  {
    id: 'demo-tx-4',
    userId: 'demo-user',
    assetId: 'asset-tcs',
    assetName: 'Tata Consultancy Services',
    assetTicker: 'TCS',
    type: 'dividend',
    amountCents: 480000, // ₹4,800.00
    currency: 'INR',
    transactionDate: '2026-04-12T14:20:00Z',
    notes: 'Q4 Final Dividend credited to bank',
    createdAt: '2026-04-12T14:20:00Z',
  },
  {
    id: 'demo-tx-5',
    userId: 'demo-user',
    assetId: 'asset-sgb',
    assetName: 'Sovereign Gold Bond 2028',
    assetTicker: 'SGB-2028',
    type: 'dividend',
    amountCents: 375000, // ₹3,750.00
    currency: 'INR',
    transactionDate: '2026-04-15T10:00:00Z',
    notes: 'RBI Semi-annual 2.5% tax-free interest payout',
    createdAt: '2026-04-15T10:00:00Z',
  },
  {
    id: 'demo-tx-6',
    userId: 'demo-user',
    type: 'fee',
    amountCents: 18500, // ₹185.00
    currency: 'INR',
    transactionDate: '2026-04-05T10:01:00Z',
    notes: 'Securities Transaction Tax (STT), GST & Depository AMC charges',
    createdAt: '2026-04-05T10:01:00Z',
  },
  {
    id: 'demo-tx-7',
    userId: 'demo-user',
    type: 'withdrawal',
    amountCents: 3500000, // ₹35,000.00
    currency: 'INR',
    transactionDate: '2026-04-20T16:45:00Z',
    notes: 'Quarterly home maintenance and insurance disbursement',
    createdAt: '2026-04-20T16:45:00Z',
  },
];

export function TransactionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'inflow' | 'outflow' | 'trades'>(
    'all'
  );

  // Local state for interactive demo mode when not logged in
  const [localDemoTransactions, setLocalDemoTransactions] =
    useState<TransactionDetailDto[]>(DEMO_TRANSACTIONS);

  const transactionAdapter = useMemo(() => new SupabaseTransactionAdapter(), []);
  const holdingAdapter = useMemo(() => new SupabaseHoldingAdapter(), []);

  // Query user holdings for asset dropdown in modal
  const { data: userHoldings } = useQuery({
    queryKey: ['user-holdings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const res = await holdingAdapter.listDetailsByUser(user.id);
      return res.success ? res.value : [];
    },
    enabled: !!user,
  });

  // Query authenticated transactions from Supabase via Clean Architecture Use Case
  const {
    data: dbCashflowData,
    isLoading: isLoadingDb,
    refetch,
  } = useQuery({
    queryKey: ['cashflow-summary', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const useCase = new GetCashflowSummaryUseCase(transactionAdapter);
      const res = await useCase.execute(user.id, 'INR');
      if (!res.success) throw res.error;
      return res.value;
    },
    enabled: !!user,
  });

  // Active transactions depending on authentication state
  const activeTransactions: TransactionDetailDto[] = useMemo(() => {
    if (user && dbCashflowData) {
      return [...dbCashflowData.transactions];
    }
    return localDemoTransactions;
  }, [user, dbCashflowData, localDemoTransactions]);

  // Pure Domain Summary calculation with Money value objects
  const summary: CashflowSummary = useMemo(() => {
    if (user && dbCashflowData) {
      return dbCashflowData.summary;
    }

    const items: CashflowTransactionItem[] = localDemoTransactions.map((t) => {
      const txCurrency = (t.currency as CurrencyCode) || 'INR';
      const amount = Money.fromCents(BigInt(t.amountCents), txCurrency);

      return {
        id: t.id,
        type: t.type,
        amount,
        date: t.transactionDate,
      };
    });

    return calculateCashflowSummary(items, 'INR');
  }, [user, dbCashflowData, localDemoTransactions]);

  // Filter transactions based on category and search
  const filteredTransactions = useMemo(() => {
    return activeTransactions.filter((tx) => {
      // Category filter
      if (categoryFilter === 'inflow' && !isInflow(tx.type)) return false;
      if (categoryFilter === 'outflow' && !isOutflow(tx.type)) return false;
      if (categoryFilter === 'trades' && tx.type !== 'buy' && tx.type !== 'sell') return false;

      // Text search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = tx.assetName?.toLowerCase().includes(q);
      const matchTicker = tx.assetTicker?.toLowerCase().includes(q);
      const matchNotes = tx.notes?.toLowerCase().includes(q);
      const matchType = tx.type.toLowerCase().includes(q);

      return !!(matchName || matchTicker || matchNotes || matchType);
    });
  }, [activeTransactions, categoryFilter, searchQuery]);

  // Mutation: Record Transaction
  const recordMutation = useMutation({
    mutationFn: async (values: NewTransactionFormValues) => {
      const amountCents = Math.round(values.amount * 100);

      if (user) {
        // Authenticated: Persist to PostgreSQL database with automated holding synchronization
        const useCase = new RecordTransactionUseCase(transactionAdapter, holdingAdapter);
        const res = await useCase.execute({
          userId: user.id,
          assetId: values.assetId,
          type: values.type,
          quantity: values.quantity,
          amountCents,
          currency: values.currency || 'INR',
          transactionDate: values.transactionDate,
          notes: values.notes,
        });

        if (!res.success) throw res.error;
        return res.value;
      } else {
        // Demo Mode: Add into local state
        const newDemoItem: TransactionDetailDto = {
          id: `demo-tx-${Date.now()}`,
          userId: 'demo-user',
          assetId: values.assetId,
          assetName: values.assetName,
          assetTicker: values.assetTicker,
          type: values.type,
          quantity: values.quantity,
          amountCents,
          currency: values.currency || 'INR',
          transactionDate: values.transactionDate,
          notes: values.notes,
          createdAt: new Date().toISOString(),
        };
        setLocalDemoTransactions((prev) => [newDemoItem, ...prev]);
        return newDemoItem;
      }
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['cashflow-summary', user.id] });
        queryClient.invalidateQueries({ queryKey: ['user-holdings', user.id] });
        queryClient.invalidateQueries({ queryKey: ['portfolio-summary', user.id] });
      }
    },
  });

  // Mutation: Delete Transaction
  const deleteMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      if (user) {
        const useCase = new DeleteTransactionUseCase(transactionAdapter);
        const res = await useCase.execute(transactionId, user.id);
        if (!res.success) throw res.error;
      } else {
        setLocalDemoTransactions((prev) => prev.filter((t) => t.id !== transactionId));
      }
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['cashflow-summary', user.id] });
      }
    },
  });

  // Seed sample starter transactions for authenticated user
  const handleSeedStarterTransactions = async () => {
    if (!user) return;
    for (const tx of DEMO_TRANSACTIONS.slice(0, 4)) {
      const useCase = new RecordTransactionUseCase(transactionAdapter);
      await useCase.execute({
        userId: user.id,
        type: tx.type,
        amountCents: tx.amountCents,
        currency: 'INR',
        transactionDate: tx.transactionDate,
        notes: tx.notes,
      });
    }
    refetch();
  };

  // Compute total volume for progress comparison bar
  const totalVolumeCents = summary.totalInflows.cents + summary.totalOutflows.cents;
  const inflowRatio =
    totalVolumeCents > 0n
      ? Number((summary.totalInflows.cents * 10000n) / totalVolumeCents) / 100
      : 50;
  const outflowRatio =
    totalVolumeCents > 0n
      ? Number((summary.totalOutflows.cents * 10000n) / totalVolumeCents) / 100
      : 50;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Transactions & Cashflow
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
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cashflow audit log, capital inflows, asset acquisitions, payouts, and statutory charges.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => setIsModalOpen(true)} className="gap-2 shadow-sm">
            <Plus className="w-4 h-4" />
            Record Transaction
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
                Interactive Demonstration Cashflow Log Active
              </p>
              <p className="text-xs text-muted-foreground">
                Sample audit history featuring Indian salary deposits, Reliance purchases, Nifty 50
                SIPs, and TCS dividends. Sign in to persist your personal audit trail in PostgreSQL.
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

      {/* Top Cashflow Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Inflows */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Inflows
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              +{summary.totalInflows.format('en-IN')}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {summary.totalInflows.formatIndianCompact()}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {summary.inflowCount} Inflow events
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Total Outflows */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Outflows
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-rose-400">
              -{summary.totalOutflows.format('en-IN')}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                {summary.totalOutflows.formatIndianCompact()}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {summary.outflowCount} Outflow events
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Net Cashflow Balance */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Net Cashflow
            </CardTitle>
            <Scale className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-mono ${
                summary.isNetPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {summary.isNetPositive ? '+' : '-'}
              {summary.netCashflow.format('en-IN')}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${
                  summary.isNetPositive
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                }`}
              >
                {summary.isNetPositive ? '+' : '-'}
                {summary.netCashflow.formatIndianCompact()}
              </span>
              <span className="text-[11px] text-muted-foreground">Net capital balance</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Audit Volume */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Audit Volume
            </CardTitle>
            <Receipt className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {summary.totalCount} Records
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 font-mono">
              Signed & timestamped audit log
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cashflow Ratio & Type Breakdown Card */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Cashflow Ratio & Category Breakdown</CardTitle>
            </div>
            <Badge variant="secondary">Zero Float Drift</Badge>
          </div>
          <CardDescription>
            Comparison of capital inflows versus deployed outflows and fees.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Segmented ratio bar */}
          <div className="w-full h-3 rounded-full overflow-hidden flex bg-secondary/60 p-0.5 border border-border/50">
            <div
              title={`Inflows: ${inflowRatio.toFixed(1)}%`}
              style={{ width: `${inflowRatio}%` }}
              className="h-full bg-emerald-500 rounded-l-full transition-all duration-300"
            />
            <div
              title={`Outflows: ${outflowRatio.toFixed(1)}%`}
              style={{ width: `${outflowRatio}%` }}
              className="h-full bg-rose-500 rounded-r-full transition-all duration-300"
            />
          </div>

          {/* Breakdown cards by type */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-1">
            <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/50">
              <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                Deposits
              </span>
              <p className="text-xs font-bold font-mono text-emerald-400 mt-0.5">
                {summary.breakdownByType.deposit.formatIndianCompact()}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/50">
              <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                Asset Buys
              </span>
              <p className="text-xs font-bold font-mono text-rose-400 mt-0.5">
                {summary.breakdownByType.buy.formatIndianCompact()}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/50">
              <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                Dividends
              </span>
              <p className="text-xs font-bold font-mono text-emerald-400 mt-0.5">
                {summary.breakdownByType.dividend.formatIndianCompact()}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/50">
              <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                Asset Sells
              </span>
              <p className="text-xs font-bold font-mono text-emerald-400 mt-0.5">
                {summary.breakdownByType.sell.formatIndianCompact()}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/50">
              <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                Withdrawals
              </span>
              <p className="text-xs font-bold font-mono text-rose-400 mt-0.5">
                {summary.breakdownByType.withdrawal.formatIndianCompact()}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/50">
              <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                Fees & STT
              </span>
              <p className="text-xs font-bold font-mono text-amber-400 mt-0.5">
                {summary.breakdownByType.fee.formatIndianCompact()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Audit Log Table */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Transaction Audit Log</CardTitle>
              <CardDescription>
                Chronological ledger of cashflow movements, asset trades, and dividend payouts.
              </CardDescription>
            </div>

            {/* Filter Pills and Search */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center rounded-lg bg-secondary/50 p-1 border border-border text-xs">
                {(['all', 'inflow', 'outflow', 'trades'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                      categoryFilter === cat
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-3 text-xs rounded-lg bg-secondary/50 border border-border focus:outline-none focus:ring-1 focus:ring-primary w-40 md:w-52 font-mono text-foreground"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingDb ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              Connecting to PostgreSQL and loading transaction ledger...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-secondary/60 mx-auto flex items-center justify-center text-muted-foreground">
                <Database className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">No transactions found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {activeTransactions.length === 0
                  ? 'Your transaction audit ledger is empty. Record your first event or seed sample cashflow.'
                  : 'No transactions matched the selected filter criteria.'}
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  Record Transaction
                </Button>
                {user && activeTransactions.length === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSeedStarterTransactions}
                    className="gap-1.5 text-xs font-mono"
                  >
                    Seed Starter Transactions
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-y border-border/80 bg-secondary/20 text-muted-foreground">
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">Date</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">Type</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">
                      Asset / Description
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                      Quantity
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                      Amount (₹)
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">
                      Audit Notes
                    </th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-center">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 font-mono">
                  {filteredTransactions.map((tx) => {
                    const isTxInflow = isInflow(tx.type);
                    const formattedDate = new Date(tx.transactionDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    });
                    const formattedAmount = (tx.amountCents / 100).toLocaleString('en-IN', {
                      style: 'currency',
                      currency: tx.currency || 'INR',
                    });

                    // Type color badges
                    const typeBadgeStyles: Record<
                      TransactionType,
                      { bg: string; text: string; label: string }
                    > = {
                      deposit: {
                        bg: 'bg-emerald-500/15 border-emerald-500/30',
                        text: 'text-emerald-400',
                        label: 'Deposit',
                      },
                      dividend: {
                        bg: 'bg-emerald-500/15 border-emerald-500/30',
                        text: 'text-emerald-400',
                        label: 'Dividend',
                      },
                      sell: {
                        bg: 'bg-teal-500/15 border-teal-500/30',
                        text: 'text-teal-400',
                        label: 'Sell',
                      },
                      buy: {
                        bg: 'bg-blue-500/15 border-blue-500/30',
                        text: 'text-blue-400',
                        label: 'Buy',
                      },
                      withdrawal: {
                        bg: 'bg-rose-500/15 border-rose-500/30',
                        text: 'text-rose-400',
                        label: 'Withdrawal',
                      },
                      fee: {
                        bg: 'bg-amber-500/15 border-amber-500/30',
                        text: 'text-amber-400',
                        label: 'Charges',
                      },
                    };

                    const badge = typeBadgeStyles[tx.type] || {
                      bg: 'bg-secondary',
                      text: 'text-foreground',
                      label: tx.type,
                    };

                    return (
                      <tr key={tx.id} className="hover:bg-secondary/30 transition-colors">
                        {/* Date */}
                        <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                          {formattedDate}
                        </td>

                        {/* Type Badge */}
                        <td className="py-3.5 px-4 font-sans whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg} ${badge.text}`}
                          >
                            {isTxInflow ? (
                              <ArrowDownLeft className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            {badge.label}
                          </span>
                        </td>

                        {/* Asset / Description */}
                        <td className="py-3.5 px-4 font-sans">
                          {tx.assetName ? (
                            <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                              {tx.assetName}
                              {tx.assetTicker && (
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary/80 border border-border text-primary font-bold">
                                  {tx.assetTicker}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground capitalize font-medium">
                              {tx.type}
                            </span>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="py-3.5 px-4 text-right text-foreground">
                          {tx.quantity !== undefined
                            ? tx.quantity.toLocaleString('en-IN', { maximumFractionDigits: 4 })
                            : '—'}
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 text-right font-bold whitespace-nowrap">
                          <span className={isTxInflow ? 'text-emerald-400' : 'text-rose-400'}>
                            {isTxInflow ? '+' : '-'}
                            {formattedAmount}
                          </span>
                        </td>

                        {/* Notes */}
                        <td className="py-3.5 px-4 font-sans text-xs text-muted-foreground max-w-xs truncate">
                          {tx.notes || '—'}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => {
                              if (confirm('Delete this transaction record from the audit log?')) {
                                deleteMutation.mutate(tx.id);
                              }
                            }}
                            title="Delete Transaction"
                            className="p-1.5 rounded-md text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Record Transaction Modal Component */}
      <RecordTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={async (values) => {
          await recordMutation.mutateAsync(values);
        }}
        isLoading={recordMutation.isPending}
        availableAssets={(userHoldings || []).map((h) => ({
          id: h.assetId,
          name: h.name,
          ticker: h.ticker,
        }))}
      />
    </div>
  );
}

export default TransactionsPage;
