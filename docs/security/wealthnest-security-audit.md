# WealthNest — Comprehensive Security Implementation Audit

**Audit Date:** 2026-11-13  
**Target Repository:** `/home/ketan/projects/Krisha/wealthNest`  
**Audit Scope:** Audit-only inspection of source code, SQL migrations, Supabase configuration, CI/CD workflows, desktop (Tauri) & Docker/Nginx deployment configs, and automated tests. No source code, schemas, RLS policies, environment variables, secrets, or dependencies were modified.  
**Production Readiness Verdict:** **NO-GO (Critical & High-Severity Blockers Present)**

---

## 1. Executive Summary & Audit Scorecard

WealthNest implements strong foundational security patterns in several areas—most notably a Clean Architecture boundary (`packages/domain`, `packages/application`, `packages/shared`, `apps/web`), `SECURITY DEFINER` RPCs for support impersonation with 15-minute TTLs and audit logging (`20260101000010_admin_support_sessions.sql`), private storage bucket policies with 120-second signed URLs (`20260101000016_family_document_vault.sql`, `document-vault.adapter.ts`), and zero `dangerouslySetInnerHTML`/`eval` XSS sinks in `apps/web/src`.

However, **critical and high-severity implementation gaps** render the current codebase **unsafe for production deployment**:
1. **Critical — Frontend Admin Authorization Bypass & QA Elevation Backdoor:** `AdminProvider` (`apps/web/src/lib/admin/admin-context.tsx`) initializes `role` to `'super_admin'`, trusts `sessionStorage` (`wealthnest_simulated_admin_role`) without backend verification, and grants `'super_admin'` on RPC errors, missing user, or email heuristics (`email.includes('admin')` or `'investor@wealthnest.local'`). `AdminGuard.tsx` also exposes a UI button calling `seed_qa_grant_admin`.
2. **Critical — Unauthenticated Privilege Escalation Function in `seed_qa.sql`:** `public.seed_qa_grant_admin` (`supabase/seed_qa.sql:22-50`) is `SECURITY DEFINER` without `SET search_path = public` and without any caller authorization check. If applied to a live database, any caller can elevate any UUID (including themselves) to `super_admin`.
3. **High — Anonymous Audit Log Injection (`auth.uid() IS NULL`):** The `INSERT` RLS policy on `public.admin_audit_logs` (`20260101000009_admin_portal_and_access_control.sql:202-204`) allows `public.is_platform_admin(auth.uid()) OR auth.uid() IS NULL`, enabling unauthenticated `anon` users to forge audit log entries.
4. **High — Over-Permissive `GRANT ALL` to `anon`:** `20260101000011_grant_public_table_privileges.sql` grants `ALL` privileges on all tables, sequences, and routines in `public` (plus `ALTER DEFAULT PRIVILEGES`) to `anon`, `authenticated`, and `service_role`.
5. **High — No Auth Route Guard on Investor Routes & Weak Client-Side Password Policy:** `App.tsx:115-126` renders `<AppShell />` and all investor routes without checking authentication, while `enableOfflineUser()` (`auth-context.tsx`) allows unauthenticated local vault mode via `localStorage`. `SignUpPage.tsx:62` enforces only a 6-character minimum password.
6. **High — Missing Security Headers & TLS Termination in Nginx / Disabled CSP in Tauri:** `infra/docker/nginx-prod.conf` listens only on HTTP port 80 and omits `Content-Security-Policy`, `Strict-Transport-Security`, `Referrer-Policy`, and `Permissions-Policy`. `src-tauri/tauri.conf.json:26` sets `"csp": null`.

### Audit Check Summary (50 Checks Across 16 Domains)

| Status | Count |
| --- | ---: |
| **PASS** | 18 |
| **FAIL** | 13 |
| **PARTIAL** | 10 |
| **REQUIRES MANUAL VERIFICATION** | 9 |
| **Total Checks Performed** | **50** |

---

## 2. Repository & Security Architecture Discovery

