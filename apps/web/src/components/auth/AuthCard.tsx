import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { User, LogIn, LogOut, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export function AuthCard() {
  const { user, signOut } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage({ text: 'Logged in successfully!', type: 'success' });
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage({
          text: 'Account registered! Profile automatically created via trigger.',
          type: 'success',
        });
      }
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
    <Card className="border-border/80 bg-card/60 backdrop-blur-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogIn className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">
              {isLogin ? 'Sign In to WealthNest' : 'Create an Account'}
            </CardTitle>
          </div>
          <Badge variant="secondary">Local Supabase Auth</Badge>
        </div>
        <CardDescription>
          {isLogin
            ? 'Sign in to access encrypted wealth data.'
            : 'Register a new profile to test database trigger creation.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="investor@wealthnest.local"
              className="w-full h-9 rounded-md bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-9 rounded-md bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {message && (
            <div
              className={`p-2.5 rounded-md text-xs flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-destructive/15 text-destructive border border-destructive/30'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <Button type="submit" disabled={loading} size="sm" className="gap-2">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isLogin ? 'Sign In' : 'Register Profile'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage(null);
              }}
              className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              {isLogin ? 'Need an account? Sign up' : 'Have an account? Sign in'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
