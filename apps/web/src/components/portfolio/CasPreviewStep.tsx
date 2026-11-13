import { AlertCircle, Users, Briefcase, RotateCcw, Loader2 } from 'lucide-react';
import { CasPreviewDto, ImportCasItemDto, ImportCasTransactionDto } from '@wealthnest/application';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CasPreviewTables } from '@/components/portfolio/CasPreviewTables';

interface FamilyMemberOption {
  id: string;
  name: string;
  relationship: string;
}

interface DematAccountOption {
  id: string;
  memberId: string;
  brokerName: string;
  accountName: string;
}

interface CasPreviewStepProps {
  previewData: CasPreviewDto;
  members: FamilyMemberOption[];
  accounts: DematAccountOption[];
  relevantAccounts: DematAccountOption[];
  importMemberId: string;
  importAccountId: string;
  activeTab: 'equities' | 'mutual_funds' | 'transactions';
  equities: ImportCasItemDto[];
  selectedEquities: ImportCasItemDto[];
  equitiesSelectedValueCents: number;
  equitiesTotalValueCents: number;
  mutualFunds: ImportCasItemDto[];
  selectedMutualFunds: ImportCasItemDto[];
  mfSelectedValueCents: number;
  mfTotalValueCents: number;
  mfFolioCountsByIsin: Map<string, number>;
  transactions: ImportCasTransactionDto[];
  selectedCount: number;
  selectedTransactionsCount: number;
  isConfirmPending: boolean;
  onMemberChange: (memberId: string, firstAccountId: string) => void;
  onAccountChange: (accountId: string) => void;
  onTabChange: (tab: 'equities' | 'mutual_funds' | 'transactions') => void;
  onToggleItem: (item: ImportCasItemDto) => void;
  onSelectAllEquities: (select: boolean) => void;
  onSelectAllMutualFunds: (select: boolean) => void;
  onToggleTransaction: (index: number) => void;
  onSelectAllTransactions: (select: boolean) => void;
  onBack: () => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function CasPreviewStep({
  previewData,
  members,
  accounts,
  relevantAccounts,
  importMemberId,
  importAccountId,
  activeTab,
  equities,
  selectedEquities,
  equitiesSelectedValueCents,
  equitiesTotalValueCents,
  mutualFunds,
  selectedMutualFunds,
  mfSelectedValueCents,
  mfTotalValueCents,
  mfFolioCountsByIsin,
  transactions,
  selectedCount,
  selectedTransactionsCount,
  isConfirmPending,
  onMemberChange,
  onAccountChange,
  onTabChange,
  onToggleItem,
  onSelectAllEquities,
  onSelectAllMutualFunds,
  onToggleTransaction,
  onSelectAllTransactions,
  onBack,
  onClose,
  onConfirm,
}: CasPreviewStepProps) {
  return (
    <div className="space-y-4 pt-4 flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Statement Metadata Summary */}
      <div className="p-3 rounded-xl bg-secondary/40 border border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Provider:</span>
          <Badge variant="success" className="font-mono text-xs">
            {previewData.provider.replace('_', '/')}{' '}
            {previewData.provider === 'ZERODHA' || previewData.provider === 'GROWW'
              ? 'Statement'
              : 'CAS'}
          </Badge>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span className="text-muted-foreground">Statement Date:</span>
          <span className="font-semibold text-foreground">{previewData.statementDate}</span>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span className="text-muted-foreground">Reported Value:</span>
          <span className="font-bold text-emerald-400">
            ₹
            {(previewData.totalReportedValueCents / 100).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      {previewData.warnings.length > 0 && (
        <details className="rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 p-2.5 group">
          <summary className="flex items-center justify-between cursor-pointer font-semibold text-amber-400 select-none">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Statement Parser Notice ({previewData.warnings.length})</span>
            </div>
            <span className="text-[10px] text-amber-400/80 group-open:rotate-180 transition-transform">
              ▼ Click to view
            </span>
          </summary>
          <div className="mt-2 space-y-1 max-h-24 overflow-y-auto pl-5 pr-2">
            {previewData.warnings.map((w, i) => (
              <p key={i} className="text-[11px] text-amber-200/90 leading-relaxed">
                • {w}
              </p>
            ))}
            <p className="text-[11px] text-muted-foreground pt-0.5">
              Closed folios with 0 balance can be ignored safely. If you hold units in an
              unextracted scheme, you can still import the rest of your portfolio now and add that
              scheme anytime via &quot;Add Holding&quot;.
            </p>
          </div>
        </details>
      )}

      {/* Phase 6A: Legal Entity & Demat Account Assignment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-secondary/30 border border-border/60">
        <div>
          <label
            htmlFor="import-member-select"
            className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5 text-blue-400" />
            Assign To Legal Entity / Member
          </label>
          <select
            id="import-member-select"
            value={importMemberId}
            onChange={(e) => {
              const firstAcc = accounts.find((a) => a.memberId === e.target.value);
              onMemberChange(e.target.value, firstAcc?.id || '');
            }}
            className="w-full h-8 rounded-lg bg-secondary/50 border border-border px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id} className="bg-slate-900 text-foreground">
                {m.name} ({m.relationship.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="import-account-select"
            className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5"
          >
            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
            Assign Demat / Broker Account
          </label>
          <select
            id="import-account-select"
            value={importAccountId}
            onChange={(e) => onAccountChange(e.target.value)}
            className="w-full h-8 rounded-lg bg-secondary/50 border border-border px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="" className="bg-slate-900 text-foreground">
              -- Auto / Statement Folios --
            </option>
            {relevantAccounts.map((a) => (
              <option key={a.id} value={a.id} className="bg-slate-900 text-foreground">
                {a.brokerName}: {a.accountName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab Navigation: Direct Equities, Mutual Funds, Historical Transactions */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-2">
        <button
          type="button"
          onClick={() => onTabChange('equities')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'equities'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>Direct Equities & ETFs</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-background/30 text-current font-bold">
            {equities.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('mutual_funds')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'mutual_funds'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>Mutual Funds</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-background/30 text-current font-bold">
            {mutualFunds.length}
          </span>
        </button>

        {transactions.length > 0 && (
          <button
            type="button"
            onClick={() => onTabChange('transactions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'transactions'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Historical Transactions</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              {transactions.length}
            </span>
          </button>
        )}
      </div>

      <CasPreviewTables
        activeTab={activeTab}
        equities={equities}
        selectedEquities={selectedEquities}
        equitiesSelectedValueCents={equitiesSelectedValueCents}
        equitiesTotalValueCents={equitiesTotalValueCents}
        mutualFunds={mutualFunds}
        selectedMutualFunds={selectedMutualFunds}
        mfSelectedValueCents={mfSelectedValueCents}
        mfTotalValueCents={mfTotalValueCents}
        mfFolioCountsByIsin={mfFolioCountsByIsin}
        transactions={transactions}
        selectedTransactionsCount={selectedTransactionsCount}
        onToggleItem={onToggleItem}
        onSelectAllEquities={onSelectAllEquities}
        onSelectAllMutualFunds={onSelectAllMutualFunds}
        onToggleTransaction={onToggleTransaction}
        onSelectAllTransactions={onSelectAllTransactions}
      />

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border/80">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-xs">
          <RotateCcw className="w-3.5 h-3.5" />
          Back to Upload
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={(selectedCount === 0 && selectedTransactionsCount === 0) || isConfirmPending}
            onClick={onConfirm}
            className="gap-2"
          >
            {isConfirmPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm & Import ({selectedEquities.length} Equities, {selectedMutualFunds.length}{' '}
            Mutual Funds
            {selectedTransactionsCount > 0 ? `, ${selectedTransactionsCount} txs` : ''})
          </Button>
        </div>
      </div>
    </div>
  );
}
