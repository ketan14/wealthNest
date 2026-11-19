import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { useRepositories } from '@/lib/persistence/repository-context';
import {
  GoalDetailDto,
  CreateGoalUseCase,
  UpdateGoalUseCase,
  DeleteGoalUseCase,
  CreateGoalParams,
  UpdateGoalParams,
  HoldingDetailDto,
} from '@wealthnest/application';
import {
  Money,
  CurrencyCode,
  GoalCategory,
  GoalDefinition,
  GoalsSummary,
  calculateGoalsSummary,
} from '@wealthnest/domain';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AddGoalModal } from '@/components/goals/AddGoalModal';
import { TopUpGoalModal, TopUpTargetGoal } from '@/components/goals/TopUpGoalModal';
import { GoalProjectionCard } from '@/components/goals/GoalProjectionCard';
import { GoalsKpiSection } from '@/components/goals/GoalsKpiSection';
import {
  GOAL_CATEGORY_LABELS,
  GoalStatusFilter,
  GoalsGridSection,
  getGoalStatusMeta,
} from '@/components/goals/GoalsGridSection';
import { DEMO_GOALS } from '@/components/goals/goals-demo-data';
import { shouldAllowDemoData } from '@/lib/config/mobile-runtime';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { useFamily } from '@/lib/family/family-context';
import { useSupportSession } from '@/lib/admin/support-session-context';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';
import { ArrowUpDown, Plus } from 'lucide-react';

type GoalSortOption = 'target_date' | 'pct_complete' | 'monthly_gap';

