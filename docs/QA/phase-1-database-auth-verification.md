# QA Test Plan: Phase 1 — Database, Supabase Studio & Auth Foundation

This document defines the formal Quality Assurance test cases for **Phase 1** of WealthNest.

---

## 🎯 Scope & Objectives
Validate that:
1. The local PostgreSQL database and Supabase services start with health status `healthy`.
2. Supabase Studio visual database manager is accessible on port `54323` and displays all core tables.
3. User registration via Supabase Auth creates an authenticated session and automatically fires the database trigger to create a corresponding row in `public.profiles`.
4. Mock verification emails are delivered to the local Inbucket inbox on port `54324`.
5. Row-Level Security (RLS) ensures strict tenant data isolation.

---

## 🧪 Test Cases

### TC-P1-001: System Overview & Architecture Status
- **Objective**: Verify that the web app displays architecture health and live seeded database taxonomy.
- **URL**: [http://wealthnest.local](http://wealthnest.local)
- **Preconditions**: Docker Compose & Supabase containers are running.
- **Test Steps**:
  1. Open [http://wealthnest.local](http://wealthnest.local) in a browser.
  2. Inspect the **Active Architecture Layers** section.
  3. Inspect the **Asset Class Taxonomy** card.
- **Expected Results**:
  - All 4 clean architecture layers (`@wealthnest/domain`, `@wealthnest/application`, `@wealthnest/shared`, `@wealthnest/web`) display green checkmarks with status `Active`.
  - The database seed taxonomy renders 7 asset classes with their custom hex color swatches.
- **Status**: ✅ **PASSED**

---

### TC-P1-002: Supabase Studio Visual Table Browser
- **Objective**: Verify that the visual database manager (phpMyAdmin alternative) is operational.
- **URL**: [http://localhost:54323](http://localhost:54323)
- **Preconditions**: `supabase_studio_wealthnest` container is UP.
- **Test Steps**:
  1. Open [http://localhost:54323](http://localhost:54323) in a browser.
  2. In the left navigation menu, click **Table Editor** (spreadsheet icon).
  3. Browse the table list.
- **Expected Results**:
  - The Table Editor opens without connection errors.
  - The following 5 tables are listed: `asset_classes`, `profiles`, `assets`, `holdings`, `transactions`.
  - Clicking `asset_classes` reveals 7 seeded taxonomy records.
- **Status**: ✅ **PASSED**

---

### TC-P1-003: User Registration & Automated Profile Trigger
- **Objective**: Verify user account creation and automated PostgreSQL trigger execution (`handle_new_user`).
- **URL**: [http://wealthnest.local](http://wealthnest.local)
- **Preconditions**: Local Supabase Auth service is active.
- **Test Steps**:
  1. Locate the **Sign In to WealthNest** card on the Overview page.
  2. Click **"Need an account? Sign up"**.
  3. Enter email: `test.investor@wealthnest.local`.
  4. Enter password: `TestPassword123!`.
  5. Click **Register Profile**.
- **Expected Results**:
  - A green confirmation notification appears: *"Account registered! Profile automatically created via trigger."*
  - Open Supabase Studio -> `profiles` table. A new row exists with `id` matching the new user's UUID.
- **Status**: ✅ **PASSED**

---

### TC-P1-004: Inbucket Mock Email Delivery
- **Objective**: Verify that local transactional emails are captured without third-party email services.
- **URL**: [http://localhost:54324](http://localhost:54324)
- **Preconditions**: TC-P1-003 executed.
- **Test Steps**:
  1. Open [http://localhost:54324](http://localhost:54324) in a browser.
  2. Search for `test.investor@wealthnest.local` in the inbox.
- **Expected Results**:
  - An email with subject *"Confirm Your Signup"* or equivalent is received in the Inbucket web inbox.
- **Status**: ✅ **PASSED**

---

### TC-P1-005: Row-Level Security (RLS) Multi-Tenant Isolation
- **Objective**: Verify that users cannot read or modify another user's financial assets or profile.
- **Preconditions**: PostgreSQL RLS enabled on all tables.
- **Test Steps**:
  1. Inspect PostgreSQL table policies in Supabase Studio -> **Authentication** -> **Policies**.
  2. Query `SELECT * FROM public.assets;` from an unauthenticated client or User B.
- **Expected Results**:
  - Policies `Users can view their own assets` and `Users can manage their own holdings` enforce `auth.uid() = user_id`.
  - Zero rows from other users are returned.
- **Status**: ✅ **PASSED**

---

### TC-P1-006: Clean Architecture Boundary Verification
- **Objective**: Verify that pure domain arithmetic executes with zero floating-point rounding errors.
- **Test Command**:
  ```bash
  docker exec wealthnest-web-dev npm test -w @wealthnest/domain
  ```
- **Expected Results**:
  - All Money value object test cases pass.
  - Adding BigInt cents (`150000.5 + 49999.5 = 200000.0`) produces exact integer results.
- **Status**: ✅ **PASSED**
