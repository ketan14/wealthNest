import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/Button';
import {
  ShieldCheck,
  TrendingUp,
  Landmark,
  Users,
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
  X,
  FileText,
} from 'lucide-react';

export function SignUpPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

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
  const [isConfirmationRequired, setIsConfirmationRequired] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  // If already authenticated, redirect to home page
  if (!authLoading && user) {
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

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
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

    if (!validate()) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            display_name: fullName.trim(),
          },
        },
      });

      if (error) {
        throw error;
      }

      // Check if session was granted immediately or email verification is required
      if (data?.session) {
        navigate('/', { replace: true });
      } else if (data?.user) {
        setIsConfirmationRequired(true);
      } else {
        navigate('/login', { replace: true });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to register account. Please try again or contact support.';
      setServerError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row relative selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* LEFT SECTION — BRANDING & VALUE PROPOSITION */}
      <div className="lg:w-1/2 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 p-8 sm:p-12 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/60 relative overflow-hidden">
        {/* Subtle decorative glow accents */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand header */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
              <ShieldCheck className="w-7 h-7 text-slate-950" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-white flex items-center gap-2">
                WealthNest
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  v0.1.0-alpha
                </span>
              </span>
              <p className="text-xs text-slate-400">Family Wealth & Asset Management</p>
            </div>
          </Link>
        </div>

        {/* Central Hero pitch */}
        <div className="my-12 lg:my-auto relative z-10 max-w-lg">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Build a clearer picture of your wealth.
          </h1>
          <p className="text-base sm:text-lg text-slate-300 mb-8 leading-relaxed">
            Track your assets, investments, loans and family net worth in one place.
          </p>

          {/* Three Key Benefits */}
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Understand your total net worth.</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated calculations across cash balances, demat holdings, physical gold, and liabilities.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Track investments and property values.</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Live NSE/BSE quotes, mutual fund NAV feeds, CAS/Tradebook statement importers, and loan amortization.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Manage household assets and liabilities.</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Coordinate portfolios across household entities with Section 112A tax shields and secure RLS.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Precision footer note */}
        <div className="relative z-10 pt-4 border-t border-slate-800/60 flex items-center gap-3 text-xs text-slate-400">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>PostgreSQL Row Level Security &bull; Zero floating-point drift (integer paise)</span>
        </div>
      </div>

      {/* RIGHT SECTION — REGISTRATION FORM */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 relative">
        <div className="max-w-md w-full">
          {isConfirmationRequired ? (
            /* Email Confirmation Screen */
            <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-8 backdrop-blur-xl shadow-2xl shadow-emerald-950/20 text-center animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-emerald-400 shadow-inner">
                <MailCheck className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Check your email</h2>
              <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                We have sent an activation link to{' '}
                <span className="font-semibold text-white font-mono">{email}</span>. Please click the link to confirm your account and get started.
              </p>
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-400 mb-6 flex items-center gap-2 text-left">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Once confirmed, your profile and household are ready automatically.</span>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-all shadow-md w-full"
              >
                Proceed to Sign In
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            /* Standalone Registration Form */
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Create your WealthNest account
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Start organising your financial future.
                </p>
              </div>

              {serverError && (
                <div
                  role="alert"
                  className="mb-5 p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-start gap-2.5 animate-in fade-in"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Registration Error</p>
                    <p className="mt-0.5 text-rose-300/90">{serverError}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Full Name */}
                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      disabled={submitting}
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (errors.fullName) {
                          setErrors((prev) => {
                            const updated = { ...prev };
                            delete updated.fullName;
                            return updated;
                          });
                        }
                      }}
                      placeholder="e.g. Ketan Vaghela"
                      className={`w-full h-10 pl-9 pr-3 rounded-lg bg-slate-950/60 border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                        errors.fullName
                          ? 'border-rose-500/80 focus:ring-rose-500/30'
                          : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500/20'
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

                {/* Email Address */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      disabled={submitting}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) {
                          setErrors((prev) => {
                            const updated = { ...prev };
                            delete updated.email;
                            return updated;
                          });
                        }
                      }}
                      placeholder="investor@wealthnest.local"
                      className={`w-full h-10 pl-9 pr-3 rounded-lg bg-slate-950/60 border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                        errors.email
                          ? 'border-rose-500/80 focus:ring-rose-500/30'
                          : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500/20'
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

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      disabled={submitting}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) {
                          setErrors((prev) => {
                            const updated = { ...prev };
                            delete updated.password;
                            return updated;
                          });
                        }
                      }}
                      placeholder="At least 6 characters"
                      className={`w-full h-10 pl-9 pr-10 rounded-lg bg-slate-950/60 border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                        errors.password
                          ? 'border-rose-500/80 focus:ring-rose-500/30'
                          : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500/20'
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
                  {errors.password && (
                    <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3" />
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      disabled={submitting}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword) {
                          setErrors((prev) => {
                            const updated = { ...prev };
                            delete updated.confirmPassword;
                            return updated;
                          });
                        }
                      }}
                      placeholder="Repeat your password"
                      className={`w-full h-10 pl-9 pr-10 rounded-lg bg-slate-950/60 border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                        errors.confirmPassword
                          ? 'border-rose-500/80 focus:ring-rose-500/30'
                          : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500/20'
                      }`}
                    />
                    <button
                      type="button"
                      data-testid="toggle-confirm-password-btn"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3" />
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>

                {/* Terms of Service & Privacy Policy Checkbox */}
                <div className="pt-1">
                  <div className="flex items-start gap-2.5">
                    <input
                      id="agreeTerms"
                      name="agreeTerms"
                      type="checkbox"
                      disabled={submitting}
                      checked={agreeTerms}
                      onChange={(e) => {
                        setAgreeTerms(e.target.checked);
                        if (errors.agreeTerms) {
                          setErrors((prev) => {
                            const updated = { ...prev };
                            delete updated.agreeTerms;
                            return updated;
                          });
                        }
                      }}
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 cursor-pointer"
                    />
                    <label htmlFor="agreeTerms" className="text-xs text-slate-400 leading-relaxed cursor-pointer select-none">
                      I agree to the{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setTermsModalOpen(true);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors font-medium"
                      >
                        Terms of Service
                      </button>{' '}
                      and{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setTermsModalOpen(true);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors font-medium"
                      >
                        Privacy Policy
                      </button>
                      .
                    </label>
                  </div>
                  {errors.agreeTerms && (
                    <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3" />
                      {errors.agreeTerms}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
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

              {/* Already have an account link */}
              <div className="mt-6 pt-5 border-t border-slate-800 text-center">
                <p className="text-xs text-slate-400">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TERMS & PRIVACY POLICY MODAL */}
      {termsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">WealthNest Terms & Privacy</h3>
              </div>
              <button
                type="button"
                onClick={() => setTermsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed">
              <div>
                <h4 className="font-semibold text-white mb-1">1. Data Privacy & Financial Encryption</h4>
                <p>
                  WealthNest encrypts your portfolio records with household-level Row Level Security (RLS). Your financial data, bank balances, demat holdings, and loan accounts are accessible only to authorized members of your household.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">2. Zero Floating-Point Precision</h4>
                <p>
                  All monetary calculations are performed in integer paise with zero floating-point drift, ensuring mathematical compliance with Indian taxation (Section 112A LTCG) and financial accounting standards.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">3. Non-Commercial Personal Wealth Management</h4>
                <p>
                  WealthNest does not sell your personal financial records or telemetry to third-party ad networks or brokers.
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTermsModalOpen(false)}
                className="text-white border-slate-700"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