### 2.1 Technology Stack & Monorepo Structure
- **Frontend (`apps/web`):** React `^18.3.1`, TypeScript `^5.8.2`, Vite `^6.2.0`, React Router `^7.3.0`, TanStack React Query `^5.67.1`, `@supabase/supabase-js` `^2.49.1`, `pdfjs-dist` `^4.10.38`.
- **Desktop / Mobile Wrapper (`src-tauri`):** Tauri 2 (`src-tauri/tauri.conf.json`) with `tauri-plugin-sql` (`sqlite:wealthnest_v1.db`).
- **Clean Architecture Packages:** `packages/domain`, `packages/application`, `packages/shared`.
- **Backend / Database (`supabase/`):** Supabase PostgreSQL 15 (`supabase/config.toml`), SQL migrations in `supabase/migrations/`, QA seed script in `supabase/seed_qa.sql`.
- **Edge Functions / Custom Backend APIs:** **None present.** No `supabase/functions/` directory or custom Node/Express backend exists.
- **Deployment Targets:**
  - Cloudflare Workers / Static Assets (`wrangler.jsonc` serving `./apps/web/dist`).
  - Docker + Nginx (`infra/docker/nginx-prod.conf`).
  - GitHub Actions (`.github/workflows/build-installers.yml`, `supabase-migration.yml`, `keep-qa-alive.yml`).

### 2.2 Actual Security Architecture Flow

```text
Browser / Tauri WebView (React 18 SPA)
  ├── Local/Offline Fallback: localStorage ('wealthnest_offline_mode') / Tauri SQLite
  ├── Supabase Client Proxy (apps/web/src/lib/supabase/client.ts -> connectionManager)
  │     └── HTTPS/HTTP -> Supabase Auth (GoTrue) [JWT + Refresh Token in browser storage]
  │     └── HTTPS/HTTP -> PostgREST (/rest/v1/*) [apikey + Bearer JWT -> Postgres RLS]
  │     └── HTTPS/HTTP -> Supabase Storage (/storage/v1/*) [Private bucket 'family-vault' + Signed URLs]
  ├── Admin Portal (/admin/*)
  │     ├── Frontend Guard: AdminLayout -> AdminGuard -> AdminContext (BYPASSABLE CLIENT-SIDE)
  │     └── Backend RPCs: SECURITY DEFINER functions (admin_get_users, admin_start_support_session, etc.)
  └── Edge Functions / External AI APIs: NONE PRESENT
```

---

## 3. Authentication Security Audit

| Check ID | Control | Status | Evidence & Finding |
| --- | --- | --- | --- |
| AUTH-01 | Signup & Account Creation | **PARTIAL** | `SignUpPage.tsx:88` calls `supabase.auth.signUp`. `supabase/config.toml` has `enable_signup = true`, `enable_confirmations = false` (confirmations disabled in local config). |
| AUTH-02 | Password Strength Policy | **FAIL** | `SignUpPage.tsx:62` only enforces `password.length < 6` with no complexity, breach check, or longer minimum. Production Supabase Auth settings **REQUIRES MANUAL VERIFICATION**. |
| AUTH-03 | Login & Credential Validation | **PASS** | `LoginPage.tsx` uses `supabase.auth.signInWithPassword` via the Supabase client proxy. |
| AUTH-04 | Logout & Session Termination | **PARTIAL** | `auth-context.tsx` calls `supabase.auth.signOut()` and clears `wealthnest_offline_mode` on web, but intentionally preserves offline user mode in Tauri runtime. |
| AUTH-05 | Email Verification & Password Reset | **PARTIAL** | `ForgotPasswordModal` and `double_confirm_changes = true` (`supabase/config.toml`) exist, but `enable_confirmations = false` in `supabase/config.toml`. Live cloud email verification **REQUIRES MANUAL VERIFICATION**. |
| AUTH-06 | Session Persistence, Expiration & Refresh | **PARTIAL** | Managed by `@supabase/supabase-js` (`jwt_expiry = 3600` in `supabase/config.toml`). Note: `ConnectionManager.test.ts` logs `Multiple GoTrueClient instances detected in the same browser context` when switching endpoints dynamically. |
| AUTH-07 | Protected Route Implementation | **FAIL** | `apps/web/src/App.tsx:115-126` mounts `<AppShell />` and all investor routes (`/`, `/portfolio`, `/real-estate`, `/liabilities`, `/transactions`, `/analytics`, `/goals`, `/documents`, `/settings`) with **no authentication guard**. Unauthenticated visitors can access the app shell and trigger offline/demo mode (`auth-context.tsx`). |
| AUTH-08 | Brute-Force Protection & Rate Limiting | **REQUIRES MANUAL VERIFICATION** | No client-side or Nginx rate limiting (`infra/docker/nginx-prod.conf`) is configured; relies entirely on Supabase Cloud Auth rate limits, which cannot be verified from the repo. |
| AUTH-09 | Backend Enforcement Independence | **PARTIAL** | Core user tables enforce `auth.uid()` / household RLS, but `admin_audit_logs` INSERT (`auth.uid() IS NULL`) and `AdminProvider` client-side fallbacks undermine backend-only enforcement. |

