import { useState, useEffect, useMemo } from 'react';
import { LiabilityDto } from '@wealthnest/application';
import { useLiabilityRepository } from '@/lib/persistence/repository-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { usePreferences } from '@/lib/preferences/preferences-context';
import { Button } from '@/components/ui/Button';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';
import { Badge } from '@/components/ui/Badge';
import { Money, bifurcateLoanPayment } from '@wealthnest/domain';
import { X, Landmark, AlertCircle, Sparkles } from 'lucide-react';

interface RecordEmiPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  liability: LiabilityDto | null;
  userId: string;
  onSuccess: () => void;
}

export function RecordEmiPaymentModal({
  isOpen,
  onClose,
  liability,
  userId,
  onSuccess,
}: RecordEmiPaymentModalProps) {
  const { currencySymbol, preferences } = usePreferences();
  const locale = preferences.numberFormat || 'en-IN';

  const [paymentAmountStr, setPaymentAmountStr] = useState('');
  const [extraPrepaymentStr, setExtraPrepaymentStr] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { activeHouseholdId, canEditFinancials } = useHousehold();
  const liabilityRepo = useLiabilityRepository();

  useEffect(() => {
    if (liability) {
      const emiRupees = Number(liability.emiAmountCents || 0n) / 100;
      setPaymentAmountStr(emiRupees.toString());
      setExtraPrepaymentStr('0');
      setPaymentDate(new Date().toISOString().split('T')[0]!);
      setNotes(`Monthly EMI Payment - ${liability.lender}`);
      setErrorMsg(null);
    }
  }, [liability, isOpen]);

  // Compute live split
  const calculation = useMemo(() => {
    if (!liability) return null;
    const currentBalance = Money.fromCents(liability.currentBalanceCents, 'INR');
    const paymentRupees = parseFloat(paymentAmountStr) || 0;
    const extraRupees = parseFloat(extraPrepaymentStr) || 0;

    const paymentMoney = Money.fromDecimal(paymentRupees, 'INR');
    const extraMoney = Money.fromDecimal(extraRupees, 'INR');

    return bifurcateLoanPayment(currentBalance, liability.interestRate, paymentMoney, extraMoney);
  }, [liability, paymentAmountStr, extraPrepaymentStr]);

  if (!isOpen || !liability) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calculation) return;

    if (!canEditFinancials) {
      setErrorMsg('Viewers have read-only access and cannot record EMI payments.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const newBalanceCents = calculation.remainingBalance.cents;
      const formattedNotes = notes.trim()
        ? `${notes.trim()} | EMI Bifurcation (Principal: ${currencySymbol}${calculation.principalPart.toDecimal().toLocaleString(locale)}, Interest: ${currencySymbol}${calculation.interestPart.toDecimal().toLocaleString(locale)})`
        : `EMI Payment (Principal: ${currencySymbol}${calculation.principalPart.toDecimal().toLocaleString(locale)}, Interest: ${currencySymbol}${calculation.interestPart.toDecimal().toLocaleString(locale)})`;

      // If atomic RPC method is available on repository adapter, use it for transactional integrity
      if (liabilityRepo.recordEmiPaymentAtomic) {
        const atomicRes = await liabilityRepo.recordEmiPaymentAtomic({
          liabilityId: liability.id,
          paymentDate,
          totalAmountCents: calculation.totalPayment.cents,
          principalCents: calculation.principalPart.cents,
          interestCents: calculation.interestPart.cents,
          extraPaymentCents: calculation.extraPayment.cents,
          newBalanceCents,
          notes: formattedNotes,
        });

        if (!atomicRes.success) {
          throw new Error(atomicRes.error?.message || 'Failed to record atomic EMI payment');
        }
      } else {
        // Fallback for local/offline SQLite adapter
        const balanceRes = await liabilityRepo.recordLiabilityBalance({
          liabilityId: liability.id,
          userId,
          householdId: activeHouseholdId,
          balanceCents: newBalanceCents,
          asOfDate: paymentDate,
          source: 'emi_bifurcation',
          notes: formattedNotes,
        });

        if (!balanceRes.success) {
          throw new Error(balanceRes.error?.message || 'Failed to record updated loan balance');
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while recording EMI');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveModalShell
      variant="sheet"
      role="dialog"
      ariaLabelledBy="record-emi-title"
      testId="record-emi-modal"
      backdropClassName="bg-black/70"
      panelClassName="max-w-lg bg-card border-border"
      onDismiss={onClose}
      formProps={{ onSubmit: handleSubmit }}
      header={
        <div className="flex items-center justify-between gap-2 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="record-emi-title" className="text-base sm:text-lg font-bold text-foreground">
                Record EMI Payment & Interest Split
              </h2>
              <p className="text-xs text-muted-foreground">
                {liability.name} • {liability.lender} ({liability.interestRate}% p.a.)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      }
      bodyClassName="space-y-4 p-4 sm:p-6"
      footer={
        <div className="flex items-center justify-end gap-3 px-4 py-3 sm:px-6 border-t border-border bg-card">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !canEditFinancials}
            className="min-w-[130px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold"
          >
            {isSubmitting ? 'Recording...' : 'Record Payment'}
          </Button>
        </div>
      }
    >
      {errorMsg && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Scheduled EMI Amount ({currencySymbol}) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                required
                value={paymentAmountStr}
                onChange={(e) => setPaymentAmountStr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-sm font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Extra Principal Prepayment ({currencySymbol})
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={extraPrepaymentStr}
                onChange={(e) => setExtraPrepaymentStr(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-sm font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Payment Date <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
          </div>

          {/* Dynamic EMI Accounting Split Card */}
          {calculation && (
            <div className="p-4 rounded-xl bg-secondary/40 border border-border/80 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Automated Accounting Bifurcation
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Zero Float Drift
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <span className="text-[10px] text-rose-300 block font-sans">
                    Interest Expense
                  </span>
                  <span className="text-sm font-bold text-rose-400">
                    {currencySymbol}
                    {calculation.interestPart
                      .toDecimal()
                      .toLocaleString(locale, { maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] text-emerald-300 block font-sans">
                    Principal Paid
                  </span>
                  <span className="text-sm font-bold text-emerald-400">
                    {currencySymbol}
                    {calculation.principalPart
                      .toDecimal()
                      .toLocaleString(locale, { maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-blue-300 block font-sans">New Balance</span>
                  <span className="text-sm font-bold text-foreground">
                    {currencySymbol}
                    {calculation.remainingBalance
                      .toDecimal()
                      .toLocaleString(locale, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Interest is charged against income as an expense; principal reduction reduces debt
                balance directly.
              </p>
            </div>
          )}
    </ResponsiveModalShell>
  );
}
