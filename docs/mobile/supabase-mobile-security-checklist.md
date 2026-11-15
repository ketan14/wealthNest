# WealthNest — Supabase & Android Mobile Security Checklist

**Document Type:** Architecture Security & Verification Deliverable  
**Status:** Assessment Baseline (Target Controls & Verification Suite — Not Yet Implemented)  
**Target Platform:** Android (`in.wealthnest.app`) connecting directly to Supabase

---

## 1. Executive Security Summary

WealthNest's existing backend enforces strict PostgreSQL Row Level Security (`20260101000014`, `20260101000016`, `20260101000017`, `20260101000018`, `20260101000019`) and already passes 35 pgTAP security assertions (`01_rls_and_household_isolation.sql` + `02_admin_rbac_and_audit_immutability.sql`). However, audit of the existing client and Tauri 2 Android build reveals **six P0 mobile security blockers** that must be remediated before distributing an Android production APK/AAB:

1. **Plaintext Refresh Token Storage:** `ConnectionManager` relies on `@supabase/supabase-js` default `localStorage` (`wn-<host>-<hash>-auth-token`), leaving refresh tokens readable in WebView app data dumps on rooted/compromised devices.
2. **Plaintext PII in `localStorage`:** `SupabaseUserAdapter`, `SupabaseFamilyAdapter` (`panMasked`), `PreferencesContext`, and `TauriSqliteAdapter` (`LOCAL_SQLITE_STORAGE_KEY`) persist financial records and PII unencrypted in WebView `localStorage`.
3. **Hardcoded Debug Keystore & LAN Cleartext Mode:** `scripts/build-android.sh` signs APKs with a hardcoded `wealthnest123` local keystore, while `server-config.ts` / `ConnectionManager` permit switching to `http://` LAN/local endpoints unless explicitly locked out of production mobile builds.
4. **Incomplete Household RLS & Client `.eq('user_id', userId)` Bug:** `loan_payments`, `asset_liability_links`, and `import_batches` lack `20260101000014` household RLS policies, while `asset_liability_links` lacks a DB-level cross-household ownership invariant check; meanwhile 6 adapters/modules filter by `.eq('user_id', userId)` client-side.
5. **Broken Auth Redirects & Missing PKCE OAuth:** `ForgotPasswordModal.tsx` and `HouseholdSharingCard.tsx` build links from `window.location.origin`, which resolves to internal WebView origins (`https://tauri.localhost` / `http://localhost`) rather than verified Android App Links.
6. **Non-Atomic Financial Mutations & Backup Schema Drift:** EMI payments, investment transactions, CAS imports, asset valuations, vault uploads, and backup restores execute non-atomic client multi-step sequences; `SupabaseBackupAdapter` targets non-existent `financial_goals` instead of `goals`.

---

## 2. Credential, Secret & Environment Checklist

| ID | Control | Current Status | Verification / Target Requirement |
| :--- | :--- | :--- | :--- |
| **CRED-01** | No `service_role` / `sb_secret_` in mobile binary | **PASS (With Guard)** (`isSecretApiKey()` in `server-config.ts`) | CI check grepping compiled `apps/web/dist` and Android assets confirms `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, and admin tokens are absent. |
| **CRED-02** | Public publishable / anon key only in build env | **PASS** | Mobile release uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_ANON_KEY`; RLS + `000017` privileges protect DB when keys are extracted from APK. |
| **CRED-03** | Release server-config lockdown | **FAIL** | Remove user-editable `local` / `lan` HTTP switching in Android `release` builds (`VITE_MOBILE_RELEASE_LOCK=true`); allow runtime endpoint switcher only in `debug`/`qa` flavors. |
| **CRED-04** | Edge Function & Push secrets server-side | **PASS (Admin) / TARGET (Push)** | Keep `SUPABASE_SERVICE_ROLE_KEY` and future Firebase Cloud Messaging (`FCM_SERVICE_ACCOUNT`) exclusively in Supabase Edge Function secrets (`supabase secrets set`). |
| **CRED-05** | Separate Android release signing key | **FAIL** (`wealthnest123` in `scripts/build-android.sh`) | Use **Google Play App Signing** with an upload keystore injected solely via encrypted CI secrets / HSM — zero hardcoded passwords in git scripts. |

