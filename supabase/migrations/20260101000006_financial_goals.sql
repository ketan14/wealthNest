-- ==============================================================================
-- WealthNest Phase 5: Financial Goals & Milestones Schema Migration
-- ==============================================================================

-- 1. Goals Table (User-defined financial targets, retirement, emergency fund)
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (
    category IN ('emergency_fund', 'retirement', 'home_purchase', 'education', 'wealth_creation', 'vehicle', 'vacation', 'other')
  ),
  target_amount_cents bigint NOT NULL CHECK (target_amount_cents > 0),
  target_date date NOT NULL,
  initial_saved_cents bigint NOT NULL DEFAULT 0 CHECK (initial_saved_cents >= 0),
  monthly_contribution_cents bigint NOT NULL DEFAULT 0 CHECK (monthly_contribution_cents >= 0),
  expected_return_rate numeric(5, 2) NOT NULL DEFAULT 12.00 CHECK (expected_return_rate >= 0),
  inflation_rate numeric(5, 2) NOT NULL DEFAULT 6.00 CHECK (inflation_rate >= 0),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  currency text NOT NULL DEFAULT 'INR',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_category 
  ON public.goals (user_id, category);

CREATE INDEX IF NOT EXISTS idx_goals_user_target_date 
  ON public.goals (user_id, target_date ASC);

-- 2. Goal Holding Allocations Table (Links specific assets/holdings to a goal)
CREATE TABLE IF NOT EXISTS public.goal_holding_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  holding_id uuid NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allocation_percentage numeric(5, 2) NOT NULL DEFAULT 100.00 CHECK (
    allocation_percentage > 0 AND allocation_percentage <= 100.00
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_goal_holding UNIQUE (goal_id, holding_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_holding_allocations_goal 
  ON public.goal_holding_allocations (goal_id);

CREATE INDEX IF NOT EXISTS idx_goal_holding_allocations_holding 
  ON public.goal_holding_allocations (holding_id);

-- ==============================================================================
-- Row-Level Security (RLS)
-- ==============================================================================

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_holding_allocations ENABLE ROW LEVEL SECURITY;

-- Goals Policies
CREATE POLICY "Users can manage their own goals"
  ON public.goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Goal Holding Allocations Policies
CREATE POLICY "Users can manage their own goal holding allocations"
  ON public.goal_holding_allocations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
