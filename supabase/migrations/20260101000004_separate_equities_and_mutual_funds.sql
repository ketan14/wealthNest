-- Migration 20260101000004: Separate Direct Equities and Mutual Funds
-- Adds structured instrument details, folios, demat accounts, and relaxes single-holding per asset constraint

-- 1. Structured instrument fields on assets table
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS instrument_type text DEFAULT 'equity_share';
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS amc_name text;

-- 2. Structured holding columns for Demat accounts, Folios, Plans, and Cost Basis verification
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS demat_account_id text;
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS folio_number text;
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS amc_name text;
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS scheme_plan text;
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS cost_basis_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- 3. Relax single-holding constraint to support multiple folios of the same scheme or multiple demat accounts
ALTER TABLE public.holdings DROP CONSTRAINT IF EXISTS unique_user_asset;

-- Unique index ensuring idempotent holdings per user + asset + folio + demat account
CREATE UNIQUE INDEX IF NOT EXISTS idx_holdings_user_asset_account 
  ON public.holdings (user_id, asset_id, COALESCE(folio_number, ''), COALESCE(demat_account_id, ''));

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_holdings_folio ON public.holdings (user_id, folio_number) WHERE folio_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_holdings_demat ON public.holdings (user_id, demat_account_id) WHERE demat_account_id IS NOT NULL;