---

## 3. Authentication, Token Storage & Biometric Lock Checklist

| ID | Control | Current Status | Target Implementation & Verification |
| :--- | :--- | :--- | :--- |
| **AUTH-01** | Hardware-backed refresh token persistence | **FAIL** (`localStorage`) | Implement custom `SupportedStorage` passed to `createClient(..., { auth: { storage } })` backed by **Android Keystore (`AES-256-GCM`) + `EncryptedSharedPreferences`** via native plugin/bridge; migrate and clear legacy `wn-*-auth-token` WebView keys. |
| **AUTH-02** | Short-lived JWT + rotating refresh tokens | **PASS (Server)** (`jwt_expiry = 3600`, `enable_refresh_token_rotation = true`, 10s reuse) | Enforce single-flight mutex around `supabase.auth.refreshSession()` on Android lifecycle `resume` + background sync workers so concurrent refreshes do not trigger false refresh-token reuse revocation. |
| **AUTH-03** | Chrome Custom Tabs for OAuth PKCE | **NOT IMPLEMENTED** | Implement `signInWithOAuth` using **PKCE** (`flowType: 'pkce'`) launched in Android **Chrome Custom Tabs** (or Google Credential Manager ID token + `signInWithIdToken`); **never** render Google/OAuth login inside an embedded WebView (`DISALLOWED_USERAGENT`). |
| **AUTH-04** | Verified Android App Links for redirects | **FAIL** (`window.location.origin`) | Replace `${window.location.origin}/reset-password` and invite links with `https://app.wealthnest.in/...` verified by `https://app.wealthnest.in/.well-known/assetlinks.json` (`autoVerify="true"`), avoiding unverified custom-scheme hijacking. |
| **AUTH-05** | Explicit multi-device sign-out & token purge | **PARTIAL** | Add `signOut({ scope: 'global' })` ("Log out all devices") and `signOut({ scope: 'others' })` to `ProfileSecurityTab.tsx`; wipe Keystore auth entries, TanStack Query memory cache, WebView storage, FCM token registration, and local offline DB on `SIGNED_OUT`. |
| **AUTH-06** | Biometric app lock on resume | **NOT IMPLEMENTED** | Gate cached session rehydration behind Android `BiometricPrompt` (`BIOMETRIC_STRONG`; configurable grace timeout e.g. 60s backgrounded) using a Keystore key requiring biometric auth (`setUserAuthenticationRequired(true)`). |
| **AUTH-07** | Suspended/deactivated user lockout on mobile | **PARTIAL** | On app foreground resume (`visibilitychange` / native `onResume`), verify active status cleanly alongside `getUser()`; force immediate local logout and cache wipe if JWT invalid or `user_access_status` blocks access. |
| **AUTH-08** | Disable unauthenticated backup/demo masking | **FAIL** (`DEMO_ADMIN_USERS` fallback in `admin.adapter.ts`) | Strip silent demo fallback data in production builds so authorization failures fail closed with explicit re-auth or error UI. |

---

## 4. Local Data, Storage & WebView Cache Security Checklist