export function GoalsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeHouseholdId, canEditFinancials } = useHousehold();
  const queryClient = useQueryClient();
  const { members, selectedMemberId, setSelectedMemberId } = useFamily();
  const { isSupportModeActive } = useSupportSession();
  const { goalRepo, holdingRepo, mode } = useRepositories();

  const isDemoMode = mode === 'supabase' && (!user?.id || user.id.startsWith('demo-'));
  const hasLiveBackend = !isDemoMode && Boolean(activeHouseholdId || user?.id);
  const scopeId = activeHouseholdId || user?.id || '';
  const effectiveUserId = user?.id || scopeId;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalDetailDto | null>(null);
  const [topUpGoal, setTopUpGoal] = useState<TopUpTargetGoal | null>(null);
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<{ id: string; name: string } | null>(null);
  const [monthlyExpenseRupees, setMonthlyExpenseRupees] = useState<number>(65000);
  const [statusFilter, setStatusFilter] = useState<GoalStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<GoalCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<GoalSortOption>('target_date');
  const [demoGoalsState, setDemoGoalsState] = useState<GoalDetailDto[]>(
    shouldAllowDemoData(isDemoMode) ? DEMO_GOALS : []
  );

  // Support global quick-add navigation (/goals?action=new)
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      if (canEditFinancials && !isSupportModeActive) {
        setEditingGoal(null);
        setIsAddModalOpen(true);
      }
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, canEditFinancials, isSupportModeActive]);

  // 1. Query Goals from DB (or fallback to demoGoalsState ONLY in demo preview on web)
  const { data: dbGoals } = useQuery<GoalDetailDto[]>({
    queryKey: ['user-goals', scopeId || 'demo'],
    queryFn: async () => {
      if (!hasLiveBackend || !scopeId) {
        return shouldAllowDemoData(isDemoMode) ? DEMO_GOALS : [];
      }
      const res = await (goalRepo.listGoalsByHousehold
        ? goalRepo.listGoalsByHousehold(scopeId)
        : goalRepo.listGoalsByUser(scopeId));
      return res.success ? res.value : [];
    },
    enabled: true,
  });

  const activeGoalsList: GoalDetailDto[] = hasLiveBackend ? dbGoals || [] : demoGoalsState;

  // Filter goals by selected family member entity
  const filteredGoalsList = useMemo(() => {
    if (!selectedMemberId || selectedMemberId === 'all') return activeGoalsList;
    return activeGoalsList.filter((g) => g.memberId === selectedMemberId);
  }, [activeGoalsList, selectedMemberId]);

  // 2. Query household holdings (to get liquid cash)
  const { data: dbHoldings } = useQuery<HoldingDetailDto[]>({
    queryKey: ['goals-holdings', scopeId || 'demo'],
    queryFn: async () => {
      if (!hasLiveBackend || !scopeId) return [];
      const res = await (holdingRepo.listDetailsByHousehold
        ? holdingRepo.listDetailsByHousehold(scopeId)
        : holdingRepo.listDetailsByUser(scopeId));
      return res.success ? res.value : [];
    },
    enabled: true,
  });

  // 3. Compute goals summary synchronously
  const summary: GoalsSummary = useMemo(() => {
    let liquidCashCents = 40000000n; // ₹4 Lakh default demo liquid cash
    if (hasLiveBackend && dbHoldings) {
      const targetHoldings =
        selectedMemberId && selectedMemberId !== 'all'
          ? dbHoldings.filter(
              (h) =>
                h.memberId === selectedMemberId ||
                h.owners?.some((o) => o.familyMemberId === selectedMemberId)
            )
          : dbHoldings;

      const liquidClasses = new Set(['cash', 'cash_and_bank', 'liquid_funds', 'mutual_fund']);
      liquidCashCents = targetHoldings
        .filter((h) => liquidClasses.has(h.assetClassId))
        .reduce((sum, h) => sum + BigInt(Math.round(h.currentValueCents)), 0n);
    }

    const domainGoals: GoalDefinition[] = filteredGoalsList.map((g) => {
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
        targetDate: isNaN(targetDate.getTime())
          ? new Date(Date.now() + 365 * 24 * 3600 * 1000)
          : targetDate,
        initialSaved: Money.fromCents(BigInt(g.initialSavedCents), gCurrency),
        monthlyContribution: Money.fromCents(BigInt(g.monthlyContributionCents), gCurrency),
        expectedReturnRate: g.expectedReturnRate,
        inflationRate: g.inflationRate,
        priority: g.priority,
        currency: gCurrency,
        notes: g.notes,
        memberId: g.memberId,
        linkedHoldings,
      };
    });

    const liquidMoney = Money.fromCents(liquidCashCents, 'INR');
    const expensesMoney = Money.fromDecimal(monthlyExpenseRupees, 'INR');

    return calculateGoalsSummary(domainGoals, liquidMoney, expensesMoney, 'INR');
  }, [filteredGoalsList, hasLiveBackend, dbHoldings, monthlyExpenseRupees, selectedMemberId]);

  // Create Goal Mutation
  const createMutation = useMutation({
    mutationFn: async (params: Omit<CreateGoalParams, 'userId'>) => {
      if (hasLiveBackend) {
        if (!canEditFinancials) {
          throw new Error('View-only household role cannot create financial goals.');
        }
        const useCase = new CreateGoalUseCase(goalRepo);
        const res = await useCase.execute({
          ...params,
          userId: effectiveUserId || 'local-user',
          householdId: params.householdId ?? (activeHouseholdId || undefined),
        });
        if (!res.success) throw res.error;
        return res.value;
      } else {
        // Demo mode state addition
        const newGoal: GoalDetailDto = {
          id: `demo-g-${Date.now()}`,
          userId: 'demo-user',
          householdId: activeHouseholdId || 'demo-household-vaghela',
          visibility: params.visibility ?? 'household_shared',
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
          memberId: params.memberId,
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

  // Update Goal Mutation (used by Edit Goal and Quick Top-Up)
  const updateMutation = useMutation({
    mutationFn: async (params: Omit<UpdateGoalParams, 'userId'>) => {
      if (!params.goalId.startsWith('demo-') && hasLiveBackend) {
        if (!canEditFinancials) {
          throw new Error('View-only household role cannot update financial goals.');
        }
        const useCase = new UpdateGoalUseCase(goalRepo);
        const res = await useCase.execute({
          ...params,
          userId: effectiveUserId || 'local-user',
        });
        if (!res.success) throw res.error;
        return res.value;
      }

      let updatedDemo: GoalDetailDto | undefined;
      setDemoGoalsState((prev) =>
        prev.map((g) => {
          if (g.id !== params.goalId) return g;
          updatedDemo = {
            ...g,
            name: params.name ?? g.name,
            category: params.category ?? g.category,
            targetAmountCents: params.targetAmountCents ?? g.targetAmountCents,
            targetDate: params.targetDate ?? g.targetDate,
            initialSavedCents: params.initialSavedCents ?? g.initialSavedCents,
            monthlyContributionCents:
              params.monthlyContributionCents ?? g.monthlyContributionCents,
            expectedReturnRate: params.expectedReturnRate ?? g.expectedReturnRate,
            inflationRate: params.inflationRate ?? g.inflationRate,
            priority: params.priority ?? g.priority,
            notes: params.notes !== undefined ? params.notes : g.notes,
            memberId: params.memberId !== undefined ? params.memberId : g.memberId,
            visibility: params.visibility ?? g.visibility,
            updatedAt: new Date().toISOString(),
          };
          return updatedDemo;
        })
      );
      if (!updatedDemo) {
        throw new Error('Goal not found');
      }
      return updatedDemo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-goals'] });
      setEditingGoal(null);
      setIsAddModalOpen(false);
    },
  });

  // Delete Goal Mutation
  const deleteMutation = useMutation({
    mutationFn: async (goalId: string) => {
      if (!goalId.startsWith('demo-') && hasLiveBackend) {
        if (!canEditFinancials) {
          throw new Error('View-only household role cannot delete financial goals.');
        }
        const useCase = new DeleteGoalUseCase(goalRepo);
        const res = await useCase.execute(goalId, scopeId || effectiveUserId);
        if (!res.success) throw res.error;
      } else {
        setDemoGoalsState((prev) => prev.filter((g) => g.id !== goalId));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-goals'] });
    },
  });

  const statusCounts = useMemo(() => {
    const counts = { all: summary.goals.length, on_track: 0, needs_boost: 0, completed: 0 };
    for (const ev of summary.goals) {
      counts[getGoalStatusMeta(ev).filterGroup] += 1;
    }
    return counts;
  }, [summary.goals]);

  const availableCategories = useMemo(() => {
    const set = new Set<GoalCategory>();
    for (const g of filteredGoalsList) set.add(g.category);
    return Array.from(set);
  }, [filteredGoalsList]);

  const displayedEvaluations = useMemo(() => {
    const filtered = summary.goals.filter((ev) => {
      if (statusFilter !== 'all' && getGoalStatusMeta(ev).filterGroup !== statusFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && ev.goal.category !== categoryFilter) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'pct_complete') {
        return b.fundedPercentage - a.fundedPercentage;
      }
      if (sortBy === 'monthly_gap') {
        return Number(b.monthlySipShortfall.cents - a.monthlySipShortfall.cents);
      }
      return a.goal.targetDate.getTime() - b.goal.targetDate.getTime();
    });
  }, [summary.goals, statusFilter, categoryFilter, sortBy]);

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2 sm:items-center sm:gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="text-[11px] font-mono border-border/80 whitespace-nowrap"
            >
              India First (₹ INR)
            </Badge>
            {!hasLiveBackend && (
              <Badge
                variant="secondary"
                className="text-[11px] bg-blue-500/10 text-blue-400 border-blue-500/20 whitespace-nowrap"
              >
                Demo Mode
              </Badge>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground truncate">
            Financial Goals & Milestones
          </h1>
          <p className="hidden sm:block text-sm text-muted-foreground mt-0.5">
            Track target dates, corpus progress, and monthly SIP pace.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2 shrink-0 pt-0.5 sm:pt-0">
          <Button
            size="sm"
            onClick={() => {
              if (canEditFinancials && !isSupportModeActive) {
                setEditingGoal(null);
                setIsAddModalOpen(true);
              }
            }}
            disabled={isSupportModeActive || !canEditFinancials}
            title={
              isSupportModeActive
                ? 'Disabled in Support Impersonation Mode (Read-Only)'
                : !canEditFinancials
                  ? 'View-only household role cannot create financial goals'
                  : 'Create Goal'
            }
            className="h-8 px-2.5 sm:px-3 text-xs gap-1 sm:gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-sm whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
            <span>Create Goal</span>
          </Button>
        </div>
      </div>

      {/* Compact "MY FAMILY" Horizontal Scroll Strip */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground sm:hidden">
          <span className="font-semibold uppercase tracking-wider text-slate-400 text-[11px]">
            My Family
          </span>
          <button
            type="button"
            onClick={() => setIsManageFamilyOpen(true)}
            className="text-[10px] text-primary hover:underline"
          >
            Manage
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setSelectedMemberId('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
              selectedMemberId === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary/60 text-muted-foreground hover:bg-secondary border border-border/60'
            }`}
          >
            Combined Family ({members.length})
          </button>

          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMemberId(m.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                selectedMemberId === m.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-secondary border border-border/60'
              }`}
            >
              {m.name}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setIsManageFamilyOpen(true)}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary border border-border/60 whitespace-nowrap shrink-0"
          >
            <span>+ Manage</span>
          </button>
        </div>
      </div>

      <GoalsKpiSection
        summary={summary}
        monthlyExpenseRupees={monthlyExpenseRupees}
        onMonthlyExpenseChange={setMonthlyExpenseRupees}
      />

      {/* Filter & Sort Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 pt-1">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'on_track', label: 'On Track' },
              { id: 'needs_boost', label: 'Needs Boost' },
              { id: 'completed', label: 'Completed' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 border ${
                statusFilter === item.id
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                  : 'bg-secondary/50 text-muted-foreground hover:text-foreground border-border/60'
              }`}
            >
              {item.label} ({statusCounts[item.id]})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            aria-label="Filter goals by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as GoalCategory | 'all')}
            className="h-8 px-2.5 rounded-lg bg-secondary/60 border border-border/70 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">All Categories</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {GOAL_CATEGORY_LABELS[cat] || cat}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-secondary/60 border border-border/70">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              aria-label="Sort goals by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as GoalSortOption)}
              className="bg-transparent text-xs text-foreground focus:outline-none"
            >
              <option value="target_date">Target Date</option>
              <option value="pct_complete">% Complete</option>
              <option value="monthly_gap">Monthly Gap</option>
            </select>
          </div>
        </div>
      </div>

      <GoalsGridSection
        evaluations={displayedEvaluations}
        totalGoalsCount={summary.goals.length}
        members={members}
        canEditFinancials={canEditFinancials && !isSupportModeActive}
        onTopUpGoal={(goal) => {
          if (canEditFinancials && !isSupportModeActive) setTopUpGoal(goal);
        }}
        onEditGoal={(goalId) => {
          if (!canEditFinancials || isSupportModeActive) return;
          const found = filteredGoalsList.find((g) => g.id === goalId);
          if (found) {
            setEditingGoal(found);
            setIsAddModalOpen(true);
          }
        }}
        onDeleteGoal={(goal) => {
          if (canEditFinancials && !isSupportModeActive) setGoalToDelete(goal);
        }}
        onCreateGoal={() => {
          if (canEditFinancials && !isSupportModeActive) {
            setEditingGoal(null);
            setIsAddModalOpen(true);
          }
        }}
        onResetFilters={() => {
          setStatusFilter('all');
          setCategoryFilter('all');
        }}
      />

      {/* Goal Milestone Projection Curve & Step-Up SIP Simulator */}
      <GoalProjectionCard goals={filteredGoalsList} />

      {/* Add / Edit Goal Modal */}
      <AddGoalModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingGoal(null);
        }}
        initialGoal={editingGoal}
        onSubmit={async (params) => {
          await createMutation.mutateAsync(params);
        }}
        onUpdate={async (params) => {
          await updateMutation.mutateAsync(params);
        }}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* Quick Top-Up Contribution Modal */}
      <TopUpGoalModal
        goal={topUpGoal}
        isSubmitting={updateMutation.isPending}
        onClose={() => setTopUpGoal(null)}
        onConfirm={async (goalId, additionalCents) => {
          const existing = activeGoalsList.find((g) => g.id === goalId);
          const nextSavedCents = (existing?.initialSavedCents ?? topUpGoal?.currentSavedCents ?? 0) + additionalCents;
          await updateMutation.mutateAsync({
            goalId,
            initialSavedCents: nextSavedCents,
          });
        }}
      />

      {/* Phase 6A: Manage Family Entities Modal */}
      <ManageFamilyModal isOpen={isManageFamilyOpen} onClose={() => setIsManageFamilyOpen(false)} />

      {/* Phase 9.2: Accessible Non-Blocking Delete Confirmation Modal */}
      <ConfirmActionModal
        isOpen={Boolean(goalToDelete)}
        title="Delete Financial Goal"
        message={`Are you sure you want to delete the goal "${goalToDelete?.name}"? Progress and target projections will be removed.`}
        confirmLabel="Delete Goal"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (goalToDelete) {
            deleteMutation.mutate(goalToDelete.id);
            setGoalToDelete(null);
          }
        }}
        onCancel={() => setGoalToDelete(null)}
      />
    </div>
  );
}
export default GoalsPage;
