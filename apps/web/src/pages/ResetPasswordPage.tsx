import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, KeyRound, CheckCircle2, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/Button';
import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm';

/**
 * Landing page for Supabase PASSWORD_RECOVERY links (/reset-password).
 * Validates password complexity via UpdatePasswordForm and persists changes via supabase.auth.updateUser().
 */
export function ResetPasswordPage() {
  const {
    user,
    session,
    isLoading: authLoading,
    isOfflineUser,
    isPasswordRecovery,
    clearPasswordRecovery,
  } = useAuth();
  const navigate = useNavigate();
  const [completed, setCompleted] = useState(false);

  const hasActiveRecoverySession =
    isPasswordRecovery || Boolean((session || user) && !isOfflineUser);

  const handlePasswordUpdated = () => {
    clearPasswordRecovery();
    setCompleted(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row relative selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* LEFT SECTION — BRANDING & SECURITY POSTURE */}
      <div className="lg:w-1/2 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 p-8 sm:p-12 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/60 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Link to="/login" className="inline-flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
              <ShieldCheck className="w-7 h-7 text-slate-950" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-white flex items-center gap-2">
                WealthNest
              </span>
              <p className="text-xs text-slate-400">Account Recovery & Credential Security</p>
            </div>
          </Link>
        </div>

        <div className="my-12 lg:my-auto relative z-10 max-w-lg">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Reset your vault password.
          </h1>
          <p className="text-base text-slate-300 leading-relaxed">
            Choose a strong unique password with at least 12 characters, mixed case letters,
            numbers, and a symbol to protect your encrypted family portfolio.
          </p>
        </div>

        <div className="relative z-10 pt-4 border-t border-slate-800/60 flex items-center gap-3 text-xs text-slate-400">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Authenticated Supabase Recovery Session</span>
        </div>
      </div>

      {/* RIGHT SECTION — RECOVERY CARD */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 relative">
        <div className="max-w-md w-full">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
            {authLoading ? (
              <div className="py-10 flex flex-col items-center justify-center text-center gap-3">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                <p className="text-sm text-slate-300">Verifying recovery session...</p>
              </div>
            ) : completed ? (
              <div className="space-y-5 text-center py-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white tracking-tight">Password Updated</h2>
                  <p className="text-sm text-slate-400">
                    Your new password is active. Continue to your WealthNest dashboard or sign in
                    with your updated credentials.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => navigate(user && !isOfflineUser ? '/' : '/login')}
                  className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold border-0"
                >
                  Continue to WealthNest
                </Button>
              </div>
            ) : !hasActiveRecoverySession ? (
              <div className="space-y-5">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Recovery Link Missing or Expired
                  </h2>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Open the password reset link directly from your email inbox to establish a
                    verified recovery session, or request a new reset email from the sign-in page.
                  </p>
                </div>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </Link>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Set a New Password
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {user?.email
                      ? `Updating credentials for ${user.email}.`
                      : 'Enter and confirm your new account password.'}
                  </p>
                </div>

                <UpdatePasswordForm
                  submitLabel="Set New Password"
                  onSuccess={handlePasswordUpdated}
                />

                <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Return to Sign In
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