| ID | Control | Current Status | Target Implementation |
| :--- | :--- | :--- | :--- |
| **DATA-01** | Eliminate plaintext PII in `localStorage` | **FAIL** (`profiles`, `family_members`, `panMasked`, `LOCAL_SQLITE_STORAGE_KEY`) | Remove PII persistence from `localStorage`. Keep only non-sensitive UI flags (`wealthnest_hide_balances`, theme/locale). |
| **DATA-02** | Encrypted offline storage (if offline enabled) | **FAIL** (`TauriSqliteAdapter` uses JSON in `localStorage`) | Replace unencrypted SQLite/`localStorage` snapshot with **SQLCipher** (`AES-256`) whose 256-bit DB passphrase is randomly generated per install and wrapped in Android Keystore. |
| **DATA-03** | Private Vault & CAS PDF file handling | **PARTIAL** (`family-vault` RLS + 120s signed URL) | Never download vault PDFs/images or CAS imports to public `Downloads`/`ExternalStorage`; use app-private `cacheDir` with immediate deletion after view/parse (`PdfJsTextExtractorAdapter`) and `FileProvider` only for explicit user shares. |
| **DATA-04** | App Switcher screenshot protection | **NOT IMPLEMENTED** | Enable `WindowManager.LayoutParams.FLAG_SECURE` dynamically on authenticated/sensitive screens (Portfolio, Transactions, Vault, Settings/PAN) or globally with opt-in override only in QA builds, masking recents thumbnail in Android task switcher. |
| **DATA-05** | Disable `android:allowBackup` | **NOT VERIFIED** | Set `android:allowBackup="false"` and `android:fullBackupContent="false"` in `AndroidManifest.xml` so cloud/ADB backups cannot extract Keystore wrappers, SQLite files, or WebView state. |
| **DATA-06** | Clear Support Session state on background | **PARTIAL** (`sessionStorage`) | Do not preserve ephemeral `SupportSessionContext` IDs across Android cold kills; enforce 15-min server expiry cleanly in UI. |

---

## 5. Android Platform, Network & Deployment Security Checklist

| ID | Control | Current Status | Target Implementation |
| :--- | :--- | :--- | :--- |
| **NET-01** | Disallow cleartext HTTP in production | **FAIL** (CSP allows `http://*:54321`, `ConnectionManager` permits `lan` HTTP) | Configure Android `res/xml/network_security_config.xml` with `cleartextTrafficPermitted="false"` on all `release` builds; allow `127.0.0.1` / LAN HTTP only in `src/debug/res/xml/network_security_config.xml`. |
| **NET-02** | TLS 1.2+ & Certificate Pinning stance | **PARTIAL** | Enforce Android OS System CA trust + TLS 1.2/1.3 (Android API 24+ guarantees TLS 1.2; API 29+ TLS 1.3). **Do NOT hardcode Supabase leaf certs** (CDN/Cloudflare cert rotation bricks app); if pinning is mandated later, pin root/intermediate CAs with backup pins + remote kill-switch or rely on Android Network Security Config + Certificate Transparency. |
| **NET-03** | WebView hardening & CSP alignment | **PARTIAL** | Set `WebView.setWebContentsDebuggingEnabled(false)` in release; restrict `WebSettings.allowFileAccess = false`, `allowUniversalAccessFromFileURLs = false`; tighten release CSP `connect-src` to HTTPS/WSS `*.supabase.co` only (matching `apps/web/public/_headers`). |
| **NET-04** | Edge Function CORS origin compatibility | **CHECK REQUIRED** (`admin-create-user` `ALLOWED_ORIGINS`) | Ensure `ALLOWED_ORIGINS` (when configured in `.github/workflows/supabase-migration.yml`) explicitly matches approved Capacitor/Tauri origin (`https://localhost` / `capacitor://localhost` / `https://tauri.localhost`) ONLY if admin Edge Functions are callable from mobile; better yet, disable `/admin` mutation flows on consumer APK builds. |
| **NET-05** | Least-privilege Android permissions | **NOT VERIFIED** | Permit only `INTERNET`, `ACCESS_NETWORK_STATE`, `USE_BIOMETRIC`, `POST_NOTIFICATIONS` (API 33+). Use Android **Photo Picker / Storage Access Framework (SAF)** instead of broad `READ_EXTERNAL_STORAGE` / `MANAGE_EXTERNAL_STORAGE`. Never request location, contacts, SMS, or call permissions. |
| **NET-06** | R8 / ProGuard obfuscation & integrity | **NOT CONFIGURED** | Enable `minifyEnabled true` and `shrinkResources true` on Android `release` builds; evaluate **Google Play Integrity API** attestation for abuse-sensitive future endpoints via Supabase Edge Function. |
| **LOG-01** | Zero PII in Android Logcat & crash reports | **AT RISK** | Enforce redaction layer modeled on `sanitizeAuditMetadata()` (`packages/domain/src/admin/admin-invariants.ts`): scrub JWTs, refresh tokens, `apikey`, PAN, Aadhaar, email, net worth numbers, holding names, and signed Storage URLs before Crashlytics/Sentry emission or `console.*` logging in production. |

