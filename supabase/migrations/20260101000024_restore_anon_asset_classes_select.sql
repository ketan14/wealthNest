-- ==============================================================================
-- Migration 20260101000024: Restore anon SELECT on public.asset_classes
-- ==============================================================================
-- Why this forward-only migration is needed:
--   Migration 20260101000017 was initially pushed (commit 807beec) with
--   `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;` and later updated in
--   place (commit edc7a14) to add `GRANT SELECT ON TABLE public.asset_classes TO anon;`.
--   Any live database (such as QA) that already recorded version 20260101000017
--   in `supabase_migrations.schema_migrations` skipped re-running it, causing
--   PostgREST health checks (/rest/v1/asset_classes?select=id&limit=1) to fail
--   with SQLSTATE 42501 ("permission denied for table asset_classes").

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.asset_classes TO anon, authenticated;

ALTER TABLE public.asset_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Asset classes are readable by authenticated users"
  ON public.asset_classes;

CREATE POLICY "Asset classes are readable by authenticated users"
  ON public.asset_classes FOR SELECT
  TO authenticated, anon
  USING (true);
