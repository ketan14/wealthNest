import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';
import { formatInr } from '@/utils/formatInr';
import { PlusCircle, X } from 'lucide-react';

export interface TopUpTargetGoal {
  readonly id: string;
  readonly name: string;
  readonly currentSavedCents: number;
  readonly currentTotalCorpusCents: number;
  readonly targetAmountCents: number;
}

interface TopUpGoalModalProps {
  readonly goal: TopUpTargetGoal | null;
  readonly isSubmitting?: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (goalId: string, additionalCents: number) => Promise<void>;
}

const PRESET_TOPUP_RUPEES = [5000, 10000, 25000, 50000] as const;

export function TopUpGoalModal({
  goal,
  isSubmitting = false,
  onClose,
  onConfirm,
}: TopUpGoalModalProps) {
  const [amountRupees, setAmountRupees] = useState('10000');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (goal) {
      setAmountRupees('10000');
      setError(null);
    }
  }, [goal]);

  if (!goal) return null;

  const parsedRupees = parseFloat(amountRupees);
  const additionalCents = Number.isFinite(parsedRupees) && parsedRupees > 0 ? Math.round(parsedRupees * 100) : 0;
  const currentTotalRupees = goal.currentTotalCorpusCents / 100;
  const targetRupees = goal.targetAmountCents / 100;
  const nextTotalRupees = currentTotalRupees + additionalCents / 100;
  const nextFundedPct =
    targetRupees > 0 ? Math.min(100, (nextTotalRupees / targetRupees) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!Number.isFinite(parsedRupees) || parsedRupees <= 0) {
      setError('Enter a contribution amount greater than ₹0.');
      return;
    }

    try {
      await onConfirm(goal.id, Math.round(parsedRupees * 100));
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save contribution.');
    }
  };

  return (
    <ResponsiveModalShell
      role="dialog"
      ariaLabelledBy="top-up-goal-title"
      backdropClassName="bg-background/80"
      panelClassName="max-w-md bg-card border-border/80 animate-in fade-in zoom-in-95 duration-200"
      formProps={{ onSubmit: handleSubmit }}
      onBackdropClick={onClose}
      header={
        <div className="p-4 border-b border-border/70 flex items-center justify-between gap-2 bg-accent/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="top-up-goal-title" className="font-bold text-base text-foreground truncate">
                Add Contribution
              </h3>
              <p className="text-xs text-muted-foreground truncate">{goal.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      }
      bodyClassName="p-4 sm:p-5 space-y-4"
      footer={
        <div className="flex items-center justify-end gap-2.5 px-4 py-3 border-t border-border/60 bg-card">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || additionalCents <= 0} className="gap-1.5">
            <PlusCircle className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : 'Add Contribution'}
          </Button>
        </div>
      }
    >
      {error && (
        <div className="p-2.5 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-accent/20 border border-border/60 text-xs">
        <div>
          <span className="text-muted-foreground block text-[11px]">Current Funded</span>
          <span className="font-mono font-bold text-foreground">
            {formatInr(currentTotalRupees, { compact: true })}
          </span>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground block text-[11px]">Target Corpus</span>
          <span className="font-mono font-bold text-foreground">
            {formatInr(targetRupees, { compact: true })}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="goal-topup-amount"
          className="text-xs font-semibold text-muted-foreground block"
        >
          Contribution Amount (INR)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-mono">₹</span>
          <input
            id="goal-topup-amount"
            type="number"
            min="1"
            step="any"
            required
            value={amountRupees}
            onChange={(e) => setAmountRupees(e.target.value)}
            className="w-full pl-8 pr-3.5 py-2.5 bg-background border border-border/80 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {PRESET_TOPUP_RUPEES.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmountRupees(String(preset))}
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono border transition-colors ${
                Number(amountRupees) === preset
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                  : 'bg-secondary/60 text-muted-foreground border-border/60 hover:text-foreground'
              }`}
            >
              +{formatInr(preset)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <span className="text-muted-foreground">Updated Funded Corpus</span>
        <span className="font-mono font-bold text-emerald-400">
          {formatInr(nextTotalRupees, { compact: true })} ({nextFundedPct.toFixed(1)}%)
        </span>
      </div>
    </ResponsiveModalShell>
  );
}
export default TopUpGoalModal;
