import { Result, ok, err } from '@wealthnest/shared';
import { GoalCategory, GoalPriority } from '@wealthnest/domain';
import { SqliteDatabase } from './sqlite-connection.js';
import {
  GoalRepositoryPort,
  GoalDetailDto,
  CreateGoalParams,
  UpdateGoalParams,
  LinkHoldingToGoalParams,
} from '../../ports/goal-repository.port.js';
import { generateId } from './sqlite-utils.js';

export class SqliteGoalAdapter implements GoalRepositoryPort {
  constructor(private readonly db: SqliteDatabase) {}

  async listGoalsByUser(userId: string): Promise<Result<GoalDetailDto[]>> {
    try {
      const rows = this.db
        .prepare<{
          id: string;
          user_id: string;
          name: string;
          category: string;
          target_amount_paise: number;
          target_date: string;
          initial_saved_paise: number;
          monthly_contribution_paise: number;
          expected_return_rate: number;
          inflation_rate: number;
          priority: string;
          currency: string;
          notes?: string;
          member_id?: string;
          created_at: string;
        }>('SELECT * FROM financial_goals WHERE user_id = ? ORDER BY target_date ASC;')
        .all(userId);

      const mapped: GoalDetailDto[] = rows.map((r) => {
        const links = this.db
          .prepare<{
            holding_id: string;
            allocation_percentage: number;
            holding_name: string;
            ticker?: string;
            current_value_paise: number;
          }>(
            `SELECT 
               gh.holding_id,
               gh.allocation_percentage,
               a.name as holding_name,
               a.ticker as ticker,
               h.current_value_paise as current_value_paise
             FROM goal_holdings gh
             JOIN holdings h ON gh.holding_id = h.id
             JOIN assets a ON h.user_id = a.user_id AND h.asset_id = a.id
             WHERE gh.goal_id = ?;`
          )
          .all(r.id);

        return {
          id: r.id,
          userId: r.user_id,
          name: r.name,
          category: r.category as GoalCategory,
          targetAmountCents: r.target_amount_paise,
          targetDate: r.target_date,
          initialSavedCents: r.initial_saved_paise,
          monthlyContributionCents: r.monthly_contribution_paise,
          expectedReturnRate: r.expected_return_rate,
          inflationRate: r.inflation_rate,
          priority: r.priority as GoalPriority,
          currency: r.currency,
          notes: r.notes || undefined,
          memberId: r.member_id || undefined,
          createdAt: r.created_at,
          updatedAt: r.created_at,
          linkedHoldings: links.map((l) => ({
            holdingId: l.holding_id,
            holdingName: l.holding_name,
            ticker: l.ticker || undefined,
            allocationPercentage: l.allocation_percentage,
            currentValueCents: l.current_value_paise,
          })),
        };
      });

      return ok(mapped);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async createGoal(params: CreateGoalParams): Promise<Result<GoalDetailDto>> {
    try {
      const id = generateId('gol');
      this.db
        .prepare(
          `INSERT INTO financial_goals (
             id, user_id, name, category, target_amount_paise, target_date,
             initial_saved_paise, monthly_contribution_paise, expected_return_rate,
             inflation_rate, priority, currency, notes, member_id
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
        )
        .run(
          id,
          params.userId,
          params.name,
          params.category,
          params.targetAmountCents,
          params.targetDate,
          params.initialSavedCents ?? 0,
          params.monthlyContributionCents ?? 0,
          params.expectedReturnRate ?? 12.0,
          params.inflationRate ?? 6.0,
          params.priority ?? 'medium',
          params.currency || 'INR',
          params.notes ?? null,
          params.memberId ?? null
        );

      const listRes = await this.listGoalsByUser(params.userId);
      if (!listRes.success) return listRes;
      const found = listRes.value.find((g) => g.id === id);
      if (!found) return err(new Error('Failed to retrieve created goal'));

      return ok(found);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async updateGoal(params: UpdateGoalParams): Promise<Result<GoalDetailDto>> {
    try {
      this.db
        .prepare(
          `UPDATE financial_goals SET
             name = COALESCE(?, name),
             category = COALESCE(?, category),
             target_amount_paise = COALESCE(?, target_amount_paise),
             target_date = COALESCE(?, target_date),
             initial_saved_paise = COALESCE(?, initial_saved_paise),
             monthly_contribution_paise = COALESCE(?, monthly_contribution_paise),
             expected_return_rate = COALESCE(?, expected_return_rate),
             inflation_rate = COALESCE(?, inflation_rate),
             priority = COALESCE(?, priority),
             notes = COALESCE(?, notes),
             member_id = COALESCE(?, member_id)
           WHERE id = ? AND user_id = ?;`
        )
        .run(
          params.name ?? null,
          params.category ?? null,
          params.targetAmountCents ?? null,
          params.targetDate ?? null,
          params.initialSavedCents ?? null,
          params.monthlyContributionCents ?? null,
          params.expectedReturnRate ?? null,
          params.inflationRate ?? null,
          params.priority ?? null,
          params.notes ?? null,
          params.memberId ?? null,
          params.goalId,
          params.userId
        );

      const listRes = await this.listGoalsByUser(params.userId);
      if (!listRes.success) return listRes;
      const found = listRes.value.find((g) => g.id === params.goalId);
      if (!found) return err(new Error('Failed to retrieve updated goal'));

      return ok(found);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async deleteGoal(goalId: string, userId: string): Promise<Result<void>> {
    try {
      this.db
        .prepare('DELETE FROM financial_goals WHERE id = ? AND user_id = ?;')
        .run(goalId, userId);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async linkHoldingToGoal(params: LinkHoldingToGoalParams): Promise<Result<void>> {
    try {
      const id = generateId('gh');
      this.db
        .prepare(
          `INSERT INTO goal_holdings (id, goal_id, holding_id, allocation_percentage)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(goal_id, holding_id) DO UPDATE SET
             allocation_percentage = excluded.allocation_percentage;`
        )
        .run(id, params.goalId, params.holdingId, params.allocationPercentage);

      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async unlinkHoldingFromGoal(
    goalId: string,
    holdingId: string,
    _userId: string
  ): Promise<Result<void>> {
    try {
      this.db
        .prepare('DELETE FROM goal_holdings WHERE goal_id = ? AND holding_id = ?;')
        .run(goalId, holdingId);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}
