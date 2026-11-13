import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Lock,
  ArrowLeft,
  Loader2,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import { useAdmin } from '../../lib/admin/admin-context';
import { useAuth } from '../../lib/supabase/auth-context';
import { PlatformRole } from '@wealthnest/domain';

interface AdminGuardProps {
  children: React.ReactNode;
  requiredRole?: PlatformRole;
}

export function AdminGuard({ children, requiredRole }: AdminGuardProps) {
  const { isAnyAdmin, isSuperAdmin, loading, currentAdminRole } = useAdmin();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

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
        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl text-center">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-rose-400">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
            Platform Access Restricted
          </h2>

          <p className="text-sm text-slate-400 mb-4 leading-relaxed">
            This portal requires elevated platform administration privileges.
          </p>

          {/* Account status badge */}
          <div className="mb-6 p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-left">
            <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mb-1">
              Active Session
            </div>
            <div className="text-xs font-mono text-slate-300 truncate">
              {user?.email || 'Demo Mode (No authenticated session)'}
            </div>
            <div className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>No platform administrative entitlement detected</span>
            </div>
          </div>

          <div className="space-y-2.5 mb-6">
            {user && (
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium border border-slate-800 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out & Switch Account</span>
              </button>
            )}
          </div>

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Investor Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  if (requiredRole === 'super_admin' && !isSuperAdmin) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-slate-200">
        <div className="max-w-md w-full bg-slate-900/90 border border-amber-500/30 rounded-2xl p-8 backdrop-blur-xl shadow-2xl text-center">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-amber-400">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
            Super Administrator Authority Required
          </h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Your current platform role is{' '}
            <span className="text-amber-400 font-semibold font-mono">{currentAdminRole}</span>. This
            operation is strictly restricted to Super Administrators.
          </p>

          <div className="space-y-3 mb-4">
            <Link
              to="/admin"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-all shadow-md w-full"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Admin Overview
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
