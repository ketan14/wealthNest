import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface TermsPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsPrivacyModal({ isOpen, onClose }: TermsPrivacyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">WealthNest Terms & Privacy</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed">
          <div>
            <h4 className="font-semibold text-white mb-1">
              1. Data Privacy & Financial Encryption
            </h4>
            <p>
              WealthNest encrypts your portfolio records with household-level Row Level Security
              (RLS). Your financial data, bank balances, demat holdings, and loan accounts are
              accessible only to authorized members of your household.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-1">2. Zero Floating-Point Precision</h4>
            <p>
              All monetary calculations are performed in integer paise with zero floating-point
              drift, ensuring mathematical compliance with Indian taxation (Section 112A LTCG) and
              financial accounting standards.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-1">
              3. Non-Commercial Personal Wealth Management
            </h4>
            <p>
              WealthNest does not sell your personal financial records or telemetry to third-party
              ad networks or brokers.
            </p>
          </div>
        </div>
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
      </div>
    </div>
  );
}
