# WealthNest — Security Remediation Checklist

**Derived From:** [wealthnest-security-audit.md](file:///home/ketan/projects/Krisha/wealthNest/docs/security/wealthnest-security-audit.md)  
**Target:** `/home/ketan/projects/Krisha/wealthNest`  
**Status:** Repo Fixes, CI Verification (`security-checks.yml` #17), QA DB Migrations (`000000`–`000024` on `jdgucgsvvxcpxbeubqpi`), QA Keep-Alive Ping (`keep-qa-alive.yml` #14), & QA Multi-Household Seed Verified — Remaining: Live `pg_policies` Inspection (`DB-07`) & Production Deployment

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

- [~] **P1-4: Enforce Strong Password Policy, Recovery Landing & Email Confirmations** *(Repo complexity + CSPRNG generator + `/reset-password` `PASSWORD_RECOVERY` + `ProfileSecurityTab` password update + `config.toml` enforced; Supabase Cloud Dashboard HIBP/SMTP check pending)*
  - **Files:** `apps/web/src/lib/validation/password.ts`, `apps/web/src/components/auth/UpdatePasswordForm.tsx`, `apps/web/src/pages/SignUpPage.tsx`, `apps/web/src/pages/ResetPasswordPage.tsx`, `apps/web/src/components/settings/ProfileSecurityTab.tsx`, `apps/web/src/components/admin/AdminUserProvisionModal.tsx`, `supabase/functions/admin-create-user/index.ts`, `supabase/config.toml`
  - **Verify:** Verified via `AuthPages.test.tsx`, `ProfileSecurityTab.test.tsx`, `AdminPortal.test.tsx`, and `SecurityHardening.test.ts`. Still verify Supabase Cloud Auth breached-password / HIBP and SMTP delivery settings.

- [~] **P1-5: Add HTTP Security Headers & TLS / CSP Policies** *(Cloudflare `_headers`, Nginx header-inheritance fix + `limit_req`, `nginx-prod-tls.conf` TLS 1.2/1.3 template, custom-domain `connect-src` guidance, and Tauri CSP verified; upstream TLS termination check pending)*
  - **Files:** `apps/web/public/_headers`, `infra/docker/nginx-prod.conf`, `infra/docker/nginx-prod-tls.conf`, `src-tauri/tauri.conf.json:26`
  - **Verify:** `apps/web/dist/_headers` confirmed generated during `npm run build`. Verify upstream TLS termination in front of Docker/Nginx (or mount `nginx-prod-tls.conf`).

---

## P2 — Medium-Severity Hardening

- [x] **P2-1: Add `SET search_path = public` to `handle_new_user()`** *(Migration `000017` created; covered in `supabase/tests/01_*`)*
  - **File:** `supabase/migrations/20260101000017_security_hardening_rls_and_grants.sql`

- [x] **P2-2: Remove Silent Local Demo Fallback in `SupabaseSupportSessionAdapter`** *(Verified in repo)*
  - **File:** `apps/web/src/lib/supabase/support-session.adapter.ts:49-57`

- [x] **P2-3: Remove Hardcoded QA Supabase URL & Publishable Key Fallbacks** *(Verified in repo)*
  - **Files:** `apps/web/src/pages/LoginPage.tsx:40-53`, `apps/web/src/lib/config/server-config.ts`, `.github/workflows/build-installers.yml`

- [x] **P2-4: Add Automated Database RLS / pgTAP Regression Tests** *(Verified in CI: `security-checks.yml` #17 on `3d15dc1` & local Postgres — 72 assertions across 3 suites)*
  - **Files:** `supabase/tests/01_rls_and_household_isolation.sql`, `supabase/tests/02_admin_rbac_and_audit_immutability.sql`, `supabase/tests/03_household_ownership_privacy_and_invitations.sql`, `.github/workflows/security-checks.yml`
  - **Verify:** `Supabase pgTAP RLS & RBAC Tests (TST-02)` passed in GitHub Actions Run #17 (`3d15dc1`, `1m 26s`).

- [x] **P2-5: Move Admin User Provisioning to a Server-Side Edge Function** *(Verified in repo; automated via `supabase-migration.yml`)*
  - **Files:** `supabase/functions/admin-create-user/index.ts`, `apps/web/src/lib/supabase/admin.adapter.ts`, `.github/workflows/supabase-migration.yml`
  - **Verify:** `AdminPortal.test.tsx` verifies `adminAdapter.createUserDirectly` invokes `supabase.functions.invoke('admin-create-user', ...)`. `supabase-migration.yml` guards missing `SUPABASE_*` secrets (`push` skip vs `workflow_dispatch` fail) and syncs optional `ALLOWED_ORIGINS` before `supabase functions deploy admin-create-user`.

- [~] **P2-6: Enforce Client-Side Financial File Parsing Bounds, Vault Header Verification & Safe PDF Extraction** *(Verified in repo; external Storage AV scanning not present)*
  - **Files:** `apps/web/src/lib/validation/import-file.ts`, `apps/web/src/lib/pdf/pdfjs-extractor.adapter.ts`, `apps/web/src/components/portfolio/ImportCasModal.tsx`, `apps/web/src/components/analytics/CasReconciliationCard.tsx`, `apps/web/src/components/vault/UploadDocumentModal.tsx`, `apps/web/src/lib/supabase/document-vault.adapter.ts`
  - **Verify:** `SecurityHardening.test.ts` verifies 20 MiB PDF / 5 MiB CSV caps, 100-page & 25k-row caps, `validateVaultFileBlobSignature` magic-header/extension checks, and `isEvalSupported: false`.

---

## P3 — Low-Severity & Manual Verification Tasks

- [x] **P3-1:** Cache & deduplicate `GoTrueClient` instances with host+key-scoped `storageKey`s and block `https:` -> `http://` downgrades in `ConnectionManager` (`apps/web/src/lib/services/connection-manager.ts`, `supabase/config.toml` refresh rotation; verified by `ConnectionManager.test.ts`).
- [x] **P3-2:** Run `npm audit --omit=dev --audit-level=high` in a networked environment (verified passing in CI `.github/workflows/security-checks.yml` Run #17 on `3d15dc1` — `Type-Check, Unit Tests & Dependency Audit`, `1m 43s`).
- [~] **P3-3:** Migrations (`000019`–`000024`) confirmed applied on linked QA (`jdgucgsvvxcpxbeubqpi`: `npx supabase db push` -> `Remote database is up to date`); verify `households`, `household_members`, and financial write RLS policies in live `pg_policies` (`DB-07`) + apply to production when provisioned.
- [~] **P3-4:** Nginx edge rate limiting (`limit_req_zone`), `[auth.rate_limit]`, and `admin-create-user` Postgres-backed sliding-window throttling (`10/min`, `30/15m`, HTTP `429`) added in `infra/docker/nginx-prod.conf`, `supabase/config.toml`, and `supabase/functions/admin-create-user/index.ts`; verify live Supabase Cloud Dashboard Auth rate limiting and breached-password settings.