---

## 6. Household Security & Isolation Test Cases (Verification Suite)

Android mobile clients run the exact same Supabase JWT and PostgreSQL RLS evaluation as web users. Before production mobile launch, expand `supabase/tests/01_rls_and_household_isolation.sql` and add Android E2E integration tests covering these **10 security test cases**:

| Test ID | Attack / Scenario | Setup & Action (Mobile / API) | Expected Result (Must Pass) |
| :--- | :--- | :--- | :--- |
| **TC-MOB-ISO-01** | **Cross-Household Data Read (IDOR)** | User B (Household Beta) calls direct PostgREST `GET /rest/v1/holdings?user_id=eq.<UserA_UUID>` and `GET /rest/v1/goals`, `transactions`, `liabilities`, `family_members`, `portfolio_accounts` using User B's Android JWT. | HTTP `200 OK` with empty array `[]` (0 rows returned); `is_same_household(UserB, UserA)` evaluates `false`. |
| **TC-MOB-ISO-02** | **Cross-Household FK Injection** | User B calls `record_transaction_atomic` or `INSERT` on `asset_liability_links` / `goal_holding_allocations` referencing User A's `asset_id` or `liability_id` combined with User B's entity ID. | Rejected by DB RLS / trigger (`42501` RLS violation or `CrossUserIsolationViolation` SQLSTATE exception). Requires adding missing household boundary check on `asset_liability_links`! |
| **TC-MOB-ISO-03** | **Household `viewer` Write Escalation** | User V has `household_role = 'viewer'` in Household Alpha. User V replays POST/PATCH/RPC calls on `holdings`, `transactions`, `record_emi_payment_atomic`, `record_asset_valuation_atomic`, and `family_documents` from modified Android client. | Rejected (`42501` / `can_edit_household_record(UserV, Owner)` = `false`). Zero rows inserted/mutated; signed upload to `<Owner>/<doc>` blocked by Storage policy. |
| **TC-MOB-ISO-04** | **Household `member` Role Self-Promotion** | User M (`household_role = 'member'` in Household Alpha) executes `PATCH /rest/v1/household_members?user_id=eq.<UserM>` setting `household_role = 'primary_owner'`, or attempts `DELETE` removing Primary Owner. | Rejected by `is_household_primary_owner` RLS policy (`20260101000019`). Role remains `'member'`. |
| **TC-MOB-ISO-05** | **Household Bootstrap & Ownership Hijack** | Attacker creates row in `households` setting `created_by = <Victim_UUID>`, or attempts `UPDATE households SET created_by = <Attacker_UUID>` on existing household. | Rejected by `households` INSERT (`auth.uid() = created_by`) and UPDATE `household_creator_unchanged()` (`20260101000019`). |
| **TC-MOB-ISO-06** | **Vault Storage Path Traversal & MIME Spoofing** | User B requests `storage.from('family-vault').createSignedUrl('<UserA_UUID>/<doc_id>/pan.pdf', 120)` or uploads `.exe`/`.html` renamed `.pdf` from Android Storage picker. | Signed URL denied by `storage.objects` SELECT RLS (`20260101000016`); client `validateVaultFileBlobSignature` + Storage bucket `allowed_mime_types` + 20 MiB limit reject spoofed payload. |
| **TC-MOB-ISO-07** | **Household Sharing Consistency Across Devices** | Primary Owner adds Holding H1 on Web; Spouse (`household_role = 'member'`) opens Android app and queries portfolio/EMIs/transactions. | After fixing `.eq('user_id', userId)` client filters & `loan_payments` household RLS, Spouse sees H1 immediately and can record valid edits via household RLS. |
| **TC-MOB-ISO-08** | **Support Session Hijack & Read-Only Escape** | Support Admin opens support session for User A on Web/Mobile (`S1`); second Admin B tries `support_get_user_portfolio(S1)`, or Admin A retries after 15m TTL or attempts `INSERT` into `holdings` on behalf of User A. | Cross-admin `S1` & expired `S1` rejected (`validate_support_session` logs denied/expired audit + raises); direct `holdings` INSERT blocked by RLS unless Admin is in User A's household. |
| **TC-MOB-ISO-09** | **Post-Revocation Stale Mobile Cache & Offline Outbox** | Mobile client has offline/cached view while User M is removed from Household Alpha (or downgraded to `'viewer'`) on server. User M reconnects on Android and flushes queued mutations or opens cached screen. | Server rejects queued mutations (`403`/`42501`); mobile SyncEngine marks pending items non-retryable, refreshes role, purges unauthorized household records from Keystore/SQLCipher cache, and clears TanStack Query. |
| **TC-MOB-ISO-10** | **`anon` Key Abuse Against Financial & Admin RPCs** | Attacker extracts `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` from APK and invokes `admin_get_users()`, `admin_set_user_status()`, `record_transaction_atomic()`, or `SELECT * FROM holdings` without `Authorization` bearer JWT. | All financial tables & `admin_*` RPCs return denied / empty (`20260101000017` `anon` revoke + `auth.uid() IS NULL` guards in `20260101000018`); only public `asset_classes` catalog is readable. |

