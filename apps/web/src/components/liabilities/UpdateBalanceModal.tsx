import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LiabilityDto } from '@wealthnest/application';
import { SupabaseLiabilityAdapter } from '@/lib/supabase/liability.adapter';
import { Button } from '@/components/ui/Button';
import { X, History, AlertCircle, ArrowDownCircle } from 'lucide-react';

interface UpdateBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  liability: LiabilityDto | null;
  userId: string;
  onSuccess: () => void;
}

export function UpdateBalanceModal({
  isOpen,
  onClose,
  liability,
  userId,
  onSuccess,
}: UpdateBalanceModalProps) {
  const [balanceStr, setBalanceStr] = useState('');
  const [asOfDate, setAsOfDate] = useState('');
  const [source, setSource] = useState('loan_statement');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch historical balances for this liability
  const { data: balanceHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['liability-balances', liability?.id],
    queryFn: async () => {
      if (!liability) return [];
      const adapter = new SupabaseLiabilityAdapter();
      const res = await adapter.listLiabilityBalances(liability.id, userId);
      return res.success ? res.value : [];
    },
    enabled: isOpen && Boolean(liability),
  });

  useEffect(() => {
    if (liability) {
      setBalanceStr((Number(liability.currentBalanceCents) / 100).toString());
      setAsOfDate(new Date().toISOString().split('T')[0]!);
      setSource('loan_statement');
      setNotes('');
      setErrorMsg(null);
    }
  }, [liability, isOpen]);

  if (!isOpen || !liability) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const balance = parseFloat(balanceStr);
    if (isNaN(balance) || balance < 0) {
      setErrorMsg('Please enter a valid outstanding balance (₹0 or greater).');
      return;
    }

    if (!asOfDate) {
      setErrorMsg('Please select a valid as-of date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const adapter = new SupabaseLiabilityAdapter();
      const res = await adapter.recordLiabilityBalance({
        liabilityId: liability.id,
        userId,
        balanceCents: BigInt(Math.round(balance * 100)),
        asOfDate,
        source,
        notes: notes.trim() || undefined,
      });

      if (!res.success) {
        throw res.error;
      }

      await refetchHistory();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record balance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <ArrowDownCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Update Loan Balance
              </h2>
              <p className="text-xs text-muted-foreground">
                {liability.name} • {liability.lender}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-accent/40 border border-border/80 text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Original Sanctioned:</span>
              <span className="font-mono font-medium text-foreground">
                ₹{(Number(liability.originalPrincipalCents) / 100).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Last Recorded Balance:</span>
              <span className="font-mono font-medium text-primary">
                ₹{(Number(liability.currentBalanceCents) / 100).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              New Outstanding Principal Balance (₹) <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              step="any"
              required
              value={balanceStr}
              onChange={(e) => setBalanceStr(e.target.value)}
              placeholder="e.g. 4250000"
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors font-mono font-semibold"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Enter the exact outstanding principal balance from your latest loan statement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                As of Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                required
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Balance Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              >
                <option value="loan_statement">Bank / Loan Statement</option>
                <option value="net_banking">NetBanking App / Portal</option>
                <option value="amortization">Amortization Schedule</option>
                <option value="manual">Manual Estimate</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. After October EMI + ₹50,000 prepayment"
              className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
          </div>

          {/* Balance History audit log */}
          {balanceHistory && balanceHistory.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
                <History className="w-3.5 h-3.5" />
                <span>Recorded Balance History ({balanceHistory.length})</span>
              </div>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-border/80 divide-y divide-border/60 text-xs font-mono">
                {balanceHistory.map((b) => (
                  <div
                    key={b.id}
                    className="p-2.5 flex items-center justify-between hover:bg-accent/30"
                  >
                    <div>
                      <span className="font-semibold text-foreground">
                        ₹{(Number(b.balanceCents) / 100).toLocaleString('en-IN')}
                      </span>
                      {b.notes && (
                        <span className="text-[11px] text-muted-foreground ml-2">({b.notes})</span>
                      )}
                    </div>
                    <div className="text-right text-muted-foreground">
                      <span>{b.asOfDate}</span>
                      <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded bg-muted">
                        {b.source}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
              {isSubmitting ? 'Recording...' : 'Record Balance'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
