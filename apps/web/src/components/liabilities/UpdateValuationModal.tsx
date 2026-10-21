import { useState, useEffect } from 'react';
import { SupabaseLiabilityAdapter } from '@/lib/supabase/liability.adapter';
import { Button } from '@/components/ui/Button';
import { X, Building2, AlertCircle } from 'lucide-react';

interface UpdateValuationModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string;
  assetName: string;
  currentValuationCents: bigint;
  userId: string;
  onSuccess: () => void;
}

export function UpdateValuationModal({
  isOpen,
  onClose,
  assetId,
  assetName,
  currentValuationCents,
  userId,
  onSuccess,
}: UpdateValuationModalProps) {
  const [valuationStr, setValuationStr] = useState('');
  const [asOfDate, setAsOfDate] = useState('');
  const [source, setSource] = useState('manual_appraisal');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (assetId) {
      setValuationStr((Number(currentValuationCents) / 100).toString());
      setAsOfDate(new Date().toISOString().split('T')[0]!);
      setSource('manual_appraisal');
      setNotes('');
      setErrorMsg(null);
    }
  }, [assetId, currentValuationCents, isOpen]);

  if (!isOpen || !assetId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const val = parseFloat(valuationStr);
    if (isNaN(val) || val < 0) {
      setErrorMsg('Please enter a valid property valuation (₹0 or greater).');
      return;
    }

    if (!asOfDate) {
      setErrorMsg('Please select a valid valuation date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const adapter = new SupabaseLiabilityAdapter();
      const res = await adapter.recordAssetValuation({
        assetId,
        userId,
        valuationCents: BigInt(Math.round(val * 100)),
        asOfDate,
        source,
        notes: notes.trim() || undefined,
      });

      if (!res.success) {
        throw res.error;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record property valuation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Update Property Appraisal
              </h2>
              <p className="text-xs text-muted-foreground">{assetName}</p>
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
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              New Appraised Value (₹) <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              step="any"
              required
              value={valuationStr}
              onChange={(e) => setValuationStr(e.target.value)}
              placeholder="e.g. 8500000"
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors font-mono font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Valuation / Appraisal Date <span className="text-destructive">*</span>
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
                Appraisal Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              >
                <option value="manual_appraisal">Market Valuation / Appraisal</option>
                <option value="government_jntr">Government Jantri / Circle Rate</option>
                <option value="bank_valuation">Bank Loan Revaluation</option>
                <option value="registry">Registry / Purchase Deed</option>
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
              placeholder="e.g. Based on recent transactions in Bakeri City / Vejalpur"
              className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
              {isSubmitting ? 'Updating...' : 'Update Valuation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
