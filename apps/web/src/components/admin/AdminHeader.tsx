import { ShieldCheck, User } from 'lucide-react';

import { useAdmin } from '../../lib/admin/admin-context';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function AdminHeader({ title, subtitle, action }: AdminHeaderProps) {
  const { adminActor, currentAdminRole } = useAdmin();

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-8 py-5 flex items-center justify-between sticky top-0 z-20">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            Financial Isolation Active
          </span>
        </div>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {action}

        <div className="h-6 w-px bg-slate-800" />

        {/* Actor Profile Info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden md:block text-right">
            <div className="text-xs font-semibold text-white leading-tight">
              {adminActor?.displayName || 'Ketan Vaghela'}
            </div>
            <div className="text-[10px] text-cyan-400 uppercase font-mono font-medium">
              {currentAdminRole}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
