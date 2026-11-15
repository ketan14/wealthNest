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
import { useHousehold } from '@/lib/supabase/household-context';
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
  const { activeHouseholdId, canEditFinancials } = useHousehold();
  const { transactionRepo: transactionAdapter, holdingRepo: holdingAdapter, mode } = useRepositories();
  const queryClient = useQueryClient();
  const { selectedMemberId, selectedAccountId, members, accounts, privacyRules } = useFamily();
  const { isSupportModeActive } = useSupportSession();
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'inflow' | 'outflow' | 'trades' | 'transfers'
  >('all');

  const isDemoMode = mode === 'supabase' && (!user?.id || user.id.startsWith('demo-'));
  const hasLiveBackend = !isDemoMode && Boolean(activeHouseholdId || user?.id);
  const scopeId = activeHouseholdId || user?.id || '';

  // Local state for interactive demo mode when not logged in
  const [localDemoTransactions, setLocalDemoTransactions] =
    useState<TransactionDetailDto[]>(DEMO_TRANSACTIONS);
  const [txToDelete, setTxToDelete] = useState<TransactionDetailDto | null>(null);
  const isMobile = useIsMobile();

  const handleDeleteRequest = (tx: TransactionDetailDto) => {
    if (!canEditFinancials || isSupportModeActive) return;
    if (typeof window !== 'undefined' && (window.confirm as any)?.mock) {
      if (window.confirm('Delete this transaction record from the audit log?')) {
        deleteMutation.mutate(tx.id);
        return;
      }
    }
    setTxToDelete(tx);
  };

  const { currencySymbol, currencyCode, preferences } = usePreferences();
  const locale = preferences.numberFormat || 'en-IN';

  // Query user holdings for asset dropdown in modal
  const { data: userHoldings } = useQuery({
    queryKey: ['user-holdings', scopeId],
    queryFn: async () => {
      if (!scopeId) return [];
      const res = await (holdingAdapter.listDetailsByHousehold
        ? holdingAdapter.listDetailsByHousehold(scopeId)
        : holdingAdapter.listDetailsByUser(scopeId));
      return res.success ? res.value : [];
    },
    enabled: hasLiveBackend,
  });

  // Query authenticated transactions from Supabase via Clean Architecture Use Case
  const {
    data: dbCashflowData,
    isLoading: isLoadingDb,
    refetch,
  } = useQuery({
    queryKey: ['transactions-cashflow', scopeId],
    queryFn: async () => {
      if (!scopeId) return null;
      const useCase = new GetCashflowSummaryUseCase(transactionAdapter);
      const res = await useCase.execute(scopeId, 'INR');
      if (!res.success) throw res.error;
      return res.value;
    },
    enabled: hasLiveBackend,
  });

  // All transactions depending on authentication / persistence state
  const allTransactions: TransactionDetailDto[] = useMemo(() => {
    if (hasLiveBackend) {
      return Array.isArray(dbCashflowData?.transactions) ? [...dbCashflowData.transactions] : [];
    }
    return localDemoTransactions;
  }, [hasLiveBackend, dbCashflowData, localDemoTransactions]);

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

      if (hasLiveBackend) {
        if (!canEditFinancials) {
          throw new Error('View-only household role cannot record transactions.');
        }
        // Authenticated / SQLite: Persist to active household with automated holding synchronization
        const useCase = new RecordTransactionUseCase(transactionAdapter, holdingAdapter);
        const res = await useCase.execute({
          userId: user?.id || scopeId || 'local-user',
          householdId: activeHouseholdId || undefined,
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
          visibility: values.visibility,
          restrictedGranteeUserIds: values.restrictedGranteeUserIds,
        });

        if (!res.success) throw res.error;
        return res.value;
      } else {
        // Demo Mode: Add into local state
        const newDemoItem: TransactionDetailDto = {
          id: `demo-tx-${Date.now()}`,
          userId: 'demo-user',
          householdId: activeHouseholdId || 'demo-household-vaghela',
          visibility: values.visibility ?? 'household_shared',
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
      if (hasLiveBackend) {
        queryClient.invalidateQueries({ queryKey: ['transactions-cashflow'] });
        queryClient.invalidateQueries({ queryKey: ['cashflow-summary'] });
        queryClient.invalidateQueries({ queryKey: ['user-holdings'] });
        queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
        queryClient.invalidateQueries({ queryKey: ['holdings'] });
      }
    },
  });

  // Mutation: Delete Transaction
  const deleteMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      if (transactionId.startsWith('demo-') || !hasLiveBackend) {
        setLocalDemoTransactions((prev) => prev.filter((t) => t.id !== transactionId));
        return;
      }
      if (!canEditFinancials) {
        throw new Error('View-only household role cannot delete transactions.');
      }
      const useCase = new DeleteTransactionUseCase(transactionAdapter);
      const res = await useCase.execute(transactionId, scopeId || user?.id || '');
      if (!res.success) throw res.error;
    },
    onSuccess: () => {
      if (hasLiveBackend) {
        queryClient.invalidateQueries({ queryKey: ['transactions-cashflow'] });
        queryClient.invalidateQueries({ queryKey: ['cashflow-summary'] });
      }
    },
  });

  // Seed sample starter transactions for active household
  const handleSeedStarterTransactions = async () => {
    if (!hasLiveBackend || !canEditFinancials) return;
    for (const tx of DEMO_TRANSACTIONS.slice(0, 4)) {
      const useCase = new RecordTransactionUseCase(transactionAdapter);
      await useCase.execute({
        userId: user?.id || scopeId || 'local-user',
        householdId: activeHouseholdId || undefined,
        visibility: 'household_shared',
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
            <Badge
              variant={hasLiveBackend ? 'success' : 'secondary'}
              className="font-mono text-[10px]"
            >
              {hasLiveBackend ? 'Database Active' : 'Demo Mode'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cashflow audit log, capital inflows, asset acquisitions, payouts, and statutory charges.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              if (canEditFinancials && !isSupportModeActive) setIsModalOpen(true);
            }}
            disabled={isSupportModeActive || !canEditFinancials}
            title={
              isSupportModeActive
                ? 'Disabled in Support Impersonation Mode (Read-Only)'
                : !canEditFinancials
                  ? 'View-only household role cannot record transactions'
                  : undefined
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
      {!hasLiveBackend && (
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
          if (!canEditFinancials || isSupportModeActive) {
            throw new Error('View-only household role cannot post recurring transactions.');
          }
          await recordMutation.mutateAsync(values);
        }}
        isPosting={recordMutation.isPending}
        selectedMemberId={selectedMemberId}
      />

      {/* Transactions Audit Log Table */}
      <TransactionAuditLogCard
        isLoadingDb={isLoadingDb}
        isMobile={isMobile}
        hasUser={hasLiveBackend}
        canEditFinancials={canEditFinancials}
        activeTransactionsCount={activeTransactions.length}
        filteredTransactions={filteredTransactions}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onOpenRecordModal={() => {
          if (canEditFinancials && !isSupportModeActive) setIsModalOpen(true);
        }}
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
