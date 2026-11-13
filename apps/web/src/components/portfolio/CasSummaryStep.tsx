import { AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { ImportSummaryResult } from '@wealthnest/domain';
import { Button } from '@/components/ui/Button';

interface CasSummaryStepProps {
  importSummary: ImportSummaryResult;
  onClose: () => void;
}

export function CasSummaryStep({ importSummary, onClose }: CasSummaryStepProps) {
  const hasCompleteFailure =
    importSummary.failed > 0 && importSummary.imported === 0 && importSummary.updated === 0;

  return (
    <div className="space-y-6 pt-6 text-center">
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${
          hasCompleteFailure
            ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
            : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
        }`}
      >
        {hasCompleteFailure ? (
          <AlertCircle className="w-8 h-8" />
        ) : (
          <CheckCircle2 className="w-8 h-8" />
        )}
      </div>

      <div>
        <h4 className="text-lg font-bold text-foreground">
          {hasCompleteFailure
            ? 'CAS Import Encountered Issues'
            : 'CAS Import Completed Successfully!'}
        </h4>
        <p className="text-xs text-muted-foreground mt-1">
          {hasCompleteFailure
            ? 'Could not save positions to database. Please review the notice below.'
            : 'Your investment positions have been extracted, validated, and synchronized into distinct investment classes.'}
        </p>
      </div>

      {importSummary.failed > 0 && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-center gap-2 max-w-md mx-auto">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>
            {importSummary.failed} position{importSummary.failed > 1 ? 's' : ''} encountered an
            issue during database save.
          </span>
        </div>
      )}

      {/* Summary statistics grid */}
      <div className="grid gap-3 max-w-lg mx-auto grid-cols-2 sm:grid-cols-4">
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <span className="text-2xl font-bold font-mono text-blue-400">
            {importSummary.equitiesImported ??
              (importSummary.imported > 0 ? importSummary.imported : 0)}
          </span>
          <p className="text-[11px] text-muted-foreground mt-0.5">Equities Imported</p>
        </div>

        <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <span className="text-2xl font-bold font-mono text-cyan-400">
            {importSummary.mutualFundsImported ?? 0}
          </span>
          <p className="text-[11px] text-muted-foreground mt-0.5">Mutual Funds</p>
        </div>

        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <span className="text-2xl font-bold font-mono text-purple-400">
            {importSummary.updated}
          </span>
          <p className="text-[11px] text-muted-foreground mt-0.5">Updated</p>
        </div>

        <div className="p-3 rounded-xl bg-secondary/40 border border-border/50">
          <span className="text-2xl font-bold font-mono text-muted-foreground">
            {importSummary.skipped}
          </span>
          <p className="text-[11px] text-muted-foreground mt-0.5">Skipped</p>
        </div>

        {Boolean(importSummary.transactionsImported) && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 col-span-2 sm:col-span-4">
            <span className="text-xl font-bold font-mono text-emerald-400">
              +{importSummary.transactionsImported}
            </span>
            <p className="text-[11px] text-emerald-200 mt-0.5">
              Historical Transactions Added to Trade Ledger
            </p>
          </div>
        )}
      </div>

      <div className="pt-2">
        <Button onClick={onClose} className="gap-2">
          View Updated Portfolio
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

