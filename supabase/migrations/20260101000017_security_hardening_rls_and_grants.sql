-- ==============================================================================
-- Migration 20260101000017: Security Hardening (Audit Log RLS, search_path, anon grants)
-- ==============================================================================

-- 1. Remove `OR auth.uid() IS NULL` from admin_audit_logs INSERT policy
DROP POLICY IF EXISTS "Platform admins can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Platform admins can insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- 2. Harden SECURITY DEFINER search_path on handle_new_user()
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- 3. Drop seed_qa_grant_admin if it was ever applied to a live database
DROP FUNCTION IF EXISTS public.seed_qa_grant_admin(uuid, text);

-- 4. Revoke blanket ALL privileges from anon in schema public, keeping only minimal read access for public taxonomy/health checks
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

GRANT SELECT ON TABLE public.asset_classes TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon;

