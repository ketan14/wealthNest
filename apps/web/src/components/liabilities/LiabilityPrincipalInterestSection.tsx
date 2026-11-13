import { InterestType } from '@wealthnest/domain';

interface LiabilityPrincipalInterestSectionProps {
  currencySymbol: string;
  isEditing: boolean;
  originalPrincipalStr: string;
  onOriginalPrincipalChange: (val: string) => void;
  currentBalanceStr: string;
  onCurrentBalanceChange: (val: string) => void;
  interestRateStr: string;
  onInterestRateChange: (val: string) => void;
  interestType: InterestType;
  onInterestTypeChange: (val: InterestType) => void;
  emiAmountStr: string;
  onEmiAmountChange: (val: string) => void;
}

/**
 * Principal balance, interest rate/structure, and monthly EMI inputs for AddLiabilityModal.
 */
export function LiabilityPrincipalInterestSection({
  currencySymbol,
  isEditing,
  originalPrincipalStr,
  onOriginalPrincipalChange,
  currentBalanceStr,
  onCurrentBalanceChange,
  interestRateStr,
  onInterestRateChange,
  interestType,
  onInterestTypeChange,
  emiAmountStr,
  onEmiAmountChange,
}: LiabilityPrincipalInterestSectionProps) {
  return (
    <>
      {/* Principal & Current Balance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Original Sanctioned Principal ({currencySymbol}){' '}
            <span className="text-destructive">*</span>
          </label>
          <input
            type="number"
            step="any"
            required
            disabled={isEditing}
            value={originalPrincipalStr}
            onChange={(e) => onOriginalPrincipalChange(e.target.value)}
            placeholder="e.g. 5000000 (50 Lakhs)"
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors font-mono disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            {isEditing
              ? 'Original principal cannot be changed after creation.'
              : 'The original amount sanctioned by the bank.'}
          </p>
        </div>

        {!isEditing && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Current Outstanding Principal ({currencySymbol})
            </label>
            <input
              type="number"
              step="any"
              value={currentBalanceStr}
              onChange={(e) => onCurrentBalanceChange(e.target.value)}
              placeholder="Defaults to original principal if new"
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors font-mono"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Leave blank if starting at full original principal.
            </p>
          </div>
        )}
      </div>

      {/* Interest Rate & Type */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Interest Rate (% p.a.) <span className="text-destructive">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={interestRateStr}
            onChange={(e) => onInterestRateChange(e.target.value)}
            placeholder="e.g. 8.50"
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Interest Structure
          </label>
          <select
            value={interestType}
            onChange={(e) => onInterestTypeChange(e.target.value as InterestType)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
          >
            <option value="floating">Floating / Repo-Linked</option>
            <option value="fixed">Fixed Rate</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Monthly EMI ({currencySymbol})
          </label>
          <input
            type="number"
            step="any"
            value={emiAmountStr}
            onChange={(e) => onEmiAmountChange(e.target.value)}
            placeholder="e.g. 43500"
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors font-mono"
          />
        </div>
      </div>
    </>
  );
}
