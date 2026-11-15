import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';

interface TermsPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsPrivacyModal({ isOpen, onClose }: TermsPrivacyModalProps) {
  if (!isOpen) return null;

  return (
    <ResponsiveModalShell
      role="dialog"
      ariaLabelledBy="terms-privacy-title"
      backdropClassName="bg-slate-950/80"
      panelClassName="max-w-lg bg-slate-900 border-slate-800 max-h-[85dvh] animate-in fade-in zoom-in-95"
      onBackdropClick={onClose}
      header={
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
            <h3 id="terms-privacy-title" className="font-bold text-white text-base">
              WealthNest Terms & Privacy
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      }
      bodyClassName="p-4 sm:p-5 space-y-4 text-xs text-slate-300 leading-relaxed"
      footer={
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-white border-slate-700"
          >
            Close
          </Button>
        </div>
      }
    >
      <div>
        <h4 className="font-semibold text-white mb-1">1. Data Privacy & Financial Encryption</h4>
        <p>
          WealthNest encrypts your portfolio records with household-level Row Level Security (RLS).
          Your financial data, bank balances, demat holdings, and loan accounts are accessible only
          to authorized members of your household.
        </p>
      </div>
      <div>
        <h4 className="font-semibold text-white mb-1">2. Zero Floating-Point Precision</h4>
        <p>
          All monetary calculations are performed in integer paise with zero floating-point drift,
          ensuring mathematical compliance with Indian taxation (Section 112A LTCG) and financial
          accounting standards.
        </p>
      </div>
      <div>
        <h4 className="font-semibold text-white mb-1">
          3. Non-Commercial Personal Wealth Management
        </h4>
        <p>
          WealthNest does not sell your personal financial records or telemetry to third-party ad
          networks or brokers.
        </p>
      </div>
    </ResponsiveModalShell>
  );
}
