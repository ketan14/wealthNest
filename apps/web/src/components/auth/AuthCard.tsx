import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  User,
  LogIn,
  LogOut,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
} from 'lucide-react';

export function AuthCard() {
  const { user, signOut } = useAuth();
  const [quickEmail, setQuickEmail] = useState('');
  const [quickPassword, setQuickPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQuickLogin, setShowQuickLogin] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: quickEmail,
        password: quickPassword,
      });
      if (error) throw error;
      setMessage({ text: 'Signed in successfully!', type: 'success' });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Authentication failed',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <Card className="border-border/80 bg-card/60 backdrop-blur-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Authenticated User</CardTitle>
            </div>
            <Badge variant="success">Active Session</Badge>
          </div>
          <CardDescription>Supabase Auth session active in browser local storage.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-secondary/40 border border-border/50 text-xs font-mono space-y-1">
            <p className="text-muted-foreground">
              User ID: <span className="text-foreground">{user.id}</span>
            </p>
            <p className="text-muted-foreground">
              Email: <span className="text-foreground">{user.email}</span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-md flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-base">WealthNest Account & Security</CardTitle>
            </div>
            <Badge variant="secondary">Protected with RLS</Badge>
          </div>
          <CardDescription>
            Sign in or create an account to manage your family assets, demat tradebooks, and loan amortizations.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Primary Action Buttons leading to dedicated routes */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Link to="/login" className="flex-1">
              <Button className="w-full gap-2 bg-primary hover:bg-emerald-400 text-slate-950 font-semibold text-xs h-9">
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </Button>
            </Link>
            <Link to="/signup" className="flex-1">
              <Button
                variant="outline"
                className="w-full gap-2 text-xs h-9 border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Create Account
              </Button>
            </Link>
          </div>

          {/* Quick inline login option for fast local testing */}
          <div className="pt-2 border-t border-border/50">
            {!showQuickLogin ? (
              <button
                type="button"
                onClick={() => setShowQuickLogin(true)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <KeyRound className="w-3 h-3 text-primary" />
                <span>Quick Sign-In (Local Dev)</span>
              </button>
            ) : (
              <form onSubmit={handleQuickLogin} className="space-y-2.5 pt-1 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-foreground">Quick Sign-In</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickLogin(false);
                      setMessage(null);
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Hide
                  </button>
                </div>

                <input
                  type="email"
                  required
                  value={quickEmail}
                  onChange={(e) => setQuickEmail(e.target.value)}
                  placeholder="investor@wealthnest.local"
                  className="w-full h-8 rounded-md bg-secondary/50 border border-border px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />

                <input
                  type="password"
                  required
                  value={quickPassword}
                  onChange={(e) => setQuickPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-8 rounded-md bg-secondary/50 border border-border px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />

                {message && (
                  <div
                    className={`p-2 rounded-md text-[11px] flex items-center gap-1.5 ${
                      message.type === 'success'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-destructive/15 text-destructive border border-destructive/30'
                    }`}
                  >
                    {message.type === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{message.text}</span>
                  </div>
                )}

                <Button type="submit" disabled={loading} size="sm" className="w-full h-8 text-xs gap-1.5">
                  {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                  Sign In (Direct)
                </Button>
              </form>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
