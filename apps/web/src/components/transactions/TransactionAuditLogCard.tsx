import { TransactionType, isInflow, isTransfer } from '@wealthnest/domain';
import {
  FamilyMemberDto,
  PortfolioAccountDto,
  TransactionDetailDto,
} from '@wealthnest/application';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { ArrowDownLeft, ArrowUpRight, Database, Plus, Scale, Search, Trash2 } from 'lucide-react';

export type TransactionCategoryFilter = 'all' | 'inflow' | 'outflow' | 'trades' | 'transfers';

interface TransactionAuditLogCardProps {
  readonly isLoadingDb: boolean;
  readonly isMobile: boolean;
  readonly hasUser: boolean;
  readonly activeTransactionsCount: number;
  readonly filteredTransactions: readonly TransactionDetailDto[];
  readonly categoryFilter: TransactionCategoryFilter;
  readonly onCategoryFilterChange: (cat: TransactionCategoryFilter) => void;
  readonly searchQuery: string;
  readonly onSearchQueryChange: (query: string) => void;
  readonly onOpenRecordModal: () => void;
  readonly onSeedStarterTransactions: () => void;
  readonly onDeleteRequest: (tx: TransactionDetailDto) => void;
  readonly isDeleting: boolean;
  readonly members: readonly FamilyMemberDto[];
  readonly accounts: readonly PortfolioAccountDto[];
  readonly currencySymbol: string;
  readonly currencyCode: string;
  readonly locale: string;
}

const TYPE_BADGE_STYLES: Record<TransactionType, { bg: string; text: string; label: string }> = {
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
  transfer: {
    bg: 'bg-purple-500/15 border-purple-500/30',
    text: 'text-purple-400',
    label: 'Transfer',
  },
};

export function TransactionAuditLogCard({
  isLoadingDb,
  isMobile,
  hasUser,
  activeTransactionsCount,
  filteredTransactions,
  categoryFilter,
  onCategoryFilterChange,
  searchQuery,
  onSearchQueryChange,
  onOpenRecordModal,
  onSeedStarterTransactions,
  onDeleteRequest,
  isDeleting,
  members,
  accounts,
  currencySymbol,
  currencyCode,
  locale,
}: TransactionAuditLogCardProps) {
  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Transaction Audit Log</CardTitle>
            <CardDescription>
              Chronological ledger of cashflow movements, asset trades, and dividend payouts.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center rounded-lg bg-secondary/50 p-1 border border-border text-xs">
              {(['all', 'inflow', 'outflow', 'trades', 'transfers'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => onCategoryFilterChange(cat)}
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
                onChange={(e) => onSearchQueryChange(e.target.value)}
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
              {activeTransactionsCount === 0
                ? 'Your transaction audit ledger is empty. Record your first event or seed sample cashflow.'
                : 'No transactions matched the selected filter criteria.'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button size="sm" onClick={onOpenRecordModal} className="gap-1.5">
                <Plus className="w-4 h-4" />
                Record Transaction
              </Button>
              {hasUser && activeTransactionsCount === 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSeedStarterTransactions}
                  className="gap-1.5 text-xs font-mono"
                >
                  Seed Starter Transactions
                </Button>
              )}
            </div>
          </div>
        ) : isMobile ? (
          <div className="space-y-3 p-4">
            {filteredTransactions.map((tx) => (
              <TransactionCard
                key={tx.id}
                transaction={tx}
                onDelete={() => onDeleteRequest(tx)}
                isDeleting={isDeleting}
              />
            ))}
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
                    Amount ({currencySymbol})
                  </th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Audit Notes</th>
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
                  const formattedAmount = (tx.amountCents / 100).toLocaleString(locale, {
                    style: 'currency',
                    currency: tx.currency || currencyCode,
                  });
                  const badge = TYPE_BADGE_STYLES[tx.type] || {
                    bg: 'bg-secondary',
                    text: 'text-foreground',
                    label: tx.type,
                  };
                  const mem = members.find((m) => m.id === (tx.memberId || 'mem-self'));
                  const acc = accounts.find((a) => a.id === tx.accountId);
                  const destAcc = accounts.find((a) => a.id === tx.destinationAccountId);

                  return (
                    <tr key={tx.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                        {formattedDate}
                      </td>
                      <td className="py-3.5 px-4 font-sans whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg} ${badge.text}`}
                        >
                          {isTxInflow ? (
                            <ArrowDownLeft className="w-3 h-3" />
                          ) : isTransfer(tx.type) ? (
                            <Scale className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          {badge.label}
                        </span>
                      </td>
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
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: mem.colorHex }}
                              />
                              {mem.name.split(' ')[0]} {mem.relationship === 'huf' ? 'HUF' : ''}
                            </span>
                          )}
                          {acc && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground font-mono border border-border">
                              {acc.brokerName}
                            </span>
                          )}
                          {destAcc && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 font-mono border border-purple-500/20">
                              → {destAcc.brokerName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right text-foreground">
                        {tx.quantity !== undefined
                          ? tx.quantity.toLocaleString('en-IN', { maximumFractionDigits: 4 })
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold whitespace-nowrap">
                        <span
                          className={
                            isTransfer(tx.type)
                              ? 'text-purple-400'
                              : isTxInflow
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                          }
                        >
                          {isTransfer(tx.type) ? '⇄ ' : isTxInflow ? '+' : '-'}
                          {formattedAmount}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-sans text-xs text-muted-foreground max-w-xs truncate">
                        {tx.notes || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => onDeleteRequest(tx)}
                          title="Delete Transaction"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center mx-auto"
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
  );
}

