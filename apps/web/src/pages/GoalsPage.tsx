import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/supabase/auth-context';
import { SupabaseGoalAdapter } from '@/lib/supabase/goal.adapter';
import { SupabaseHoldingAdapter } from '@/lib/supabase/holding.adapter';
import {
  GoalDetailDto,
  CreateGoalUseCase,
  DeleteGoalUseCase,
  CreateGoalParams,
  HoldingDetailDto,
} from '@wealthnest/application';
import {
  Money,
  GoalCategory,
  CurrencyCode,
  GoalDefinition,
  GoalsSummary,
  calculateGoalsSummary,
} from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AddGoalModal } from '@/components/goals/AddGoalModal';
import {
  Target,
  Sparkles,
  ShieldAlert,
  Building2,
  GraduationCap,
  Car,
  Plane,
  HeartHandshake,
  TrendingUp,
  Plus,
  Trash2,
  Calendar,
  Database,
  Wallet,
} from 'lucide-react';

const CATEGORY_ICONS: Record<GoalCategory, any> = {
  emergency_fund: ShieldAlert,
  retirement: Target,
  home_purchase: Building2,
  education: GraduationCap,
  wealth_creation: Sparkles,
  vehicle: Car,
  vacation: Plane,
  other: HeartHandshake,
};

// Realistic pre-seeded Indian demo goals for unauthenticated visitors
const DEMO_GOALS: GoalDetailDto[] = [
  {
    id: 'demo-g1',
    userId: 'demo-user',
    name: 'Emergency Reserve Fund (6 Months)',
    category: 'emergency_fund',
    targetAmountCents: 40000000, // ₹4,00,000
    targetDate: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0]!,
    initialSavedCents: 40000000, // ₹4,00,000 (100% funded)
    monthlyContributionCents: 0,
    expectedReturnRate: 6.5,
    inflationRate: 0,
    priority: 'critical',
    currency: 'INR',
    notes: 'Liquid fixed deposit and arbitrage fund reserves for unforeseen emergencies.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    linkedHoldings: [],
  },
  {
    id: 'demo-g2',
    userId: 'demo-user',
    name: 'Retirement & Financial Independence (FIRE)',
    category: 'retirement',
    targetAmountCents: 2500000000, // ₹2.50 Crore
    targetDate: new Date(Date.now() + 14 * 365 * 24 * 3600 * 1000).toISOString().split('T')[0]!,
    initialSavedCents: 280000000, // ₹28 Lakh
    monthlyContributionCents: 4500000, // ₹45,000 / month
    expectedReturnRate: 12.0,
    inflationRate: 6.0,
    priority: 'critical',
    currency: 'INR',
    notes: 'Long-term equity mutual funds, PPF, and EPF accumulation.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    linkedHoldings: [],
  },
  {
    id: 'demo-g3',
    userId: 'demo-user',
    name: 'Apartment Down Payment (3BHK)',
    category: 'home_purchase',
    targetAmountCents: 400000000, // ₹40 Lakh
    targetDate: new Date(Date.now() + 3.5 * 365 * 24 * 3600 * 1000).toISOString().split('T')[0]!,
    initialSavedCents: 150000000, // ₹15 Lakh
    monthlyContributionCents: 4000000, // ₹40,000 / month
    expectedReturnRate: 10.0,
    inflationRate: 6.0,
    priority: 'high',
    currency: 'INR',
    notes: 'Corporate bonds and hybrid debt fund savings for home purchase.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    linkedHoldings: [],
  },
  {
    id: 'demo-g4',
    userId: 'demo-user',
    name: 'Child Higher Education Fund',
    category: 'education',
    targetAmountCents: 350000000, // ₹35 Lakh
    targetDate: new Date(Date.now() + 8 * 365 * 24 * 3600 * 1000).toISOString().split('T')[0]!,
    initialSavedCents: 60000000, // ₹6 Lakh
    monthlyContributionCents: 1500000, // ₹15,000 / month
    expectedReturnRate: 11.5,
    inflationRate: 8.5,
    priority: 'high',
    currency: 'INR',
    notes: 'Targeting overseas master degree corpus factoring higher education inflation.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    linkedHoldings: [],
  },
];

