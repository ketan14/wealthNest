# WealthNest — Security Remediation Checklist

**Derived From:** [wealthnest-security-audit.md](file:///home/ketan/projects/Krisha/wealthNest/docs/security/wealthnest-security-audit.md)  
**Target:** `/home/ketan/projects/Krisha/wealthNest`  
**Status:** Repo Fixes Implemented — Pending `supabase db push`, `supabase test db`, & Live Cloud Checks

---

## P0 — Critical Blockers (Must Fix Before Any Staging/Production Exposure)

- [x] **P0-1: Remove Frontend Admin Authorization Bypass & Simulation Backdoors** *(Verified in repo)*
  - **Files:** `apps/web/src/lib/admin/admin-context.tsx`, `apps/web/src/components/admin/AdminGuard.tsx`
  - **Action:**
    - Initialize `role` to `null` (never `'super_admin'`).
    - Remove `sessionStorage` (`wealthnest_simulated_admin_role`) trust in production builds.
    - Remove email heuristics (`email.includes('admin')`, `'investor@wealthnest.local'`), `!user`, and `catch` fallbacks that grant `'super_admin'`.
    - Remove the `seed_qa_grant_admin` self-elevation button from `AdminGuard.tsx`.
  - **Verify:** Verified via `AdminPortal.test.tsx`.

- [x] **P0-2: Remove / Lock Down `seed_qa_grant_admin` in `supabase/seed_qa.sql`** *(Migration `000017` created; apply via `supabase db push`)*
  - **File:** `supabase/seed_qa.sql:22-50`, `supabase/migrations/20260101000017_security_hardening_rls_and_grants.sql`
  - **Action:**
    - Verify via Supabase SQL Editor that `public.seed_qa_grant_admin` does **not** exist in production (`DROP FUNCTION IF EXISTS public.seed_qa_grant_admin(uuid, text);`).
    - Restrict `seed_qa.sql` functions to `SET search_path = public` and revoke `EXECUTE` from `anon` and `authenticated` (`REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated;`).
  - **Verify:** Covered in `supabase/tests/02_admin_rbac_and_audit_immutability.sql`.

- [x] **P0-3: Fix SQL `NULL !=` / `NULL NOT IN` Privilege Escalation Bypasses in Admin RPCs** *(Migration `000018` created; apply via `supabase db push`)*
  - **Files:** `supabase/migrations/20260101000009_admin_portal_and_access_control.sql:401,474`, `20260101000010_admin_support_sessions.sql:129`, `20260101000018_fix_admin_rpc_null_role_checks.sql`
  - **Action:** Explicitly check `v_caller_id IS NULL OR v_caller_role IS NULL OR ...` / `IS DISTINCT FROM 'super_admin'` in `admin_set_user_status`, `admin_manage_role`, and `admin_start_support_session`.
  - **Verify:** Covered in `supabase/tests/02_admin_rbac_and_audit_immutability.sql`.

---

## P1 — High-Severity Security Fixes (Required Before Production Launch)

- [x] **P1-1: Remove `auth.uid() IS NULL` from `admin_audit_logs` INSERT Policy** *(Migration `000017` created; apply via `supabase db push`)*
  - **File:** `supabase/migrations/20260101000017_security_hardening_rls_and_grants.sql`
  - **Verify:** Covered in `supabase/tests/01_rls_and_household_isolation.sql`.

- [x] **P1-2: Revoke `ALL` Grants from `anon` in Public Schema** *(Migration `000017` created; apply via `supabase db push`)*
  - **File:** `supabase/migrations/20260101000017_security_hardening_rls_and_grants.sql` (retains minimal `SELECT` on `public.asset_classes` for `keep-qa-alive.yml`)
  - **Verify:** Covered in `supabase/tests/01_rls_and_household_isolation.sql`.

- [x] **P1-3: Add Auth Route Guard on Investor Routes (`App.tsx`)** *(Verified in repo)*
  - **Files:** `apps/web/src/App.tsx`, `apps/web/src/lib/supabase/auth-context.tsx`
  - **Verify:** Verified via `App.test.tsx`.

- [~] **P1-4: Enforce Strong Password Policy & Email Confirmations** *(Repo updated; Supabase Cloud Dashboard check pending)*
  - **Files:** `apps/web/src/pages/SignUpPage.tsx:62`, `supabase/config.toml:37`
  - **Verify:** Client-side 12-char min verified via `AuthPages.test.tsx`. Still verify Supabase Cloud Auth settings.

- [~] **P1-5: Add HTTP Security Headers & TLS / CSP Policies** *(Nginx headers & Tauri CSP added; Cloudflare edge headers pending)*
  - **Files:** `infra/docker/nginx-prod.conf`, `src-tauri/tauri.conf.json:26`
  - **Action:** Verify upstream TLS termination + Cloudflare Pages/Workers `_headers`.

---

## P2 — Medium-Severity Hardening

- [x] **P2-1: Add `SET search_path = public` to `handle_new_user()`** *(Migration `000017` created; covered in `supabase/tests/01_*`)*
  - **File:** `supabase/migrations/20260101000017_security_hardening_rls_and_grants.sql`

- [x] **P2-2: Remove Silent Local Demo Fallback in `SupabaseSupportSessionAdapter`** *(Verified in repo)*
  - **File:** `apps/web/src/lib/supabase/support-session.adapter.ts:49-57`

- [x] **P2-3: Remove Hardcoded QA Supabase URL & Publishable Key Fallbacks** *(Verified in repo)*
  - **Files:** `apps/web/src/pages/LoginPage.tsx:40-53`, `apps/web/src/lib/config/server-config.ts`, `.github/workflows/build-installers.yml`

- [~] **P2-4: Add Automated Database RLS / pgTAP Regression Tests** *(Test files created; live execution via `supabase test db` pending Docker/Postgres)*
  - **Files:** `supabase/tests/01_rls_and_household_isolation.sql`, `supabase/tests/02_admin_rbac_and_audit_immutability.sql`
  - **Action:** Run `supabase start && supabase test db` locally/in CI to verify all 31 assertions pass against live Postgres.

- [ ] **P2-5: Move Admin User Provisioning to a Server-Side Edge Function**
  - **File:** `apps/web/src/lib/supabase/admin.adapter.ts:231-262`
  - **Action:** Replace browser-side `isolatedClient.auth.signUp()` with a Supabase Edge Function calling `supabaseAdmin.auth.admin.createUser()` after verifying `is_platform_admin(caller)`.

---

## P3 — Low-Severity & Manual Verification Tasks

- [ ] **P3-1:** Deduplicate `GoTrueClient` instances in `ConnectionManager` (`apps/web/src/lib/services/connection-manager.ts`).
- [ ] **P3-2:** Run `npm audit --omit=dev --json` in a networked environment and resolve any High/Critical advisories.
- [ ] **P3-3:** Verify `households` and `household_members` write RLS policies in live Supabase (`pg_policies`).
- [ ] **P3-4:** Verify Supabase Cloud Auth rate limiting, brute-force protection, and refresh token reuse detection settings in the Supabase Dashboard.