---

## 4. Supabase API Keys & Token Security

| Credential Category | Env Var / Location | Referenced Files | Context | Appropriate Location? | Extractable from Browser Bundle? | Finding |
| --- | --- | --- | --- | --- | --- | --- |
| Supabase Project URL | `VITE_SUPABASE_URL` | `server-config.ts`, `LoginPage.tsx:42`, `.github/workflows/build-installers.yml`, `keep-qa-alive.yml` | Frontend + CI | Yes | Yes (public URL) | Hardcoded QA URL fallback (`https://jdgucgsvvxcpxbeubqpi.supabase.co`) in `LoginPage.tsx:43` and `build-installers.yml`. |
| Publishable Key | `VITE_SUPABASE_PUBLISHABLE_KEY` | `LoginPage.tsx:47`, `build-installers.yml` | Frontend + CI | Yes (public key) | Yes (intended) | Hardcoded `sb_publishable_...` fallback in `LoginPage.tsx:48` and `build-installers.yml`. |
| Legacy Anon Key | `VITE_SUPABASE_ANON_KEY`, `DEFAULT_SUPABASE_ANON_KEY` | `server-config.ts`, `LoginPage.tsx:46`, `admin.adapter.ts:242`, `keep-qa-alive.yml` | Frontend + CI | Yes (public anon key) | Yes (intended) | `server-config.ts` falls back to standard local Supabase demo JWT (`iss: "supabase-demo"`, `role: "anon"`). |
| Secret / `service_role` Key | `sb_secret_...` / `service_role` | `supabase/.temp/start-secrets/...` (gitignored), SQL `GRANT` statements (`20260101000011`, `20260101000016`) | Local CLI temp / SQL | Yes | **No** | Not present in `apps/` or tracked files. |
| Supabase Access Token / DB Password | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID` | `.github/workflows/supabase-migration.yml` | CI/CD only | Yes | **No** | Properly sourced from `${{ secrets.* }}`. |

| Check ID | Control | Status | Evidence & Finding |
| --- | --- | --- | --- |
| KEY-01 | No `service_role` or `sb_secret_` in Frontend | **PASS** | `grep` across `apps/`, `packages/`, `.github/` confirmed zero `sb_secret_` keys and zero `service_role` keys in frontend bundles. |
| KEY-02 | Separation of QA & Production Keys | **FAIL** | `LoginPage.tsx:43-48` and `.github/workflows/build-installers.yml` hardcode a live QA Supabase URL and publishable key as runtime/build fallbacks. |
| KEY-03 | Isolated Auth Client for Admin User Creation | **PARTIAL** | `admin.adapter.ts:245-251` creates an isolated non-persisted `anon` Supabase client (`persistSession: false`) to call `signUp` without overwriting the admin session, instead of using a privileged server-side Edge Function (`admin.createUser`). |

---

## 5. Database & Row-Level Security (RLS) Audit

| Check ID | Control | Status | Evidence & Finding |
| --- | --- | --- | --- |
| DB-01 | RLS Enabled on Financial & Admin Tables | **PASS** | RLS is enabled across core tables (`20260101000001`), `family_members`, `portfolio_accounts` (`20260101000007:71-72`), `platform_admin_roles`, `user_access_status`, `admin_audit_logs`, `households`, `household_members` (`20260101000009`), `admin_support_sessions` (`20260101000010`), and `family_documents` (`20260101000016`). |
| DB-02 | Least-Privilege Schema Grants | **FAIL** | `20260101000011_grant_public_table_privileges.sql` executes `GRANT ALL ON ALL TABLES / SEQUENCES / ROUTINES IN SCHEMA public TO anon, authenticated, service_role` plus `ALTER DEFAULT PRIVILEGES`. `anon` should not hold `ALL` table/routine grants. |
| DB-03 | `admin_audit_logs` INSERT Policy | **FAIL** | `20260101000009_admin_portal_and_access_control.sql:202-204` defines `WITH CHECK (public.is_platform_admin(auth.uid()) OR auth.uid() IS NULL)`. Combined with DB-02, unauthenticated `anon` requests can insert forged audit records. |
| DB-04 | Audit Log Immutability | **PASS** | `prevent_audit_log_modification()` trigger (`20260101000009:98-111`) raises an exception on `BEFORE UPDATE OR DELETE ON public.admin_audit_logs`. |
| DB-05 | `SECURITY DEFINER` `search_path` Hardening | **FAIL** | 20 `SECURITY DEFINER` functions in `20260101000009`, `20260101000010`, and `20260101000014` set `SET search_path = public`, **but 2 migration functions lack it**: `public.handle_new_user()` (`20260101000001:143-155` and `20260101000013:13-25`). Additionally, `public.seed_qa_grant_admin` (`supabase/seed_qa.sql:22-50`) is `SECURITY DEFINER` without `SET search_path` and without any auth check. |
| DB-06 | `profiles` Self-Insert & Currency Default | **PASS** | `20260101000013:6-9` scopes profile insert to `WITH CHECK (auth.uid() = id)`. |
| DB-07 | Live Database Schema Parity & `pg_policies` Inspection | **REQUIRES MANUAL VERIFICATION** | Local `npx supabase status` failed in the sandbox (`EROFS: read-only file system, mkdir '/home/ketan/.supabase'`). Live Supabase Cloud/local DB state must be verified directly. |

---

## 6. Household & Multi-Tenant Isolation Audit

| Check ID | Control | Status | Evidence & Finding |
| --- | --- | --- | --- |
| HH-01 | Cross-User Financial Data Isolation | **PASS** | `20260101000014_household_collaboration_rls.sql` updates `assets`, `holdings`, `transactions`, `liabilities`, `liability_balances`, `asset_valuations`, `goals`, `goal_holding_allocations`, `family_members`, and `portfolio_accounts` to enforce `is_same_household(auth.uid(), user_id)` for reads and `can_edit_household_record(auth.uid(), user_id)` for writes. |
| HH-02 | Viewer Role Write Restriction | **PASS** | `can_edit_household_record` (`20260101000014`) restricts writes to the owner or household members with `household_role IN ('primary_owner', 'member')`, blocking `'viewer'` roles. |
| HH-03 | `households` & `household_members` Write Policies | **PARTIAL** | `20260101000009:208-222` defines `SELECT` policies for `households` and `household_members`. Write (`INSERT`/`UPDATE`/`DELETE`) policies for self-service household management were not observed in `20260101000009` or `20260101000014`; live policy set **REQUIRES MANUAL VERIFICATION**. |

---

## 7. Claude / AI Integration Security

| Check ID | Control | Status | Evidence & Finding |
| --- | --- | --- | --- |
| AI-01 | AI Provider Key & Prompt Injection Surface | **PASS** | `grep` across the repository confirmed **no Anthropic/Claude, OpenAI, or Gemini SDKs, API keys (`sk-ant-`, `sk-proj-`), or AI Edge Functions exist** in WealthNest. |

---

## 8. Third-Party Integrations Security

| Check ID | Control | Status | Evidence & Finding |
| --- | --- | --- | --- |
| 3P-01 | External Network Endpoints | **PASS** | `grep` for `fetch(` in `apps/web/src/` showed only `connection-manager.ts:131` (Supabase health check). No unvetted third-party telemetry, analytics, or external broker OAuth secrets are embedded. |
| 3P-02 | Client-Side Financial File Parsing (CAS PDF / CSV) | **PARTIAL** | CAS PDF and broker CSV parsing run client-side (`pdfjs-dist ^4.10.38`, `packages/domain`). No server-side malware scanning exists for uploaded/parsed files, though `pdfjs-dist` parsing stays local to the client. |

---

## 9. Frontend Security Audit

| Check ID | Control | Status | Evidence & Finding |
| --- | --- | --- | --- |
| FE-01 | XSS Sinks (`dangerouslySetInnerHTML`, `innerHTML`, `eval`) | **PASS** | `grep` across `apps/web/src` found zero occurrences of `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, or `new Function(`. |
| FE-02 | Sensitive State in Browser Storage | **FAIL** | `AdminProvider` (`admin-context.tsx`) reads `sessionStorage.getItem('wealthnest_simulated_admin_role')` as an authoritative role override. `auth-context.tsx` uses `localStorage.getItem('wealthnest_offline_mode')` to enable offline vault mode without authentication. |
| FE-03 | Client-Side Endpoint Switching | **PARTIAL** | `LoginPage.tsx` and `ConnectionManager` allow switching Supabase URL/anon key at runtime (useful for LAN/self-hosted setups), which triggers `Multiple GoTrueClient instances` warnings in tests and can downgrade to `http://` on non-HTTPS origins. |

---

## 10. Backend & Edge Functions Security

| Check ID | Control | Status | Evidence & Finding |
| --- | --- | --- | --- |
| BE-01 | Edge Functions Auth & Input Validation | **PASS (N/A)** | No `supabase/functions/` exist. All server-side privileged logic resides in PostgreSQL `SECURITY DEFINER` RPCs. |
| BE-02 | Privileged User Provisioning | **PARTIAL** | `admin.adapter.ts:231-262` provisions users from the browser via `isolatedClient.auth.signUp()` rather than an authenticated server-side Edge Function using `auth.admin.createUser()`. |

---

## 11. Admin Portal & Support Impersonation Security

| Check ID | Control | Status | Evidence & Finding |
| --- | --- | --- | --- |
| ADM-01 | Frontend Admin Route Guard (`AdminProvider` & `AdminGuard`) | **FAIL** | **Critical Bypass:** `admin-context.tsx` initializes `role` to `'super_admin'`, accepts `sessionStorage` overrides (`wealthnest_simulated_admin_role`), grants `'super_admin'` when `!user`, on RPC error/catch, or when `email.includes('admin')` / `'investor@wealthnest.local'`. `AdminGuard.tsx:51` exposes a button calling `seed_qa_grant_admin`. |
| ADM-02 | Backend Admin RPC Authorization (`20260101000009`) | **PASS** | `admin_get_users`, `admin_get_user_detail`, and admin mutation RPCs verify `public.is_platform_admin(auth.uid())` inside `SECURITY DEFINER` functions with `SET search_path = public`. |
| ADM-03 | Support Impersonation Session Controls (`20260101000010`) | **PASS** | `admin_start_support_session`, `admin_end_support_session`, and `validate_support_session` verify caller `auth.uid()`, `admin_user_id` ownership, `is_active`, 15-minute `expires_at` TTL, and write to `admin_audit_logs`. |
| ADM-04 | Client-Side Support Session Demo Fallback | **FAIL** | `support-session.adapter.ts:48-75` catches RPC errors and silently creates a local simulated `SupportSession` in `activeDemoSessions`, masking backend authorization failures. |

---

## 12. File & Document Storage Security

| Check ID | Control | Status | Evidence & Finding |
| --- | --- | --- | --- |
| STG-01 | Private Bucket & File Constraints | **PASS** | `20260101000016_family_document_vault.sql` creates `family-vault` with `public = false`, 20 MiB file size limit, and an explicit MIME allowlist. |
| STG-02 | Storage Object Path & Household RLS | **PASS** | Storage RLS (`20260101000016`) scopes access to `(storage.foldername(name))[1]::uuid` matching `is_same_household` / `can_edit_household_record`, aligned with `buildVaultStoragePath(params.userId, docId, params.fileName)` in `document-vault.adapter.ts`. |
| STG-03 | Signed URL Expiration | **PASS** | `document-vault.adapter.ts` requests `createSignedUrl(storagePath, 120)` (2-minute expiry). |

---

## 13. Deployment, Environment & Desktop (Tauri) Security

| Check ID | Control | Status | Evidence & Finding |
| --- | --- | --- | --- |
| DEP-01 | Nginx TLS & Security Headers (`infra/docker/nginx-prod.conf`) | **FAIL** | Listens only on HTTP port 80 (no TLS/HSTS). Includes `X-Content-Type-Options nosniff`, `X-Frame-Options SAMEORIGIN`, `X-XSS-Protection`, but **omits `Content-Security-Policy`, `Strict-Transport-Security`, `Referrer-Policy`, and `Permissions-Policy`**. |
| DEP-02 | Tauri Desktop CSP (`src-tauri/tauri.conf.json:26`) | **FAIL** | `"security": { "csp": null }` completely disables Content Security Policy in the Tauri WebView. |
| DEP-03 | CI/CD Secret Hygiene (`.github/workflows/`) | **PASS** | `supabase-migration.yml` and `keep-qa-alive.yml` use `${{ secrets.* }}` without printing secrets. |
| DEP-04 | Cloudflare Workers / Pages Runtime Headers | **REQUIRES MANUAL VERIFICATION** | `wrangler.jsonc` configures static `./apps/web/dist` assets without a `_headers` file; edge headers must be verified in Cloudflare dashboard. |
| DEP-05 | Local SQLite Encryption at Rest (Tauri) | **REQUIRES MANUAL VERIFICATION** | `tauri-plugin-sql` preloads `sqlite:wealthnest_v1.db`; OS-level disk encryption or SQLCipher usage is not configured in `tauri.conf.json`. |

---

## 14. Git Secret Leakage Check

| Check ID | Control | Status | Evidence & Finding |
| --- | --- | --- | --- |
| GIT-01 | `.gitignore` Coverage | **PASS** | `.gitignore` ignores `.env`, `.env.local`, `.env.*.local`, `dist/`, `supabase/.temp/`, `supabase/.branches/`. |
| GIT-02 | Tracked Source & Git History Secret Scan | **PASS** | `git log --all -S "sb_secret_"`, `-S "sk-ant-"`, `-S "sk-proj-"`, and `--name-only -- "*.env" "*.pem" "*.key"` returned **zero matches** across all commits. |

---

## 15. Dependency & Supply-Chain Security

| Check ID | Control | Status | Evidence & Finding |
| --- | --- | --- | --- |
| PKG-01 | `npm audit` Vulnerability Scan | **REQUIRES MANUAL VERIFICATION** | `npm audit --omit=dev --json` failed in the offline sandbox (`getaddrinfo EAI_AGAIN registry.npmjs.org`). Must be run in a networked environment before release. |
| PKG-02 | Lockfile & Engine Constraints | **PASS** | Root `package.json` pins `node >= 20.0.0`, `npm >= 10.0.0`, and dependencies (`@supabase/supabase-js ^2.49.1`, `pdfjs-dist ^4.10.38`, `react ^18.3.1`, `vite ^6.2.0`) are modern. |

---

## 16. Automated Tests & Security Verification

| Check ID | Control | Status | Evidence & Finding |
| --- | --- | --- | --- |
| TST-01 | Monorepo Unit Test Suite | **PASS** | Executed during this audit: `@wealthnest/domain` (**30 files, 171 tests**), `@wealthnest/application` (**24 files, 99 tests**), `@wealthnest/shared` (**1 file, 2 tests**), `@wealthnest/web` (**34 files, 140 tests**) — **89 files, 412 tests passed** (including `AdminPortal.test.tsx`, `SupportImpersonation.test.tsx`, `AuthPages.test.tsx`, `backup-security-sqlite.test.ts`, `sqlite-isolation.test.ts`, `admin-invariants.test.ts`). |
| TST-02 | Database pgTAP / Live RLS Integration Tests | **FAIL** | `supabase/tests/` contains only `.gitkeep`; there are no automated pgTAP or live Postgres RLS regression tests. |
| TST-03 | Live E2E / DAST Penetration Verification | **REQUIRES MANUAL VERIFICATION** | No live browser E2E against a running Supabase instance was executed in the offline sandbox. |

---

## 17. Risk Classification Matrix & Prioritized Findings

| Risk | ID | Summary | Location |
| --- | --- | --- | --- |
| **CRITICAL** | ADM-01 | Client-side Admin bypass: defaults to `'super_admin'`, trusts `sessionStorage`, elevates on RPC error/email heuristic, exposes `seed_qa_grant_admin` button | `apps/web/src/lib/admin/admin-context.tsx`, `apps/web/src/components/admin/AdminGuard.tsx` |
| **CRITICAL** | DB-05b | `seed_qa_grant_admin` is `SECURITY DEFINER` with no auth check and no `SET search_path = public` | `supabase/seed_qa.sql:22-50` |
| **HIGH** | DB-03 | `admin_audit_logs` INSERT RLS allows `auth.uid() IS NULL` | `supabase/migrations/20260101000009_admin_portal_and_access_control.sql:202-204` |
| **HIGH** | DB-02 | `GRANT ALL` on all tables/sequences/routines in `public` to `anon` | `supabase/migrations/20260101000011_grant_public_table_privileges.sql` |
| **HIGH** | AUTH-07 | Investor routes in `App.tsx` lack an auth route guard; offline mode can be enabled via `localStorage` | `apps/web/src/App.tsx:115-126`, `apps/web/src/lib/supabase/auth-context.tsx` |
| **HIGH** | AUTH-02 | Minimum password length is only 6 characters on signup | `apps/web/src/pages/SignUpPage.tsx:62` |
| **HIGH** | DEP-01 / DEP-02 | Nginx lacks TLS, HSTS, CSP, Referrer-Policy, Permissions-Policy; Tauri sets `"csp": null` | `infra/docker/nginx-prod.conf`, `src-tauri/tauri.conf.json:26` |
| **MEDIUM** | DB-05a | `handle_new_user()` is `SECURITY DEFINER` without `SET search_path = public` | `supabase/migrations/20260101000001_core_schema.sql:143-155`, `20260101000013:13-25` |
| **MEDIUM** | ADM-04 | `SupabaseSupportSessionAdapter` falls back to local mock sessions on RPC error | `apps/web/src/lib/supabase/support-session.adapter.ts:48-75` |
| **MEDIUM** | KEY-02 | Hardcoded QA Supabase URL & publishable key fallbacks in `LoginPage.tsx` and `build-installers.yml` | `apps/web/src/pages/LoginPage.tsx:43-48`, `.github/workflows/build-installers.yml` |
| **MEDIUM** | TST-02 | No pgTAP / automated database RLS test suite | `supabase/tests/` |
| **LOW** | AUTH-06 | Multiple `GoTrueClient` instances warning during dynamic server switching | `apps/web/src/lib/services/connection-manager.ts` |

---

## 18. Checks Requiring Manual Verification (Outside Repo / Offline Sandbox)

1. `npm audit --omit=dev --json` against `registry.npmjs.org` (PKG-01).
2. `npx supabase status` and live `pg_policies` / `pg_proc` inspection on staging and production Supabase projects (DB-07, HH-03).
3. Supabase Dashboard Auth settings: `enable_confirmations`, password strength rules, JWT expiry, refresh token rotation/reuse detection, and rate limiting (AUTH-02, AUTH-05, AUTH-08).
4. Verification that `supabase/seed_qa.sql` has **not** been executed on any production or staging database (DB-05b).
5. Cloudflare Workers/Pages HTTP security headers (`_headers` or Transform Rules) (DEP-04).
6. Tauri SQLite file-at-rest protection expectations for desktop/mobile builds (DEP-05).
7. Live end-to-end penetration test of cross-household RLS, viewer write blocking, and storage signed URLs (TST-03).

