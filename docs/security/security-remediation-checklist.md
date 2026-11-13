# WealthNest — Security Remediation Checklist

**Derived From:** [wealthnest-security-audit.md](file:///home/ketan/projects/Krisha/wealthNest/docs/security/wealthnest-security-audit.md)  
**Target:** `/home/ketan/projects/Krisha/wealthNest`  
**Status:** Open — Pre-Production Blockers Identified

---

## P0 — Critical Blockers (Must Fix Before Any Staging/Production Exposure)

- [ ] **P0-1: Remove Frontend Admin Authorization Bypass & Simulation Backdoors**
  - **Files:** `apps/web/src/lib/admin/admin-context.tsx`, `apps/web/src/components/admin/AdminGuard.tsx`
  - **Action:**
    - Initialize `role` to `null` (never `'super_admin'`).
    - Remove `sessionStorage` (`wealthnest_simulated_admin_role`) trust in production builds.
    - Remove email heuristics (`email.includes('admin')`, `'investor@wealthnest.local'`), `!user`, and `catch` fallbacks that grant `'super_admin'`.
    - Remove the `seed_qa_grant_admin` self-elevation button from `AdminGuard.tsx`.
  - **Verify:** Unauthenticated or non-admin users receive `null` role on RPC failure or missing DB record and are denied `/admin/*` access.

- [ ] **P0-2: Remove / Lock Down `seed_qa_grant_admin` in `supabase/seed_qa.sql`**
  - **File:** `supabase/seed_qa.sql:22-50`
  - **Action:**
    - Verify via Supabase SQL Editor that `public.seed_qa_grant_admin` does **not** exist in production (`DROP FUNCTION IF EXISTS public.seed_qa_grant_admin(uuid, text);`).
    - Restrict `seed_qa.sql` functions to `SET search_path = public` and revoke `EXECUTE` from `anon` and `authenticated` (`REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated;`).
  - **Verify:** Calling `supabase.rpc('seed_qa_grant_admin', ...)` as `anon` or `authenticated` fails with permission denied.

---

## P1 — High-Severity Security Fixes (Required Before Production Launch)

- [ ] **P1-1: Remove `auth.uid() IS NULL` from `admin_audit_logs` INSERT Policy**
  - **File:** `supabase/migrations/20260101000009_admin_portal_and_access_control.sql:202-204`
  - **Action:** Create a new migration replacing `"Platform admins can insert audit logs"` with `WITH CHECK (public.is_platform_admin(auth.uid()))` (or route all audit writes strictly through `SECURITY DEFINER` RPCs and revoke direct `INSERT` from `anon`/`authenticated`).
  - **Verify:** `anon` `INSERT` into `public.admin_audit_logs` is rejected by RLS.

- [ ] **P1-2: Revoke `ALL` Grants from `anon` in Public Schema**
  - **File:** `supabase/migrations/20260101000011_grant_public_table_privileges.sql`
  - **Action:** Add a corrective migration that revokes `ALL` on tables, sequences, and routines in `public` from `anon` and `PUBLIC`, granting only explicit minimal `SELECT` / `EXECUTE` where unauthenticated access is genuinely required.
  - **Verify:** Inspect `information_schema.role_table_grants` and `role_routine_grants` for `grantee = 'anon'`.

- [ ] **P1-3: Add Auth Route Guard on Investor Routes (`App.tsx`)**
  - **Files:** `apps/web/src/App.tsx:115-126`, `apps/web/src/lib/supabase/auth-context.tsx`
  - **Action:** Wrap `<AppShell />` in a `<ProtectedRoute>` that redirects unauthenticated web users to `/login`, and restrict `enableOfflineUser()` strictly to explicit Tauri desktop/offline mode (never auto-bypassable on web production).
  - **Verify:** Navigating to `/` or `/portfolio` without a session in a web build redirects to `/login`.

- [ ] **P1-4: Enforce Strong Password Policy & Email Confirmations**
  - **Files:** `apps/web/src/pages/SignUpPage.tsx:62`, `supabase/config.toml`
  - **Action:** Increase client-side minimum password length (e.g., `>= 12` characters with complexity feedback) and enable `enable_confirmations = true` in `supabase/config.toml` and Supabase Cloud Auth settings.
  - **Verify:** Signup rejects weak passwords and requires email confirmation before issuing an active session.

- [ ] **P1-5: Add HTTP Security Headers & TLS / CSP Policies**
  - **Files:** `infra/docker/nginx-prod.conf`, `src-tauri/tauri.conf.json:26`, Cloudflare `_headers` (new)
  - **Action:**
    - Configure TLS termination (or reverse-proxy HTTPS + `Strict-Transport-Security`) and add `Content-Security-Policy`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy` to Nginx and Cloudflare Pages/Workers.
    - Replace `"csp": null` in `src-tauri/tauri.conf.json` with an explicit restrictive Tauri CSP.
  - **Verify:** `curl -I` against deployed web origin and Tauri build inspection confirm all security headers are enforced.

---

## P2 — Medium-Severity Hardening

- [ ] **P2-1: Add `SET search_path = public` to `handle_new_user()`**
  - **Files:** `supabase/migrations/20260101000001_core_schema.sql:143-155`, `20260101000013_profiles_insert_policy_and_inr_default.sql:13-25`
  - **Action:** Add a migration with `ALTER FUNCTION public.handle_new_user() SET search_path = public;`.

- [ ] **P2-2: Remove Silent Local Demo Fallback in `SupabaseSupportSessionAdapter`**
  - **File:** `apps/web/src/lib/supabase/support-session.adapter.ts:48-75`
  - **Action:** Propagate RPC errors in production instead of synthesizing a fake `activeDemoSessions` entry.

- [ ] **P2-3: Remove Hardcoded QA Supabase URL & Publishable Key Fallbacks**
  - **Files:** `apps/web/src/pages/LoginPage.tsx:43-48`, `.github/workflows/build-installers.yml`
  - **Action:** Require `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_ANON_KEY` from environment/CI secrets instead of hardcoding a live QA project URL in source.

- [ ] **P2-4: Add Automated Database RLS / pgTAP Regression Tests**
  - **Directory:** `supabase/tests/`
  - **Action:** Write pgTAP tests verifying cross-household isolation, `'viewer'` write denial, `admin_audit_logs` immutability, `anon` rejection, and `admin_*` RPC authorization.

- [ ] **P2-5: Move Admin User Provisioning to a Server-Side Edge Function**
  - **File:** `apps/web/src/lib/supabase/admin.adapter.ts:231-262`
  - **Action:** Replace browser-side `isolatedClient.auth.signUp()` with a Supabase Edge Function calling `supabaseAdmin.auth.admin.createUser()` after verifying `is_platform_admin(caller)`.

---

## P3 — Low-Severity & Manual Verification Tasks

- [ ] **P3-1:** Deduplicate `GoTrueClient` instances in `ConnectionManager` (`apps/web/src/lib/services/connection-manager.ts`).
- [ ] **P3-2:** Run `npm audit --omit=dev --json` in a networked environment and resolve any High/Critical advisories.
- [ ] **P3-3:** Verify `households` and `household_members` write RLS policies in live Supabase (`pg_policies`).
- [ ] **P3-4:** Verify Supabase Cloud Auth rate limiting, brute-force protection, and refresh token reuse detection settings in the Supabase Dashboard.