export function GoalsPage() {
  const { user } = useAuth();
  const userId = user?.id || '';
  const queryClient = useQueryClient();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [monthlyExpenseRupees, setMonthlyExpenseRupees] = useState<number>(65000);
  const [demoGoalsState, setDemoGoalsState] = useState<GoalDetailDto[]>(DEMO_GOALS);

  // 1. Query Goals from DB (or fallback to demoGoalsState)
  const { data: dbGoals } = useQuery<GoalDetailDto[]>({
    queryKey: ['user-goals', userId],
    queryFn: async () => {
      if (!userId) return DEMO_GOALS;
      const adapter = new SupabaseGoalAdapter();
      const res = await adapter.listGoalsByUser(userId);
      if (!res.success || res.value.length === 0) return DEMO_GOALS;
      return res.value;
    },
    enabled: true,
  });

  const activeGoalsList: GoalDetailDto[] = userId ? (dbGoals || DEMO_GOALS) : demoGoalsState;

  // 2. Query user holdings (to get liquid cash)
  const { data: dbHoldings } = useQuery<HoldingDetailDto[]>({
    queryKey: ['goals-holdings', userId],
    queryFn: async () => {
      if (!userId) return [];
      const adapter = new SupabaseHoldingAdapter();
      const res = await adapter.listDetailsByUser(userId);
      return res.success ? res.value : [];
    },
    enabled: true,
  });

  // 3. Compute goals summary synchronously
  const summary: GoalsSummary = useMemo(() => {
    let liquidCashCents = 40000000n; // ₹4 Lakh default demo liquid cash
    if (userId && dbHoldings) {
      liquidCashCents = dbHoldings
        .filter((h) => h.assetClassId === 'cash')
        .reduce((sum, h) => sum + BigInt(Math.round(h.currentValueCents)), 0n);
    }

    const domainGoals: GoalDefinition[] = activeGoalsList.map((g) => {
      const gCurrency = (g.currency as CurrencyCode) || 'INR';
      const targetDate = new Date(g.targetDate);

      const linkedHoldings = g.linkedHoldings.map((link) => ({
        holdingId: link.holdingId,
        holdingName: link.holdingName,
        allocationPercentage: link.allocationPercentage,
        allocatedValue: Money.fromCents(BigInt(Math.round(link.currentValueCents)), gCurrency),
      }));

      return {
        id: g.id,
        userId: g.userId,
        name: g.name,
        category: g.category,
        targetAmount: Money.fromCents(BigInt(g.targetAmountCents), gCurrency),
        targetDate: isNaN(targetDate.getTime()) ? new Date(Date.now() + 365 * 24 * 3600 * 1000) : targetDate,
        initialSaved: Money.fromCents(BigInt(g.initialSavedCents), gCurrency),
        monthlyContribution: Money.fromCents(BigInt(g.monthlyContributionCents), gCurrency),
        expectedReturnRate: g.expectedReturnRate,
        inflationRate: g.inflationRate,
        priority: g.priority,
        currency: gCurrency,
        notes: g.notes,
        linkedHoldings,
      };
    });

    const liquidMoney = Money.fromCents(liquidCashCents, 'INR');
    const expensesMoney = Money.fromDecimal(monthlyExpenseRupees, 'INR');

    return calculateGoalsSummary(domainGoals, liquidMoney, expensesMoney, 'INR');
  }, [activeGoalsList, userId, dbHoldings, monthlyExpenseRupees]);

  // Create Goal Mutation
  const createMutation = useMutation({
    mutationFn: async (params: Omit<CreateGoalParams, 'userId'>) => {
      if (userId) {
        const adapter = new SupabaseGoalAdapter();
        const useCase = new CreateGoalUseCase(adapter);
        const res = await useCase.execute({ ...params, userId });
        if (!res.success) throw res.error;
        return res.value;
      } else {
        // Demo mode state addition
        const newGoal: GoalDetailDto = {
          id: `demo-g-${Date.now()}`,
          userId: 'demo-user',
          name: params.name,
          category: params.category,
          targetAmountCents: params.targetAmountCents,
          targetDate: params.targetDate,
          initialSavedCents: params.initialSavedCents || 0,
          monthlyContributionCents: params.monthlyContributionCents || 0,
          expectedReturnRate: params.expectedReturnRate ?? 12.0,
          inflationRate: params.inflationRate ?? 6.0,
          priority: params.priority || 'medium',
          currency: 'INR',
          notes: params.notes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          linkedHoldings: [],
        };
        setDemoGoalsState((prev) => [...prev, newGoal]);
        return newGoal;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-goals'] });
      setIsAddModalOpen(false);
    },
  });

  // Delete Goal Mutation
  const deleteMutation = useMutation({
    mutationFn: async (goalId: string) => {
      if (userId) {
        const adapter = new SupabaseGoalAdapter();
        const useCase = new DeleteGoalUseCase(adapter);
        const res = await useCase.execute(goalId, userId);
        if (!res.success) throw res.error;
      } else {
        setDemoGoalsState((prev) => prev.filter((g) => g.id !== goalId));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-goals'] });
    },
  });

  // Helper formatting values
  const totalTargetMoney = summary.totalTargetCorpus;
  const totalCurrentMoney = summary.totalCurrentCorpus;
  const totalCommittedMoney = summary.totalMonthlyCommittedSip;
  const liquidCorpusMoney = summary.emergencyFund.liquidCorpus;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Phase 5: Financial Goals & Milestones
            </span>
            <Badge variant="outline" className="text-[11px] font-mono border-border/80">
              India First (₹ INR)
            </Badge>
            {userId ? (
              <Badge variant="secondary" className="text-[11px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                <Database className="w-3 h-3 mr-1 inline" />
                Live PostgreSQL Data
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[11px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                Demo Mode
              </Badge>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Financial Goals & Milestones
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Inflation-adjusted target corpus planning, monthly SIP math, and emergency fund runway.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsAddModalOpen(true)} className="gap-2 shadow-md">
            <Plus className="w-4 h-4" />
            Create Financial Goal
          </Button>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Emergency Runway */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Emergency Runway</span>
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-emerald-400 font-mono">
                {summary ? `${summary.emergencyFund.monthsRunway.toFixed(1)} Mos` : '0 Mos'}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  (summary?.emergencyFund.monthsRunway || 0) >= 6
                    ? 'text-emerald-400 border-emerald-500/30'
                    : (summary?.emergencyFund.monthsRunway || 0) >= 3
                    ? 'text-amber-400 border-amber-500/30'
                    : 'text-rose-400 border-rose-500/30'
                }`}
              >
                {(summary?.emergencyFund.monthsRunway || 0) >= 6 ? 'Optimal Buffer' : 'Action Needed'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Liquid Cash: <span className="font-semibold text-foreground font-mono">{liquidCorpusMoney.formatIndianCompact()}</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Target Corpus */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Target Corpus Sum</span>
              <Target className="w-4 h-4 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {totalTargetMoney.formatIndianCompact()}
              </span>
              <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">
                Future Value
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Across <span className="font-semibold text-foreground">{summary?.totalGoalsCount || 0} active milestones</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Current Funded Corpus */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Accumulated Corpus</span>
              <Wallet className="w-4 h-4 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {totalCurrentMoney.formatIndianCompact()}
              </span>
              <span className="text-xs text-emerald-400 font-mono font-bold">
                ({summary ? summary.overallFundedPercentage.toFixed(1) : 0}%)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Funded of overall target requirements
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Monthly SIP Commitment */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Committed Monthly SIP</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {totalCommittedMoney.formatIndianCompact()}/m
              </span>
              <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                {summary?.goalsOnTrackCount || 0}/{summary?.totalGoalsCount || 0} On Track
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              Required SIP: <span className="font-semibold text-foreground font-mono">
                {Money.fromCents(BigInt(summary?.totalRequiredMonthlySip.cents || '0'), 'INR').formatIndianCompact()}/m
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Emergency Fund Interactive Burn Rate Section */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-md">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-emerald-400" />
                Emergency Reserve Buffer & Burn Rate Analyzer
              </CardTitle>
              <CardDescription className="text-xs">
                Indian personal finance guideline recommends maintaining 3 to 6 months of mandatory living expenses in liquid cash or overnight arbitrage funds.
              </CardDescription>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-medium">Monthly Living Expense:</span>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-accent/40 rounded-xl border border-border/80 text-xs font-mono font-bold text-foreground">
                <span>₹</span>
                <span>{monthlyExpenseRupees.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress bar visual */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">Current Buffer: <b className="text-foreground">{liquidCorpusMoney.formatIndianCompact()}</b></span>
              <span className="text-muted-foreground">6-Month Target: <b className="text-emerald-400">{Money.fromDecimal(monthlyExpenseRupees * 6, 'INR').formatIndianCompact()}</b></span>
            </div>
            <div className="w-full bg-secondary rounded-full h-3 overflow-hidden relative">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  (summary?.emergencyFund.monthsRunway || 0) >= 6
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : (summary?.emergencyFund.monthsRunway || 0) >= 3
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, ((summary?.emergencyFund.monthsRunway || 0) / 6) * 100)}%` }}
              />
            </div>
          </div>

          {/* Interactive expense slider */}
          <div className="pt-2 flex items-center gap-4 text-xs">
            <span className="text-muted-foreground flex-shrink-0">Simulate Monthly Burn:</span>
            <input
              type="range"
              min="20000"
              max="250000"
              step="5000"
              value={monthlyExpenseRupees}
              onChange={(e) => setMonthlyExpenseRupees(parseInt(e.target.value))}
              className="w-full accent-primary h-1.5 bg-secondary rounded-lg cursor-pointer"
            />
          </div>
        </CardContent>
      </Card>

      {/* Goal Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Active Financial Milestones
          </h3>
          <span className="text-xs text-muted-foreground">
            {summary?.goals.length || 0} milestones tracked
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {summary?.goals.map((evalResult) => {
            const goal = evalResult.goal;
            const Icon = CATEGORY_ICONS[goal.category] || Target;
            const targetMoney = goal.targetAmount;
            const futureTargetMoney = evalResult.futureTargetAmount;
            const currentCorpusMoney = evalResult.currentTotalCorpus;
            const monthlySipMoney = goal.monthlyContribution;
            const requiredSipMoney = evalResult.requiredMonthlySip;
            const targetDateStr = goal.targetDate instanceof Date
              ? goal.targetDate.toISOString().split('T')[0]!
              : String(goal.targetDate);

            return (
              <Card key={goal.id} className="border-border/80 bg-card/60 backdrop-blur-md hover:border-primary/40 transition-all flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0 mt-0.5">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-foreground leading-snug">{goal.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                            <Calendar className="w-3.5 h-3.5" />
                            {targetDateStr}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            ({evalResult.monthsRemaining} mos remaining)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize font-bold ${
                          evalResult.status === 'achieved'
                            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                            : evalResult.status === 'ahead'
                            ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                            : evalResult.status === 'on_track'
                            ? 'text-teal-400 border-teal-500/30 bg-teal-500/10'
                            : evalResult.status === 'behind'
                            ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                            : 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                        }`}
                      >
                        {evalResult.status.replace('_', ' ')}
                      </Badge>

                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete goal "${goal.name}"?`)) {
                            deleteMutation.mutate(goal.id);
                          }
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-rose-400 transition-colors"
                        title="Delete Goal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-1">
                  {/* Funded Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-muted-foreground">
                        Accumulated: <b className="text-foreground">{currentCorpusMoney.formatIndianCompact()}</b>
                      </span>
                      <span className="text-muted-foreground">
                        Target: <b className="text-foreground">{targetMoney.formatIndianCompact()}</b>
                      </span>
                    </div>

                    <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          evalResult.isFunded ? 'bg-emerald-400' : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(100, evalResult.fundedPercentage)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Funded: <b className="text-emerald-400 font-mono">{evalResult.fundedPercentage.toFixed(1)}%</b></span>
                      {goal.inflationRate > 0 && (
                        <span>
                          Inflation-adjusted target ({goal.inflationRate}% p.a.):{' '}
                          <b className="text-foreground font-mono">{futureTargetMoney.formatIndianCompact()}</b>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Monthly SIP Breakdown */}
                  <div className="p-3 rounded-xl bg-accent/20 border border-border/60 flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Committed SIP</span>
                      <span className="font-bold text-foreground text-sm">{monthlySipMoney.formatIndianCompact()}/mo</span>
                    </div>

                    <div className="text-right">
                      <span className="text-muted-foreground block text-[10px] uppercase">Required SIP</span>
                      <span className={`font-bold text-sm ${
                        monthlySipMoney.cents >= requiredSipMoney.cents ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {requiredSipMoney.formatIndianCompact()}/mo
                      </span>
                    </div>
                  </div>

                  {goal.notes && (
                    <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-2">
                      "{goal.notes}"
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Add Goal Modal */}
      <AddGoalModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={async (params) => {
          await createMutation.mutateAsync(params);
        }}
        isSubmitting={createMutation.isPending}
      />
    </div>
  );
}
export default GoalsPage;
