-- ==============================================================================
-- WealthNest Phase 6A Extended: Family Goals & Liabilities Scoping Migration
-- ==============================================================================

-- 1. Extend Goals Table with Family Member / Beneficiary Reference
ALTER TABLE public.goals 
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.family_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_goals_member 
  ON public.goals (member_id);

-- 2. Extend Liabilities Table with Primary Borrower & Co-Borrower References
ALTER TABLE public.liabilities 
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.family_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS co_borrower_ids uuid[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_liabilities_member 
  ON public.liabilities (member_id);
