import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/Button';
import {
  ShieldCheck,
  TrendingUp,
  Landmark,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
  X,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';

export function LoginPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // If already authenticated, redirect to home page
  if (!authLoading && user) {
    return <Navigate to="/" replace />;
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
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
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Invalid email or password. Please try again.';
      setServerError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMessage(null);

    if (!forgotEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      setForgotMessage({ text: 'Please enter a valid email address', type: 'error' });
      return;
    }

    setForgotSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;

      setForgotMessage({
        text: 'Password reset link sent! Please check your email inbox.',
        type: 'success',
      });
    } catch (err: unknown) {
      setForgotMessage({
        text: err instanceof Error ? err.message : 'Unable to send password reset link.',
        type: 'error',
      });
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row relative selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* LEFT SECTION — BRANDING & VALUE PROPOSITION */}
      <div className="lg:w-1/2 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 p-8 sm:p-12 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/60 relative overflow-hidden">
        {/* Subtle decorative glow accents */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

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
            Welcome back to WealthNest.
          </h1>
          <p className="text-base sm:text-lg text-slate-300 mb-8 leading-relaxed">
            Access your encrypted wealth portfolio, track real-time valuations, and manage family finances securely.
          </p>

          {/* Quick highlights */}
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Consolidated Family Portfolio</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Track Zerodha Kite, Groww, and CAS statements in one place with zero floating-point drift.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Smart Debt & Amortization</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Prepayment simulations, interest savings calculations, and loan repayment timelines.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Precision footer note */}
        <div className="relative z-10 pt-4 border-t border-slate-800/60 flex items-center gap-3 text-xs text-slate-400">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>PostgreSQL Row Level Security &bull; Clean Architecture Monorepo</span>
        </div>
      </div>

      {/* RIGHT SECTION — SIGN IN FORM */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 relative">
        <div className="max-w-md w-full">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Sign in to your account
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Enter your credentials to access your dashboard.
              </p>
            </div>

            {serverError && (
              <div
                role="alert"
                className="mb-5 p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-start gap-2.5 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Authentication Failed</p>
                  <p className="mt-0.5 text-rose-300/90">{serverError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Email Address */}
              <div>
                <label
                  htmlFor="loginEmail"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="loginEmail"
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
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="loginPassword"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotModalOpen(true);
                    }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="loginPassword"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
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
                    placeholder="••••••••"
                    className={`w-full h-10 pl-9 pr-10 rounded-lg bg-slate-950/60 border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                      errors.password
                        ? 'border-rose-500/80 focus:ring-rose-500/30'
                        : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500/20'
                    }`}
                  />
                  <button
                    type="button"
                    data-testid="toggle-login-password-btn"
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
                      Signing In...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </div>
            </form>

            {/* Link to Sign Up */}
            <div className="mt-6 pt-5 border-t border-slate-800 text-center">
              <p className="text-xs text-slate-400">
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                >
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Password Recovery</h3>
              </div>
              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Enter your registered email address and we will dispatch a password recovery link.
            </p>

            {forgotMessage && (
              <div
                className={`mb-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
                  forgotMessage.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-destructive/15 text-destructive border border-destructive/30'
                }`}
              >
                {forgotMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                )}
                <span>{forgotMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label htmlFor="recoveryEmail" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Recovery Email Address
                </label>
                <input
                  id="recoveryEmail"
                  name="recoveryEmail"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="recovery@wealthnest.local"
                  className="w-full h-10 px-3 rounded-lg bg-slate-950/60 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForgotModalOpen(false)}
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={forgotSubmitting}
                  className="bg-primary hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  {forgotSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
