# WealthNest — Comprehensive Security Implementation Audit

**Audit Date:** 2026-11-13 (Updated after Quick Fixes #1–#8 Verification)  
**Target Repository:** `/home/ketan/projects/Krisha/wealthNest`  
**Audit Scope:** Security implementation audit and post-remediation verification of source code, SQL migrations, Supabase configuration, CI/CD workflows, desktop (Tauri) & Docker/Nginx deployment configs, and automated tests.  
**Production Readiness Verdict:** **CONDITIONAL NO-GO (Code/Migration Fixes #1–#8 Verified; Pending Live `supabase db push` & Manual Cloud/Supply-Chain Verification)**

---

## 1. Executive Summary & Audit Scorecard

WealthNest implements strong foundational security patterns in several areas—most notably a Clean Architecture boundary (`packages/domain`, `packages/application`, `packages/shared`, `apps/web`), `SECURITY DEFINER` RPCs for support impersonation with 15-minute TTLs and audit logging (`20260101000010_admin_support_sessions.sql`), private storage bucket policies with 120-second signed URLs (`20260101000016_family_document_vault.sql`, `document-vault.adapter.ts`), and zero `dangerouslySetInnerHTML`/`eval` XSS sinks in `apps/web/src`.

Following remediation of **Quick Fixes #1–#8**, all **Critical** and **High** repository-level blockers have been resolved and verified:
1. **Resolved — Frontend Admin Authorization & Self-Elevation (`ADM-01`, `FE-02`):** `AdminProvider` (`admin-context.tsx`) now initializes `role` to `null`, ignores `sessionStorage` overrides, removes all `'super_admin'` fallbacks, and resolves roles strictly via `supabase.rpc('get_platform_admin_role')`. `AdminGuard.tsx` no longer exposes `seed_qa_grant_admin` or simulation buttons.
2. **Resolved — QA Privilege Escalation Function (`DB-05`):** `seed_qa.sql` hardens `seed_qa_grant_admin` (`SET search_path = public`, blocks `anon`/`authenticated`/`auth.uid() IS NOT NULL`, revokes `EXECUTE`), and migration `20260101000017_security_hardening_rls_and_grants.sql` drops it from live databases.
3. **Resolved — Anonymous Audit Log Injection & `anon` Grants (`DB-02`, `DB-03`, `DB-05`):** Migration `20260101000017` removes `OR auth.uid() IS NULL` from `admin_audit_logs` INSERT RLS, sets `SET search_path = public` on `handle_new_user()`, and revokes `ALL` privileges on `public` tables/sequences/routines from `anon`.
4. **Resolved — Investor Route Guard, Offline Mode Restriction, & Password Minimum (`AUTH-07`, `AUTH-02`):** `App.tsx` wraps `<AppShell />` in `<ProtectedRoute>`, `auth-context.tsx` restricts offline local vault mode to Tauri/test runtimes, `SignUpPage.tsx` enforces a 12-character minimum password, and `supabase/config.toml` sets `enable_confirmations = true`.
5. **Resolved — Hardcoded QA Fallbacks & Silent Support Fallback (`KEY-02`, `ADM-04`):** Removed hardcoded QA Supabase URL/key fallbacks from `LoginPage.tsx`, `server-config.ts`, and `build-installers.yml`; `support-session.adapter.ts` propagates RPC errors in non-offline/non-test runtimes.
6. **Resolved / Hardened — Security Headers & Tauri CSP (`DEP-01`, `DEP-02`):** `nginx-prod.conf` adds `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`, and `Strict-Transport-Security`; `src-tauri/tauri.conf.json` sets an explicit CSP.

### Audit Check Summary (49 Checks Across 16 Domains)

| Status | Count |
| --- | ---: |
| **PASS** | 31 |
| **PARTIAL** | 11 |
| **FAIL** | 1 |
| **REQUIRES MANUAL VERIFICATION** | 6 |
| **Total Checks Performed** | **49** |

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
| AUTH-01 | Signup & Account Creation | **PARTIAL** | `SignUpPage.tsx:88` calls `supabase.auth.signUp`. `supabase/config.toml` now sets `enable_signup = true`, `enable_confirmations = true`. Live Cloud Auth settings require manual verification. |
| AUTH-02 | Password Strength Policy | **PARTIAL** | `SignUpPage.tsx:62` now enforces a 12-character minimum password. Complexity/breach checks and Production Supabase Auth settings **REQUIRES MANUAL VERIFICATION**. |
| AUTH-03 | Login & Credential Validation | **PASS** | `LoginPage.tsx` uses `supabase.auth.signInWithPassword` via the Supabase client proxy. |
| AUTH-04 | Logout & Session Termination | **PARTIAL** | `auth-context.tsx` calls `supabase.auth.signOut()` and clears `wealthnest_offline_mode` on web, while preserving offline user mode only in Tauri runtime. |
| AUTH-05 | Email Verification & Password Reset | **PARTIAL** | `ForgotPasswordModal`, `double_confirm_changes = true`, and `enable_confirmations = true` (`supabase/config.toml`) are configured. Live cloud email verification **REQUIRES MANUAL VERIFICATION**. |
| AUTH-06 | Session Persistence, Expiration & Refresh | **PARTIAL** | Managed by `@supabase/supabase-js` (`jwt_expiry = 3600` in `supabase/config.toml`). Note: `ConnectionManager.test.ts` logs `Multiple GoTrueClient instances detected in the same browser context` when switching endpoints dynamically. |
| AUTH-07 | Protected Route Implementation | **PASS** | `apps/web/src/App.tsx` wraps `<AppShell />` in `<ProtectedRoute>`, redirecting unauthenticated web users to `/login`. `auth-context.tsx` restricts offline local vault mode to Tauri/test runtimes. Verified by `App.test.tsx`. |
| AUTH-08 | Brute-Force Protection & Rate Limiting | **REQUIRES MANUAL VERIFICATION** | No client-side or Nginx rate limiting (`infra/docker/nginx-prod.conf`) is configured; relies entirely on Supabase Cloud Auth rate limits, which cannot be verified from the repo. |
| AUTH-09 | Backend Enforcement Independence | **PASS** | Core user tables enforce `auth.uid()` / household RLS; `20260101000017` removes `auth.uid() IS NULL` from `admin_audit_logs` INSERT, and `AdminProvider` no longer has client-side fallbacks. |

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
| KEY-02 | Separation of QA & Production Keys | **PASS** | Hardcoded QA Supabase URL and `sb_publishable_...` fallbacks were removed from `LoginPage.tsx`, `server-config.ts`, and `.github/workflows/build-installers.yml`; verified via `grep`. |
| KEY-03 | Isolated Auth Client for Admin User Creation | **PARTIAL** | `admin.adapter.ts:245-251` creates an isolated non-persisted `anon` Supabase client (`persistSession: false`) to call `signUp` without overwriting the admin session, instead of using a privileged server-side Edge Function (`admin.createUser`). |

---

## 5. Database & Row-Level Security (RLS) Audit

| Check ID | Control | Status | Evidence & Finding |
| --- | --- | --- | --- |
| DB-01 | RLS Enabled on Financial & Admin Tables | **PASS** | RLS is enabled across core tables (`20260101000001`), `family_members`, `portfolio_accounts` (`20260101000007:71-72`), `platform_admin_roles`, `user_access_status`, `admin_audit_logs`, `households`, `household_members` (`20260101000009`), `admin_support_sessions` (`20260101000010`), and `family_documents` (`20260101000016`). |
| DB-02 | Least-Privilege Schema Grants | **PASS** | Migration `20260101000017_security_hardening_rls_and_grants.sql` revokes `ALL` on all tables, sequences, and routines in `public` from `anon` (and updates default privileges). Apply via `supabase db push` (live state tracked in `DB-07`). |
| DB-03 | `admin_audit_logs` INSERT Policy | **PASS** | Migration `20260101000017` replaces `"Platform admins can insert audit logs"` to enforce `WITH CHECK (public.is_platform_admin(auth.uid()))`, removing `OR auth.uid() IS NULL`. |
| DB-04 | Audit Log Immutability | **PASS** | `prevent_audit_log_modification()` trigger (`20260101000009:98-111`) raises an exception on `BEFORE UPDATE OR DELETE ON public.admin_audit_logs`. |
| DB-05 | `SECURITY DEFINER` `search_path` Hardening | **PASS** | Migration `20260101000017` sets `ALTER FUNCTION public.handle_new_user() SET search_path = public;` and drops `seed_qa_grant_admin`. `seed_qa.sql` also hardens `seed_qa_grant_admin` with `SET search_path = public`, caller guards, and `REVOKE ALL`. |
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
| FE-02 | Sensitive State in Browser Storage | **PASS** | `AdminProvider` (`admin-context.tsx`) no longer reads or trusts `sessionStorage` (`wealthnest_simulated_admin_role`). `auth-context.tsx` restricts `wealthnest_offline_mode` `localStorage` to Tauri/test runtimes. |
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
| ADM-01 | Frontend Admin Route Guard (`AdminProvider` & `AdminGuard`) | **PASS** | `admin-context.tsx` initializes `role` to `null`, ignores `sessionStorage`, removes all `'super_admin'` fallbacks, and derives role strictly from `get_platform_admin_role` RPC. `AdminGuard.tsx` removed all simulation/self-elevation buttons. Verified by `AdminPortal.test.tsx`. |
| ADM-02 | Backend Admin RPC Authorization (`20260101000009`) | **PASS** | `admin_get_users`, `admin_get_user_detail`, and admin mutation RPCs verify `public.is_platform_admin(auth.uid())` inside `SECURITY DEFINER` functions with `SET search_path = public`. |
| ADM-03 | Support Impersonation Session Controls (`20260101000010`) | **PASS** | `admin_start_support_session`, `admin_end_support_session`, and `validate_support_session` verify caller `auth.uid()`, `admin_user_id` ownership, `is_active`, 15-minute `expires_at` TTL, and write to `admin_audit_logs`. |
| ADM-04 | Client-Side Support Session Demo Fallback | **PASS** | `support-session.adapter.ts:49-57` propagates RPC errors in production/staging and restricts the local simulated fallback strictly to `isOfflineLocalActive()` or `MODE === 'test'`. |

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
| DEP-01 | Nginx TLS & Security Headers (`infra/docker/nginx-prod.conf`) | **PARTIAL** | Added `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`, and `Strict-Transport-Security` (`always`) to `nginx-prod.conf`; still listens on HTTP port 80 (assumes upstream TLS termination). |
| DEP-02 | Tauri Desktop CSP (`src-tauri/tauri.conf.json:26`) | **PASS** | Replaced `"csp": null` in `src-tauri/tauri.conf.json` with an explicit Content Security Policy. |
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
| TST-01 | Monorepo Unit Test Suite | **PASS** | Re-verified after Quick Fixes #1–#8: `@wealthnest/domain` (**30 files, 171 tests**), `@wealthnest/application` (**24 files, 99 tests**), `@wealthnest/shared` (**1 file, 2 tests**), `@wealthnest/web` (**34 files, 142 tests**) — **89 files, 414 tests passed** (including `AdminPortal.test.tsx`, `SupportImpersonation.test.tsx`, `AuthPages.test.tsx`, `App.test.tsx`, `backup-security-sqlite.test.ts`, `sqlite-isolation.test.ts`, `admin-invariants.test.ts`). |
| TST-02 | Database pgTAP / Live RLS Integration Tests | **FAIL** | `supabase/tests/` contains only `.gitkeep`; there are no automated pgTAP or live Postgres RLS regression tests. |
| TST-03 | Live E2E / DAST Penetration Verification | **REQUIRES MANUAL VERIFICATION** | No live browser E2E against a running Supabase instance was executed in the offline sandbox. |

---

## 17. Risk Classification Matrix & Remediation Status

| Original Risk | ID | Status | Summary | Location |
| --- | --- | --- | --- | --- |
| **CRITICAL** | ADM-01 | **RESOLVED** | Removed `'super_admin'` default/fallbacks, `sessionStorage` trust, and `seed_qa_grant_admin` UI button | `apps/web/src/lib/admin/admin-context.tsx`, `apps/web/src/components/admin/AdminGuard.tsx` |
| **CRITICAL** | DB-05b | **RESOLVED** | Hardened `seed_qa_grant_admin` (`SET search_path = public`, caller guard, `REVOKE ALL`) and dropped in migration `000017` | `supabase/seed_qa.sql:19-63`, `20260101000017_security_hardening_rls_and_grants.sql` |
| **HIGH** | DB-03 | **RESOLVED** | Removed `OR auth.uid() IS NULL` from `admin_audit_logs` INSERT policy (apply via `supabase db push`) | `20260101000017_security_hardening_rls_and_grants.sql` |
| **HIGH** | DB-02 | **RESOLVED** | Revoked `ALL` on `public` tables/sequences/routines from `anon` (apply via `supabase db push`) | `20260101000017_security_hardening_rls_and_grants.sql` |
| **HIGH** | AUTH-07 | **RESOLVED** | Added `<ProtectedRoute>` on investor routes and restricted offline mode to Tauri/test runtimes | `apps/web/src/App.tsx`, `apps/web/src/lib/supabase/auth-context.tsx` |
| **HIGH** | AUTH-02 | **MITIGATED (PARTIAL)** | Raised signup minimum password length to 12 chars and enabled `enable_confirmations = true` in `config.toml`; Cloud Auth policy requires manual check | `apps/web/src/pages/SignUpPage.tsx:62`, `supabase/config.toml:37` |
| **HIGH** | DEP-01 / DEP-02 | **MITIGATED / RESOLVED** | Added CSP, HSTS, Referrer-Policy, Permissions-Policy to Nginx (`DEP-01` partial: HTTP port 80); added Tauri CSP (`DEP-02` resolved) | `infra/docker/nginx-prod.conf`, `src-tauri/tauri.conf.json:26` |
| **MEDIUM** | DB-05a | **RESOLVED** | Added `ALTER FUNCTION public.handle_new_user() SET search_path = public;` | `20260101000017_security_hardening_rls_and_grants.sql` |
| **MEDIUM** | ADM-04 | **RESOLVED** | Propagates RPC errors in production/staging; local demo fallback restricted to offline/test | `apps/web/src/lib/supabase/support-session.adapter.ts:49-57` |
| **MEDIUM** | KEY-02 | **RESOLVED** | Removed hardcoded QA Supabase URL & publishable key fallbacks | `apps/web/src/pages/LoginPage.tsx`, `server-config.ts`, `build-installers.yml` |
| **MEDIUM** | TST-02 | **OPEN (FAIL)** | No pgTAP / automated database RLS test suite | `supabase/tests/` |
| **LOW** | AUTH-06 | **OPEN (PARTIAL)** | Multiple `GoTrueClient` instances warning during dynamic server switching | `apps/web/src/lib/services/connection-manager.ts` |

---

## 18. Checks Requiring Manual Verification (Outside Repo / Offline Sandbox)

1. `npm audit --omit=dev --json` against `registry.npmjs.org` (PKG-01).
2. `npx supabase status` and live `pg_policies` / `pg_proc` inspection on staging and production Supabase projects (DB-07, HH-03).
3. Supabase Dashboard Auth settings: `enable_confirmations`, password strength rules, JWT expiry, refresh token rotation/reuse detection, and rate limiting (AUTH-02, AUTH-05, AUTH-08).
4. Verification that `supabase/seed_qa.sql` has **not** been executed on any production or staging database (DB-05b).
5. Cloudflare Workers/Pages HTTP security headers (`_headers` or Transform Rules) (DEP-04).
6. Tauri SQLite file-at-rest protection expectations for desktop/mobile builds (DEP-05).
7. Live end-to-end penetration test of cross-household RLS, viewer write blocking, and storage signed URLs (TST-03).

