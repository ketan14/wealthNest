import React, { useState } from 'react';
import { Link, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { resolveAppRedirectUrl } from '@/lib/config/app-redirect-url';
import { Button } from '@/components/ui/Button';
import { AuthBrandingPanel } from '@/components/auth/AuthBrandingPanel';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { TermsPrivacyModal } from '@/components/auth/TermsPrivacyModal';
import {
  useAuthBackendConnection,
  AuthBackendRecoveryActions,
  AuthBackendStatusBar,
  isNetworkFetchError,
  formatBackendUnreachableMessage,
} from '@/components/auth/AuthBackendStatusBar';
import { PASSWORD_POLICY_HINT, validatePasswordComplexity } from '@/lib/validation/password';
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  MailCheck,
  CheckCircle2,
  ArrowRight,
  Home,
} from 'lucide-react';

export function SignUpPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const inviteToken = (
    searchParams.get('invite') ||
    searchParams.get('household_invite') ||
    ''
  ).trim();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isUnreachableError, setIsUnreachableError] = useState(false);
  const [isConfirmationRequired, setIsConfirmationRequired] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  const backend = useAuthBackendConnection();

  if (!authLoading && user) {
    if (inviteToken) {
      return <Navigate to={`/invite?token=${encodeURIComponent(inviteToken)}`} replace />;
    }
    return <Navigate to="/" replace />;
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = 'Name must be at least 2 characters';
    }

    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    const passwordError = validatePasswordComplexity(password);
    if (passwordError) {
      newErrors.password = passwordError;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the Terms of Service & Privacy Policy';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setIsUnreachableError(false);

    if (!validate()) return;

    setSubmitting(true);
    try {
      const emailRedirectTo = inviteToken
        ? resolveAppRedirectUrl(`/invite?token=${encodeURIComponent(inviteToken)}`)
        : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
          data: {
            full_name: fullName.trim(),
            display_name: fullName.trim(),
            ...(inviteToken ? { skip_default_household: true } : {}),
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data?.session) {
        if (inviteToken) {
          navigate(`/invite?token=${encodeURIComponent(inviteToken)}`, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else if (data?.user) {
        setIsConfirmationRequired(true);
      } else {
        navigate(inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : '/login', {
          replace: true,
        });
      }
    } catch (err: unknown) {
      let message = 'Unable to register account. Please try again or contact support.';
      if (isNetworkFetchError(err)) {
        setIsUnreachableError(true);
        message = formatBackendUnreachableMessage({
          activeUrl: backend.activeUrl,
          activeMode: backend.activeMode,
          hasConfiguredRemote: backend.hasConfiguredRemote,
          isMobile: backend.isMobile,
          isHttps: backend.isHttps,
        });
      } else if (err instanceof Error) {
        message = err.message;
      }
      setServerError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const loginLink = inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : '/login';

  return (
    <AuthSplitLayout
      branding={<AuthBrandingPanel />}
      overlays={
        <TermsPrivacyModal isOpen={termsModalOpen} onClose={() => setTermsModalOpen(false)} />
      }
    >
      {isConfirmationRequired ? (
        <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-8 backdrop-blur-xl shadow-2xl shadow-emerald-950/20 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-emerald-400 shadow-inner">
            <MailCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Check your email</h2>
          <p className="text-sm text-slate-300 mb-6 leading-relaxed">
            We have sent an activation link to{' '}
            <span className="font-semibold text-white font-mono">{email}</span>. Please click the
            link to confirm your account and get started.
          </p>
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-400 mb-6 flex items-center gap-2 text-left">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {inviteToken
                ? 'Once confirmed, return to join the invited household workspace.'
                : 'Once confirmed, your profile and household are ready automatically.'}
            </span>
          </div>
          <Link
            to={loginLink}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-all shadow-md w-full"
          >
            Proceed to Sign In
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Create your WealthNest account
            </h2>
            <p className="text-sm text-slate-400 mt-1">Start organising your financial future.</p>
          </div>

          {inviteToken && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2.5">
              <Home className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-300">Household Invite Detected</p>
                <p className="mt-0.5 opacity-90">
                  Sign up with the invited email address to link your login directly after
                  verification.
                </p>
              </div>
            </div>
          )}

          {serverError && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-start gap-2.5 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Registration Error</p>
                <p className="mt-0.5 text-rose-300/90">{serverError}</p>
                {isUnreachableError && (
                  <AuthBackendRecoveryActions
                    backend={backend}
                    onErrorClear={() => {
                      setServerError(null);
                      setIsUnreachableError(false);
                    }}
                    onError={(msg) => setServerError(msg)}
                  />
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="signup-full-name"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="signup-full-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ketan Vaghela"
                  className={`w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${
                    errors.fullName ? 'border-rose-500' : 'border-slate-800 hover:border-slate-700'
                  }`}
                />
              </div>
              {errors.fullName && (
                <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {errors.fullName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="signup-email"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="investor@domain.com"
                  className={`w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${
                    errors.email ? 'border-rose-500' : 'border-slate-800 hover:border-slate-700'
                  }`}
                />
              </div>
              {errors.email && (
                <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 10 chars, mixed case + symbol"
                  className={`w-full pl-10 pr-10 py-2.5 bg-slate-950/60 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${
                    errors.password ? 'border-rose-500' : 'border-slate-800 hover:border-slate-700'
                  }`}
                />
                <button
                  type="button"
                  data-testid="toggle-password-btn"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{PASSWORD_POLICY_HINT}</p>
              {errors.password && (
                <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="signup-confirm-password"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className={`w-full pl-10 pr-10 py-2.5 bg-slate-950/60 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${
                    errors.confirmPassword
                      ? 'border-rose-500'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                />
                <button
                  type="button"
                  data-testid="toggle-confirm-password-btn"
                  aria-label={
                    showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                  }
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div>
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500/40"
                />
                <span className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                  I accept the{' '}
                  <button
                    type="button"
                    onClick={() => setTermsModalOpen(true)}
                    className="text-emerald-400 hover:underline font-medium"
                  >
                    Terms of Service &amp; Privacy Policy
                  </button>
                  .
                </span>
              </label>
              {errors.agreeTerms && (
                <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {errors.agreeTerms}
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-11 bg-primary hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Account...
                  </span>
                ) : (
                  'Create Account'
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{' '}
              <Link
                to={loginLink}
                className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>

          <AuthBackendStatusBar
            backend={backend}
            onSwitched={() => {
              setServerError(null);
              setIsUnreachableError(false);
            }}
          />
        </div>
      )}
    </AuthSplitLayout>
  );
}
