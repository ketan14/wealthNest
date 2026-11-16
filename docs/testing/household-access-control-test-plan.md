# Household Access Control Test Plan & Verification Matrix

This document outlines the testing strategy, test fixtures, test personas, pgTAP assertion mappings, and UI regression suites validating WealthNest's multi-user household access control architecture.

Related reference documents:
- [household-ownership-and-access-model.md](file:///home/ketan/projects/Krisha/wealthNest/docs/architecture/household-ownership-and-access-model.md)
- [household-permission-matrix.md](file:///home/ketan/projects/Krisha/wealthNest/docs/architecture/household-permission-matrix.md)
- [household-rls-security-review.md](file:///home/ketan/projects/Krisha/wealthNest/docs/security/household-rls-security-review.md)

---

## 1. Test Environment & Fixture Strategy

Testing is conducted using **Option A (Disposable Reset + Multi-User QA Seed)** via [`supabase/seed_qa.sql`](file:///home/ketan/projects/Krisha/wealthNest/supabase/seed_qa.sql), which sets up deterministic multi-household test data with realistic family structures, joint assets, and cross-household isolation boundaries.

### 1.1 Test Personas Matrix

| Persona | Email / User ID | Household | Governance Role | Profile Type / Linkage |
|---|---|---|---|---|
| **Ketan** (Primary) | `qa-primary@wealthnest.local` | Household 1 ("Vaghela Family") | `primary_owner` | Linked adult profile |
| **Ananya** (Spouse) | `qa-secondary@wealthnest.local` | Household 1 ("Vaghela Family") | `admin` | Linked adult profile |
| **Rohan** (Son) | Unlinked | Household 1 ("Vaghela Family") | None | Unlinked minor profile |
| **Meera** (Mother) | Unlinked | Household 1 ("Vaghela Family") | None | Unlinked senior profile |
| **Suresh** (Auditor) | `qa-viewer@wealthnest.local` | Household 1 ("Vaghela Family") | `viewer` | Linked adult profile |
| **External User** | `qa-outsider@wealthnest.local` | Household 2 ("Sharma Family") | `primary_owner` | Separate household isolation test |

---

## 2. Automated Test Suites & Coverage Mapping

### 2.1 Database & RLS Tests (pgTAP — 72 Assertions)

The PostgreSQL automated test suite is located in [`supabase/tests/`](file:///home/ketan/projects/Krisha/wealthNest/supabase/tests) and runs in CI on every push.

#### Suite 1: `01_rls_and_household_isolation.sql` (26 tests)
- **Household Scoping**: Verifies that users cannot read or write records from foreign households across `assets`, `holdings`, `liabilities`, `goals`, and `family_documents`.
- **Active Membership Enforcement**: Asserts that deactivated or removed members immediately lose access to all household data.
- **Tenancy Column Integrity**: Confirms all 11 financial tables require non-null `household_id` and have zero legacy `user_id` ownership columns.

#### Suite 2: `02_admin_rbac_and_audit_immutability.sql` (14 tests)
- **Primary Owner Invariant**: Tests that a household cannot have 0 or >1 active `primary_owner` rows (partial unique index enforcement).
- **Admin Appointment & Demotion**: Verifies only `primary_owner` can invoke `appoint_household_admin`.
- **Audit Immutability**: Asserts that direct `UPDATE` or `DELETE` on `household_audit_logs` fails with permission denied for all roles.
- **Platform Admin Boundary**: Validates that platform support staff cannot inspect user financial data without explicit support session RPCs.

#### Suite 3: `03_household_ownership_privacy_and_invitations.sql` (32 tests)
- **Privacy Boundaries**:
  - Validates that `owner_only` records created by Ananya are invisible to Ketan (`primary_owner`) and Suresh (`viewer`).
  - Asserts that `restricted` records are accessible only to the owner and explicitly granted users in `restricted_record_grants`.
- **Joint Ownership & Sum Constraints**:
  - Tests that `holding_owners` shares must sum to exactly `100.00%`.
  - Tests that `liability_parties` borrower shares must sum to exactly `100.00%`.
- **Invitations Flow**:
  - Tests invitation dispatch, token hashing, expiration, and revocation.
  - Tests `accept_household_invitation(token)` atomicity and email verification guard.
  - Verifies rejection when email does not match `invited_email`.

### 2.2 Frontend & Application Component Tests (Vitest)

Application-level access control tests are located in [`apps/web/src/__tests__/HouseholdAccessControl.test.tsx`](file:///home/ketan/projects/Krisha/wealthNest/apps/web/src/__tests__/HouseholdAccessControl.test.tsx).

- **Household Switcher**: Verifies switching active households flushes and re-keys query caches.
- **Role-Aware UI Rendering**:
  - `viewer` sees view-only tables, with all "Add", "Edit", and "Delete" buttons hidden.
  - `admin` sees unlinked profile management tools and household-shared editors.
  - `member` sees personal portfolio controls and delegation panels.
- **Privacy Controls**: Tests `VisibilityControl` selector and guarantees `owner_only` badges render correctly.
- **Joint Ownership Allocations**: Tests `JointOwnershipEditor` percentage validation and largest-remainder `BigInt` distribution.

---

## 3. Beta Readiness Verification Checklist

| Verification Item | Acceptance Criteria | Verified |
|---|---|:---:|
| **RLS Enabled on All Tables** | `pg_tables.rowsecurity = true` across all 17 public tables | Yes |
| **Anon Permissions Restricted** | Anon has `SELECT` only on `asset_classes`; 0 privileges on financial data | Yes |
| **Search Path Hardening** | All `SECURITY DEFINER` functions have `search_path = public` | Yes |
| **Single Primary Owner Rule** | Partial unique index rejects multiple active primary owners | Yes |
| **Storage Bucket Isolation** | `family-vault` objects partitioned by `/<household_id>/...` and joined to RLS | Yes |
| **pgTAP Suite Passing** | 72/72 tests pass with zero failures | Yes |
| **Frontend Type-Check** | `npm run type-check` compiles cleanly across all packages | Yes |
