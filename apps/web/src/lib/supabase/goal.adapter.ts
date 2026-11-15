import { Result, ok, err } from '@wealthnest/shared';
import {
  GoalRepositoryPort,
  GoalDetailDto,
  GoalHoldingLinkDto,
  CreateGoalParams,
  UpdateGoalParams,
  LinkHoldingToGoalParams,
} from '@wealthnest/application';
import { GoalCategory, GoalPriority, RecordVisibility } from '@wealthnest/domain';
import { supabase } from './client';
import { toValidUuidOrNull } from './uuid-utils';
import { resolveHouseholdIdForWrite, syncRestrictedRecordGrants } from './household-scope';

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
  household_id: string;
  visibility: RecordVisibility;
  created_by: string | null;
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
  member_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapGoalRowToDto(
  g: GoalRow,
  linkedHoldings: readonly GoalHoldingLinkDto[]
): GoalDetailDto {
  return {
    id: g.id,
    householdId: g.household_id,
    userId: g.created_by || g.household_id,
    visibility: g.visibility,
    createdBy: g.created_by ?? undefined,
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
    memberId: g.member_id ?? undefined,
    createdAt: g.created_at,
    updatedAt: g.updated_at,
    linkedHoldings,
  };
}

export class SupabaseGoalAdapter implements GoalRepositoryPort {
  async listGoalsByHousehold(householdId: string): Promise<Result<GoalDetailDto[]>> {
    try {
      const validHouseholdId = toValidUuidOrNull(householdId);
      if (!validHouseholdId) {
        return ok([]);
      }

      const { data: goalRows, error: goalError } = await supabase
        .from('goals')
        .select('*')
        .eq('household_id', validHouseholdId)
        .order('target_date', { ascending: true });

      if (goalError) {
        return err(new Error(goalError.message));
      }

      if (!goalRows || goalRows.length === 0) {
        return ok([]);
      }

      const goals = goalRows as GoalRow[];
      const goalIds = goals.map((g) => g.id);

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

      const linksByGoal = new Map<string, GoalHoldingLinkDto[]>();
      const rawLinks = (linkRows || []) as unknown as JoinedAllocationRow[];

      for (const row of rawLinks) {
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

        const existing = linksByGoal.get(row.goal_id) || [];
        existing.push(linkDto);
        linksByGoal.set(row.goal_id, existing);
      }

      const dtos: GoalDetailDto[] = goals.map((g) =>
        mapGoalRowToDto(g, linksByGoal.get(g.id) || [])
      );

      return ok(dtos);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async listGoalsByUser(scopeId: string): Promise<Result<GoalDetailDto[]>> {
    return this.listGoalsByHousehold(scopeId);
  }

  async createGoal(params: CreateGoalParams): Promise<Result<GoalDetailDto>> {
    try {
      const householdId = await resolveHouseholdIdForWrite(params.householdId, params.userId);
      const visibility: RecordVisibility = params.visibility ?? 'household_shared';
      const actorId = toValidUuidOrNull(params.userId);

      const { data, error } = await supabase
        .from('goals')
        .insert({
          household_id: householdId,
          visibility,
          ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
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
          member_id: toValidUuidOrNull(params.memberId),
        })
        .select('*')
        .single();

      if (error || !data) {
        return err(new Error(`Failed to create goal: ${error?.message || 'Unknown error'}`));
      }

      if (visibility === 'restricted' && params.restrictedGranteeUserIds?.length) {
        await syncRestrictedRecordGrants({
          householdId,
          recordType: 'goal',
          recordId: data.id,
          visibility,
          granteeUserIds: params.restrictedGranteeUserIds,
        });
      }

      return ok(mapGoalRowToDto(data as GoalRow, []));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async updateGoal(params: UpdateGoalParams): Promise<Result<GoalDetailDto>> {
    try {
      const actorId = toValidUuidOrNull(params.userId);
      const updates: Record<string, any> = {
        ...(actorId ? { updated_by: actorId } : {}),
        updated_at: new Date().toISOString(),
      };

      if (params.name !== undefined) updates.name = params.name;
      if (params.category !== undefined) updates.category = params.category;
      if (params.targetAmountCents !== undefined)
        updates.target_amount_cents = params.targetAmountCents;
      if (params.targetDate !== undefined) updates.target_date = params.targetDate;
      if (params.initialSavedCents !== undefined)
        updates.initial_saved_cents = params.initialSavedCents;
      if (params.monthlyContributionCents !== undefined)
        updates.monthly_contribution_cents = params.monthlyContributionCents;
      if (params.expectedReturnRate !== undefined)
        updates.expected_return_rate = params.expectedReturnRate;
      if (params.inflationRate !== undefined) updates.inflation_rate = params.inflationRate;
      if (params.priority !== undefined) updates.priority = params.priority;
      if (params.notes !== undefined) updates.notes = params.notes;
      if (params.memberId !== undefined) updates.member_id = toValidUuidOrNull(params.memberId);
      if (params.visibility !== undefined) updates.visibility = params.visibility;

      const { data, error } = await supabase
        .from('goals')
        .update(updates)
        .eq('id', params.goalId)
        .select('*')
        .single();

      if (error || !data) {
        return err(new Error(`Failed to update goal: ${error?.message || 'Unknown error'}`));
      }

      return ok(mapGoalRowToDto(data as GoalRow, []));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async deleteGoal(goalId: string, _scopeId: string): Promise<Result<void>> {
    try {
      const { error } = await supabase.from('goals').delete().eq('id', goalId);

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
      let householdId = toValidUuidOrNull(params.householdId);
      if (!householdId) {
        const { data: goalRow } = await supabase
          .from('goals')
          .select('household_id')
          .eq('id', params.goalId)
          .maybeSingle();
        householdId = goalRow?.household_id ?? null;
      }
      if (!householdId) {
        householdId = await resolveHouseholdIdForWrite(undefined, params.userId);
      }

      const actorId = toValidUuidOrNull(params.userId);
      const { error } = await supabase.from('goal_holding_allocations').upsert(
        {
          household_id: householdId,
          goal_id: params.goalId,
          holding_id: params.holdingId,
          ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
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

  async unlinkHoldingFromGoal(
    goalId: string,
    holdingId: string,
    _scopeId: string
  ): Promise<Result<void>> {
    try {
      const { error } = await supabase
        .from('goal_holding_allocations')
        .delete()
        .eq('goal_id', goalId)
        .eq('holding_id', holdingId);

      if (error) {
        return err(new Error(error.message));
      }

      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
