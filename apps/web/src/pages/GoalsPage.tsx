import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/supabase/auth-context';
import { useRepositories } from '@/lib/persistence/repository-context';
import {
  GoalDetailDto,
  CreateGoalUseCase,
  DeleteGoalUseCase,
  CreateGoalParams,
  HoldingDetailDto,
} from '@wealthnest/application';
import {
  Money,
  CurrencyCode,
  GoalDefinition,
  GoalsSummary,
  calculateGoalsSummary,
} from '@wealthnest/domain';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AddGoalModal } from '@/components/goals/AddGoalModal';
import { GoalProjectionCard } from '@/components/goals/GoalProjectionCard';
import { GoalsKpiSection } from '@/components/goals/GoalsKpiSection';
import { GoalsGridSection } from '@/components/goals/GoalsGridSection';
import { DEMO_GOALS } from '@/components/goals/goals-demo-data';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { useFamily } from '@/lib/family/family-context';
import { useSupportSession } from '@/lib/admin/support-session-context';
import { usePreferences } from '@/lib/preferences/preferences-context';
import { FamilyFilterBar } from '@/components/family/FamilyFilterBar';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';
import { Plus } from 'lucide-react';

export function GoalsPage() {
  const { user } = useAuth();
  const userId = user?.id || '';
  const queryClient = useQueryClient();
  const { members, selectedMemberId } = useFamily();
  const { isSupportModeActive } = useSupportSession();
  const { goalRepo, holdingRepo } = useRepositories();
  const { currencySymbol, preferences } = usePreferences();
  const locale = preferences.numberFormat || 'en-IN';

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<{ id: string; name: string } | null>(null);
  const [monthlyExpenseRupees, setMonthlyExpenseRupees] = useState<number>(65000);
  const [demoGoalsState, setDemoGoalsState] = useState<GoalDetailDto[]>(DEMO_GOALS);

  // 1. Query Goals from DB (or fallback to demoGoalsState)
  const { data: dbGoals } = useQuery<GoalDetailDto[]>({
    queryKey: ['user-goals', userId],
    queryFn: async () => {
      if (!userId) return DEMO_GOALS;
      const res = await goalRepo.listGoalsByUser(userId);
      if (!res.success || res.value.length === 0) return DEMO_GOALS;
      return res.value;
    },
    enabled: true,
  });

  const activeGoalsList: GoalDetailDto[] = userId ? dbGoals || DEMO_GOALS : demoGoalsState;

  // Filter goals by selected family member entity
  const filteredGoalsList = useMemo(() => {
    if (!selectedMemberId || selectedMemberId === 'all') return activeGoalsList;
    return activeGoalsList.filter((g) => g.memberId === selectedMemberId);
  }, [activeGoalsList, selectedMemberId]);

  // 2. Query user holdings (to get liquid cash)
  const { data: dbHoldings } = useQuery<HoldingDetailDto[]>({
    queryKey: ['goals-holdings', userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await holdingRepo.listDetailsByUser(userId);
      return res.success ? res.value : [];
    },
    enabled: true,
  });

  // 3. Compute goals summary synchronously
  const summary: GoalsSummary = useMemo(() => {
    let liquidCashCents = 40000000n; // ₹4 Lakh default demo liquid cash
    if (userId && dbHoldings) {
      const targetHoldings =
        selectedMemberId && selectedMemberId !== 'all'
          ? dbHoldings.filter((h) => h.memberId === selectedMemberId)
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
  }, [filteredGoalsList, userId, dbHoldings, monthlyExpenseRupees, selectedMemberId]);

  // Create Goal Mutation
  const createMutation = useMutation({
    mutationFn: async (params: Omit<CreateGoalParams, 'userId'>) => {
      if (userId) {
        const useCase = new CreateGoalUseCase(goalRepo);
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
        const useCase = new DeleteGoalUseCase(goalRepo);
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

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <Badge variant="outline" className="text-[11px] font-mono border-border/80 whitespace-nowrap">
              India First (₹ INR)
            </Badge>
            {!userId && (
              <Badge
                variant="secondary"
                className="text-[11px] bg-blue-500/10 text-blue-400 border-blue-500/20 whitespace-nowrap"
              >
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
          <Button
            onClick={() => setIsAddModalOpen(true)}
            disabled={isSupportModeActive}
            title={
              isSupportModeActive ? 'Disabled in Support Impersonation Mode (Read-Only)' : undefined
            }
            className="gap-2 shadow-md disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Create Financial Goal
          </Button>
        </div>
      </div>

      {/* Phase 6A: Family Entity Switcher Bar */}
      <FamilyFilterBar
        showAccountSelector={false}
        onOpenManageModal={() => setIsManageFamilyOpen(true)}
      />

      <GoalsKpiSection
        summary={summary}
        currencySymbol={currencySymbol}
        locale={locale}
        monthlyExpenseRupees={monthlyExpenseRupees}
        onMonthlyExpenseChange={setMonthlyExpenseRupees}
      />

      <GoalsGridSection summary={summary} members={members} onDeleteGoal={setGoalToDelete} />

      {/* Goal Milestone Projection Curve & Step-Up SIP Simulator */}
      <GoalProjectionCard goals={filteredGoalsList} />

      {/* Add Goal Modal */}
      <AddGoalModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={async (params) => {
          await createMutation.mutateAsync(params);
        }}
        isSubmitting={createMutation.isPending}
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
