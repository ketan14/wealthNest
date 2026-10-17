-- Migration: 20260101000002_cas_import_schema.sql
-- Description: Add ISIN to assets table and create import_batches audit table for NSDL/CDSL CAS ingestion

-- 1. Add ISIN column to assets table
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS isin text;

-- Index for fast lookup and duplicate prevention per user
CREATE INDEX IF NOT EXISTS idx_assets_user_isin ON public.assets (user_id, isin) WHERE isin IS NOT NULL;

-- 2. Import Batches Table (Audit trail without storing document contents)
CREATE TABLE IF NOT EXISTS public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('NSDL', 'CDSL', 'UNKNOWN')),
  statement_date date NOT NULL,
  total_records int NOT NULL DEFAULT 0,
  imported_records int NOT NULL DEFAULT 0,
  updated_records int NOT NULL DEFAULT 0,
  skipped_records int NOT NULL DEFAULT 0,
  failed_records int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'partial')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Row Level Security (RLS) for import_batches
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own import batches"
  ON public.import_batches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own import batches"
  ON public.import_batches FOR INSERT
  WITH CHECK (auth.uid() = user_id);
