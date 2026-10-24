import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Lock, ArrowLeft, Loader2 } from 'lucide-react';
import { useAdmin } from '../../lib/admin/admin-context';
import { PlatformRole } from '@wealthnest/domain';

interface AdminGuardProps {
  children: React.ReactNode;
  requiredRole?: PlatformRole;
}

export function AdminGuard({ children, requiredRole }: AdminGuardProps) {
  const { isAnyAdmin, isSuperAdmin, loading, currentAdminRole } = useAdmin();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
        <p className="text-sm tracking-wide font-medium text-slate-400">
          Verifying Platform Administrator Credentials...
        </p>
      </div>
    );
  }

  if (!isAnyAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-200">
        <div className="max-w-md w-full bg-slate-900/80 border border-rose-500/30 rounded-2xl p-8 backdrop-blur-xl shadow-2xl shadow-rose-950/20 text-center">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-rose-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
            Platform Access Restricted
          </h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            This area requires elevated WealthNest platform administration authority. Your account does
            not possess active administrative entitlements.
          </p>
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-500 mb-6 font-mono">
            Security Event: ACCESS_UNAUTHORIZED &bull; Logged
          </div>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-all shadow-md w-full"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Investor Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (requiredRole === 'super_admin' && !isSuperAdmin) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-slate-200">
        <div className="max-w-md w-full bg-slate-900/80 border border-amber-500/30 rounded-2xl p-8 backdrop-blur-xl shadow-2xl text-center">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-amber-400">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
            Super Administrator Authority Required
          </h2>
          <p className="text-sm text-slate-400 mb-4 leading-relaxed">
            Your current platform role is <span className="text-amber-400 font-semibold font-mono">{currentAdminRole}</span>.
            This administrative operation is strictly restricted to Super Administrators.
          </p>
          <Link
            to="/admin"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-all shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin Overview
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
