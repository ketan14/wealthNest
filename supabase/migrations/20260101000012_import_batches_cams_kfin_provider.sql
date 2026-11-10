-- Migration 20260101000012: allow CAMS/KFin Consolidated Account Summary (and broker CSV) imports
-- in the import_batches audit trail.
ALTER TABLE public.import_batches DROP CONSTRAINT IF EXISTS import_batches_provider_check;
ALTER TABLE public.import_batches
  ADD CONSTRAINT import_batches_provider_check
  CHECK (provider IN ('NSDL', 'CDSL', 'CAMS_KFIN', 'ZERODHA', 'GROWW', 'UNKNOWN'));
