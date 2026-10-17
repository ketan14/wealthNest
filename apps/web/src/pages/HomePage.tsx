import { useQuery } from '@tanstack/react-query';
import { GetSystemStatusUseCase, SystemStatusDto } from '@wealthnest/application';
import { Money } from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, Layers, Cpu, Box, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HomePage() {
  // Execute application use case via TanStack Query to verify react-query + application layer integration
  const { data: systemStatus, isLoading } = useQuery<SystemStatusDto>({
    queryKey: ['system-status'],
    queryFn: () => {
      const useCase = new GetSystemStatusUseCase();
      const result = useCase.execute();
      if (!result.success) throw result.error;
      return result.value;
    },
  });

  // Pure domain test calculation to verify domain package export boundary
  const demoMoneyA = Money.fromDecimal(150000.5, 'USD');
  const demoMoneyB = Money.fromDecimal(49999.5, 'USD');
  const totalDemo = demoMoneyA.add(demoMoneyB);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-emerald-950/20 p-8 shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            Phase 0 Architecture Verified & Ready
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            WealthNest Core Monorepo
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Welcome to the initial production-oriented architecture for WealthNest. This modular
            monolith provides clean separation of concerns across pure domain calculations,
            application service contracts, reusable utilities, and a modern responsive frontend.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/portfolio">
              <Button className="gap-2">
                Explore Scaffolding Modules
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="inline-block">
              <Button variant="outline">Monorepo Docs</Button>
            </a>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Domain Verification Demonstration */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-primary" />
              <CardTitle>Pure Domain Engine Scaffold Verification</CardTitle>
            </div>
            <Badge variant="success">Boundary Verified</Badge>
          </div>
          <CardDescription>
            Validating that framework-independent models from{' '}
            <code className="text-primary font-mono">@wealthnest/domain</code> execute without
            floating-point errors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-lg bg-secondary/40 border border-border/50">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Holding A Value
              </span>
              <p className="text-xl font-bold font-mono text-foreground mt-1">
                {demoMoneyA.format('en-US')}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                BigInt cents: {demoMoneyA.cents.toString()}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/40 border border-border/50">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Holding B Value
              </span>
              <p className="text-xl font-bold font-mono text-foreground mt-1">
                {demoMoneyB.format('en-US')}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                BigInt cents: {demoMoneyB.cents.toString()}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-xs text-primary font-semibold uppercase tracking-wider">
                Calculated Sum (A + B)
              </span>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {totalDemo.format('en-US')}
              </p>
              <p className="text-[11px] text-emerald-400/80 mt-0.5">
                Strict ISO currency validation
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Architecture Layers Status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Active Architecture Layers</h3>
          </div>
          <Badge variant="secondary">npm workspaces</Badge>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading architecture status...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemStatus?.layers.map((layer) => (
              <Card
                key={layer.name}
                className="border-border/70 hover:border-border transition-colors"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <Box className="w-4 h-4 text-primary" />
                      {layer.name}
                    </CardTitle>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{layer.status}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {layer.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Local Domain & Docker Quick Status */}
      <Card className="border-border/60 bg-secondary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Environment & Access Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-md bg-secondary/50 border border-border/40">
              <span className="text-muted-foreground block mb-1">Local Domain URL</span>
              <span className="font-mono text-primary font-semibold">http://wealthnest.local</span>
            </div>
            <div className="p-3 rounded-md bg-secondary/50 border border-border/40">
              <span className="text-muted-foreground block mb-1">Direct Vite Port</span>
              <span className="font-mono text-foreground font-semibold">http://localhost:5173</span>
            </div>
            <div className="p-3 rounded-md bg-secondary/50 border border-border/40">
              <span className="text-muted-foreground block mb-1">Docker Compose Project</span>
              <span className="font-mono text-foreground font-semibold">wealthnest</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
