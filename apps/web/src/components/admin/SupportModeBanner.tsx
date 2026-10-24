import { Eye, ShieldAlert, Clock, LogOut, ArrowRight } from 'lucide-react';
import { useSupportSession } from '../../lib/admin/support-session-context';
import { useNavigate, useLocation } from 'react-router-dom';

export function SupportModeBanner() {
  const {
    isSupportModeActive,
    targetUser,
    formattedTimeRemaining,
    isExpiringSoon,
    endSupportSession,
    loading,
  } = useSupportSession();

  const navigate = useNavigate();
  const location = useLocation();

  if (!isSupportModeActive || !targetUser) {
    return null;
  }

  const handleExit = async () => {
    await endSupportSession();
    // Return to the admin portal or current path
    if (!location.pathname.startsWith('/admin')) {
      navigate('/admin/users');
    }
  };

  const isInvestorView = !location.pathname.startsWith('/admin');

  return (
    <aside
      role="banner"
      aria-label="Support Impersonation Mode Banner"
      className={`sticky top-0 z-50 w-full px-4 py-2.5 transition-all shadow-xl backdrop-blur-md border-b ${
        isExpiringSoon
          ? 'bg-rose-950/95 border-rose-500/60 text-rose-100 animate-pulse'
          : 'bg-gradient-to-r from-amber-950/95 via-slate-950/95 to-indigo-950/95 border-amber-500/40 text-amber-100'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Left: Mode & Target User Indicator */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase tracking-wider text-[11px]">
            <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Support Impersonation Mode</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-200">
            <span className="text-slate-400">Viewing as:</span>
            <span className="font-bold text-white bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
              {targetUser.displayName}
            </span>
            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
              ({targetUser.email})
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900/60 text-slate-400 border border-slate-800 text-[10px] font-mono">
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            <span>Read-Only • Direct Mutations Disabled</span>
          </div>
        </div>

        {/* Right: Countdown Timer & Exit Action */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-mono font-bold text-xs border ${
              isExpiringSoon
                ? 'bg-rose-900/60 text-rose-200 border-rose-500/80 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                : 'bg-slate-900/80 text-amber-300 border-amber-500/30'
            }`}
            title="Support Session Time Remaining"
          >
            <Clock className={`w-3.5 h-3.5 ${isExpiringSoon ? 'text-rose-400 animate-spin' : 'text-amber-400'}`} />
            <span>{formattedTimeRemaining}</span>
          </div>

          {!isInvestorView && (
            <button
              onClick={() => navigate('/portfolio')}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium text-xs transition-all shadow-md"
            >
              <span>View Portfolio</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={handleExit}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit View as User</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
