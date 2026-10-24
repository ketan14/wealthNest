import React, { useState } from 'react';
import { ShieldAlert, X, Eye, Clock, AlertCircle } from 'lucide-react';
import { useSupportSession } from '../../lib/admin/support-session-context';
import { useAdmin } from '../../lib/admin/admin-context';
import { useNavigate } from 'react-router-dom';

interface ViewAsUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    displayName: string;
    email: string;
    householdCount?: number;
  };
  onSuccess?: () => void;
}

export function ViewAsUserModal({
  isOpen,
  onClose,
  targetUser,
  onSuccess,
}: ViewAsUserModalProps) {
  const { startSupportSession, loading } = useSupportSession();
  const { adminActor } = useAdmin();
  const navigate = useNavigate();

  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isReasonValid = reason.trim().length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isReasonValid) {
      setError('Please provide a documented support justification with at least 8 characters.');
      return;
    }

    const result = await startSupportSession(
      targetUser.id,
      targetUser.displayName,
      reason.trim()
    );

    if (result.success) {
      onClose();
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/portfolio');
      }
    } else {
      setError(result.error || 'Failed to start support session');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="view-as-user-title"
    >
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 id="view-as-user-title" className="text-base font-bold text-white">
                Support View as User
              </h3>
              <p className="text-xs text-slate-400">
                Audited ephemeral troubleshooting session
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Profile Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs">
          <div>
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              Target User Account
            </div>
            <div className="text-sm font-bold text-white mt-0.5">
              {targetUser.displayName}
            </div>
            <div className="text-slate-400 font-mono mt-0.5">{targetUser.email}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              Session TTL
            </div>
            <div className="flex items-center gap-1 text-amber-400 font-mono font-bold mt-0.5">
              <Clock className="w-3.5 h-3.5" />
              <span>15 Minutes</span>
            </div>
          </div>
        </div>

        {/* Security & Audit Notice */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-xs text-amber-200/90 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-amber-300">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Administrative Isolation Notice</span>
          </div>
          <p className="leading-relaxed text-[11px]">
            You will view the permitted application experience as{' '}
            <strong className="text-white">{targetUser.displayName}</strong> while remaining
            authenticated as <strong className="text-white">{adminActor?.displayName || 'Administrator'}</strong>.
            Zero credentials are exchanged. All private financial data is delivered via strictly
            read-only server-side RPCs with zero write capabilities.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Reason form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="support-reason"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Support Reason / Ticket ID{' '}
              <span className="text-rose-400 font-bold">*</span>
            </label>
            <textarea
              id="support-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Investigating Section 112A capital gains report discrepancy (Ticket #402)"
              rows={3}
              required
              minLength={8}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all resize-none"
            />
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
              <span>A detailed reason is permanently logged in the audit ledger.</span>
              <span
                className={
                  reason.trim().length >= 8 ? 'text-emerald-400 font-mono' : 'text-slate-500 font-mono'
                }
              >
                {reason.trim().length} / 8 chars min
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isReasonValid || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs shadow-lg transition-all active:scale-95"
            >
              <Eye className="w-4 h-4" />
              <span>{loading ? 'Starting Session...' : 'Start Support Session'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
