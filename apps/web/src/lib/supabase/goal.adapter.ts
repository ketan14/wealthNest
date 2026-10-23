import { Result, ok, err } from '@wealthnest/shared';
import {
  GoalRepositoryPort,
  GoalDetailDto,
  GoalHoldingLinkDto,
  CreateGoalParams,
  UpdateGoalParams,
  LinkHoldingToGoalParams,
} from '@wealthnest/application';
import { GoalCategory, GoalPriority } from '@wealthnest/domain';
import { supabase } from './client';

interface JoinedAllocationRow {
  goal_id: string;
  holding_id: string;
  allocation_percentage: number | string;
  holdings: {
    id: string;
    current_value_cents: number | string;
    assets: {
      name: string;
      ticker: string | null;
    } | null;
  } | null;
}

interface GoalRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  target_amount_cents: number | string;
  target_date: string;
  initial_saved_cents: number | string;
  monthly_contribution_cents: number | string;
  expected_return_rate: number | string;
  inflation_rate: number | string;
  priority: string;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export class SupabaseGoalAdapter implements GoalRepositoryPort {
  async listGoalsByUser(userId: string): Promise<Result<GoalDetailDto[]>> {
    try {
      // 1. Fetch user goals
      const { data: goalRows, error: goalError } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('target_date', { ascending: true });

      if (goalError) {
        return err(new Error(goalError.message));
      }

      if (!goalRows || goalRows.length === 0) {
        return ok([]);
      }

      const goals = goalRows as GoalRow[];
      const goalIds = goals.map((g) => g.id);

      // 2. Fetch linked holdings for these goals
      const { data: linkRows, error: linkError } = await supabase
        .from('goal_holding_allocations')
        .select(
          `
          goal_id,
          holding_id,
          allocation_percentage,
          holdings (
            id,
            current_value_cents,
            assets (
              name,
              ticker
            )
          )
        `
        )
        .in('goal_id', goalIds);

      if (linkError) {
        return err(new Error(linkError.message));
      }

      // Group links by goal_id
      const linksByGoal = new Map<string, GoalHoldingLinkDto[]>();
      const rawLinks = (linkRows || []) as unknown as JoinedAllocationRow[];

      for (const row of rawLinks) {
        const goalId = row.goal_id;
        const holdingVal = Number(row.holdings?.current_value_cents || 0);
        const allocPct = Number(row.allocation_percentage);
        const effectiveValCents = Math.round((holdingVal * allocPct) / 100);

        const linkDto: GoalHoldingLinkDto = {
          holdingId: row.holding_id,
          holdingName: row.holdings?.assets?.name || 'Unknown Asset',
          ticker: row.holdings?.assets?.ticker ?? undefined,
          allocationPercentage: allocPct,
          currentValueCents: effectiveValCents,
        };

        const existing = linksByGoal.get(goalId) || [];
        existing.push(linkDto);
        linksByGoal.set(goalId, existing);
      }

      // Map to GoalDetailDto
      const dtos: GoalDetailDto[] = goals.map((g) => ({
        id: g.id,
        userId: g.user_id,
        name: g.name,
        category: g.category as GoalCategory,
        targetAmountCents: Number(g.target_amount_cents),
        targetDate: g.target_date,
        initialSavedCents: Number(g.initial_saved_cents),
        monthlyContributionCents: Number(g.monthly_contribution_cents),
        expectedReturnRate: Number(g.expected_return_rate),
        inflationRate: Number(g.inflation_rate),
        priority: g.priority as GoalPriority,
        currency: g.currency || 'INR',
        notes: g.notes ?? undefined,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
        linkedHoldings: linksByGoal.get(g.id) || [],
      }));

      return ok(dtos);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async createGoal(params: CreateGoalParams): Promise<Result<GoalDetailDto>> {
    try {
      const { data, error } = await supabase
        .from('goals')
        .insert({
          user_id: params.userId,
          name: params.name,
          category: params.category,
          target_amount_cents: params.targetAmountCents,
          target_date: params.targetDate,
          initial_saved_cents: params.initialSavedCents || 0,
          monthly_contribution_cents: params.monthlyContributionCents || 0,
          expected_return_rate: params.expectedReturnRate ?? 12.0,
          inflation_rate: params.inflationRate ?? 6.0,
          priority: params.priority || 'medium',
          currency: params.currency || 'INR',
          notes: params.notes || null,
        })
        .select()
        .single();

      if (error) {
        return err(new Error(`Failed to create goal: ${error.message}`));
      }

      const row = data as GoalRow;
      const dto: GoalDetailDto = {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        category: row.category as GoalCategory,
        targetAmountCents: Number(row.target_amount_cents),
        targetDate: row.target_date,
        initialSavedCents: Number(row.initial_saved_cents),
        monthlyContributionCents: Number(row.monthly_contribution_cents),
        expectedReturnRate: Number(row.expected_return_rate),
        inflationRate: Number(row.inflation_rate),
        priority: row.priority as GoalPriority,
        currency: row.currency || 'INR',
        notes: row.notes ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        linkedHoldings: [],
      };

      return ok(dto);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async updateGoal(params: UpdateGoalParams): Promise<Result<GoalDetailDto>> {
    try {
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (params.name !== undefined) updates.name = params.name;
      if (params.category !== undefined) updates.category = params.category;
      if (params.targetAmountCents !== undefined) updates.target_amount_cents = params.targetAmountCents;
      if (params.targetDate !== undefined) updates.target_date = params.targetDate;
      if (params.initialSavedCents !== undefined) updates.initial_saved_cents = params.initialSavedCents;
      if (params.monthlyContributionCents !== undefined) updates.monthly_contribution_cents = params.monthlyContributionCents;
      if (params.expectedReturnRate !== undefined) updates.expected_return_rate = params.expectedReturnRate;
      if (params.inflationRate !== undefined) updates.inflation_rate = params.inflationRate;
      if (params.priority !== undefined) updates.priority = params.priority;
      if (params.notes !== undefined) updates.notes = params.notes;

      const { data, error } = await supabase
        .from('goals')
        .update(updates)
        .eq('id', params.goalId)
        .eq('user_id', params.userId)
        .select()
        .single();

      if (error) {
        return err(new Error(`Failed to update goal: ${error.message}`));
      }

      const row = data as GoalRow;
      const dto: GoalDetailDto = {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        category: row.category as GoalCategory,
        targetAmountCents: Number(row.target_amount_cents),
        targetDate: row.target_date,
        initialSavedCents: Number(row.initial_saved_cents),
        monthlyContributionCents: Number(row.monthly_contribution_cents),
        expectedReturnRate: Number(row.expected_return_rate),
        inflationRate: Number(row.inflation_rate),
        priority: row.priority as GoalPriority,
        currency: row.currency || 'INR',
        notes: row.notes ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        linkedHoldings: [],
      };

      return ok(dto);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async deleteGoal(goalId: string, userId: string): Promise<Result<void>> {
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId)
        .eq('user_id', userId);

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async linkHoldingToGoal(params: LinkHoldingToGoalParams): Promise<Result<void>> {
    try {
      const { error } = await supabase
        .from('goal_holding_allocations')
        .upsert(
          {
            goal_id: params.goalId,
            holding_id: params.holdingId,
            user_id: params.userId,
            allocation_percentage: params.allocationPercentage,
          },
          { onConflict: 'goal_id,holding_id' }
        );

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async unlinkHoldingFromGoal(goalId: string, holdingId: string, userId: string): Promise<Result<void>> {
    try {
      const { error } = await supabase
        .from('goal_holding_allocations')
        .delete()
        .eq('goal_id', goalId)
        .eq('holding_id', holdingId)
        .eq('user_id', userId);

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