---

## 7. Financial Atomicity & Ledger Security Controls

| Control ID | Vulnerability Found in Current Code | Target Mobile-Safe Control |
| :--- | :--- | :--- |
| **FIN-01** | `RecordEmiPaymentModal` updates `liability_balances` only (no `loan_payments`, same-date upsert overwrites) | Route through `record_emi_payment_atomic` RPC with `idempotency_key`, row lock (`FOR UPDATE`), integer `bigint` paise math, and linked `loan_payments` + `liability_balances` writes. |
| **FIN-02** | `RecordTransactionUseCase` read-modify-writes `holdings` and `transactions` in two separate HTTP calls | Route through `record_transaction_atomic` RPC with `idempotency_key` + `expected_version` optimistic concurrency check so Web + Android never clobber units/avg cost. |
| **FIN-03** | `DeleteTransactionUseCase` calls `.delete()` without DELETE RLS on `transactions` | Prohibit physical row deletes on financial ledger; expose `correct_transaction_atomic` RPC creating audited compensating reversal + corrected entry. |
| **FIN-04** | `SupabaseCasImportAdapter` executes N+1 sequential loops vulnerable to mid-flight 4G drops | Send single payload + SHA-256/`idempotency_key` to `confirm_cas_import_batch_atomic` RPC inside one Postgres transaction. |
| **FIN-05** | `SupabaseBackupAdapter` targets `financial_goals` (wrong table name) and legacy `(user_id, asset_id)` conflict key | Replace with `restore_portfolio_atomic` targeting `goals`, `idx_holdings_user_asset_account`, and strict `auth.uid()` ownership scoping. |
| **FIN-06** | `recordAssetValuation` overwrites `holdings.current_value_cents` even for historical backdated entries | Enforce `p_as_of_date >= latest_valuation_date` guard inside `record_asset_valuation_atomic` RPC. |
| **FIN-07** | Client `number` precision (`Math.round(amount * 100)`) mixed with `bigint` paise fields | Preserve integer paise strings/BigInts end-to-end across DTOs, RPC JSONB serialization (`::text` or safe 53-bit integer checks), and future SQLCipher columns (`*_cents`). |
