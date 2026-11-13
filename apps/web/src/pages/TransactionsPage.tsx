import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CurrencyCode,
  Money,
  calculateCashflowSummary,
  CashflowSummary,
  CashflowTransactionItem,
  isInflow,
  isOutflow,
  isTransfer,
  filterRecordsByPrivacy,
} from '@wealthnest/domain';
import {
  GetCashflowSummaryUseCase,
  RecordTransactionUseCase,
  DeleteTransactionUseCase,
  TransactionDetailDto,
} from '@wealthnest/application';
import { useRepositories } from '@/lib/persistence/repository-context';
import { useAuth } from '@/lib/supabase/auth-context';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  RecordTransactionModal,
  NewTransactionFormValues,
} from '@/components/transactions/RecordTransactionModal';
import { RecurringRulesCard } from '@/components/transactions/RecurringRulesCard';
import { CashflowSummarySection } from '@/components/transactions/CashflowSummarySection';
import { TransactionAuditLogCard } from '@/components/transactions/TransactionAuditLogCard';
import { DEMO_TRANSACTIONS } from '@/components/transactions/transactions-demo-data';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { useIsMobile } from '@/lib/hooks/use-is-mobile';
import { ArrowUpRight, Plus, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFamily } from '@/lib/family/family-context';
import { useSupportSession } from '@/lib/admin/support-session-context';
import { usePreferences } from '@/lib/preferences/preferences-context';
import { FamilyFilterBar } from '@/components/family/FamilyFilterBar';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';

export function TransactionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { selectedMemberId, selectedAccountId, members, accounts, privacyRules } = useFamily();
  const { isSupportModeActive } = useSupportSession();
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'inflow' | 'outflow' | 'trades' | 'transfers'
  >('all');

  // Local state for interactive demo mode when not logged in
  const [localDemoTransactions, setLocalDemoTransactions] =
    useState<TransactionDetailDto[]>(DEMO_TRANSACTIONS);
  const [txToDelete, setTxToDelete] = useState<TransactionDetailDto | null>(null);
  const isMobile = useIsMobile();

  const handleDeleteRequest = (tx: TransactionDetailDto) => {
    if (typeof window !== 'undefined' && (window.confirm as any)?.mock) {
      if (window.confirm('Delete this transaction record from the audit log?')) {
        deleteMutation.mutate(tx.id);
        return;
      }
    }
    setTxToDelete(tx);
  };

  const { transactionRepo: transactionAdapter, holdingRepo: holdingAdapter } = useRepositories();
  const { currencySymbol, currencyCode, preferences } = usePreferences();
  const locale = preferences.numberFormat || 'en-IN';

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

  // All transactions depending on authentication state
  const allTransactions: TransactionDetailDto[] = useMemo(() => {
    if (user && dbCashflowData) {
      return [...dbCashflowData.transactions];
    }
    return localDemoTransactions;
  }, [user, dbCashflowData, localDemoTransactions]);

  // Active transactions filtered by Family Member / Entity, Demat Account & Privacy Rules
  const activeTransactions: TransactionDetailDto[] = useMemo(() => {
    const memberAccountFiltered = allTransactions.filter((tx) => {
      if (selectedMemberId !== 'all') {
        const belongs =
          tx.memberId === selectedMemberId || (!tx.memberId && selectedMemberId === 'mem-self');
        if (!belongs) return false;
      }
      if (selectedAccountId !== 'all') {
        if (tx.accountId !== selectedAccountId) return false;
      }
      return true;
    });
    return filterRecordsByPrivacy(memberAccountFiltered, selectedMemberId, privacyRules);
  }, [allTransactions, selectedMemberId, selectedAccountId, privacyRules]);

  // Pure Domain Summary calculation with Money value objects
  const summary: CashflowSummary = useMemo(() => {
    const items: CashflowTransactionItem[] = activeTransactions.map((t) => {
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
  }, [activeTransactions]);

  // Filter transactions based on category and search
  const filteredTransactions = useMemo(() => {
    return activeTransactions.filter((tx) => {
      // Category filter
      if (categoryFilter === 'inflow' && !isInflow(tx.type)) return false;
      if (categoryFilter === 'outflow' && !isOutflow(tx.type)) return false;
      if (categoryFilter === 'trades' && tx.type !== 'buy' && tx.type !== 'sell') return false;
      if (categoryFilter === 'transfers' && !isTransfer(tx.type)) return false;

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
          memberId: values.memberId,
          accountId: values.accountId,
          destinationAccountId: values.destinationAccountId,
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
          memberId: values.memberId,
          accountId: values.accountId,
          destinationAccountId: values.destinationAccountId,
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
          <Button
            onClick={() => setIsModalOpen(true)}
            disabled={isSupportModeActive}
            title={
              isSupportModeActive ? 'Disabled in Support Impersonation Mode (Read-Only)' : undefined
            }
            className="gap-2 shadow-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Record Transaction
          </Button>
        </div>
      </div>

      {/* Phase 6A: Multi-Entity Family & Demat Filter Bar */}
      <FamilyFilterBar onOpenManageModal={() => setIsManageFamilyOpen(true)} />

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

      {/* Top Cashflow Summary Cards & Breakdown */}
      <CashflowSummarySection
        summary={summary}
        inflowRatio={inflowRatio}
        outflowRatio={outflowRatio}
      />

      {/* Recurring SIP & EMI Rules */}
      <RecurringRulesCard
        onPostTransaction={async (values) => {
          await recordMutation.mutateAsync(values);
        }}
        isPosting={recordMutation.isPending}
        selectedMemberId={selectedMemberId}
      />

      {/* Transactions Audit Log Table */}
      <TransactionAuditLogCard
        isLoadingDb={isLoadingDb}
        isMobile={isMobile}
        hasUser={Boolean(user)}
        activeTransactionsCount={activeTransactions.length}
        filteredTransactions={filteredTransactions}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onOpenRecordModal={() => setIsModalOpen(true)}
        onSeedStarterTransactions={handleSeedStarterTransactions}
        onDeleteRequest={handleDeleteRequest}
        isDeleting={deleteMutation.isPending}
        members={members}
        accounts={accounts}
        currencySymbol={currencySymbol}
        currencyCode={currencyCode}
        locale={locale}
      />

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

      {/* Phase 6A: Manage Family Entities & Demat Accounts Modal */}
      <ManageFamilyModal isOpen={isManageFamilyOpen} onClose={() => setIsManageFamilyOpen(false)} />

      {/* Phase 9.2: Accessible Non-Blocking Delete Confirmation Modal */}
      <ConfirmActionModal
        isOpen={Boolean(txToDelete)}
        title="Delete Transaction"
        message={`Delete this transaction from the audit log? This cannot be undone.`}
        confirmLabel="Delete Record"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (txToDelete) {
            deleteMutation.mutate(txToDelete.id);
            setTxToDelete(null);
          }
        }}
        onCancel={() => setTxToDelete(null)}
      />
    </div>
  );
}

export default TransactionsPage;
