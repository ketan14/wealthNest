# Household RLS Security Review

This document provides a comprehensive security review and architectural audit of WealthNest's PostgreSQL Row Level Security (RLS) implementation, stored procedures (`SECURITY DEFINER`), and access isolation boundaries across multi-user households.

Related reference documents:
- [household-ownership-and-access-model.md](file:///home/ketan/projects/Krisha/wealthNest/docs/architecture/household-ownership-and-access-model.md)
- [household-permission-matrix.md](file:///home/ketan/projects/Krisha/wealthNest/docs/architecture/household-permission-matrix.md)

---

## 1. Security Architecture & Threat Model

### 1.1 Core Tenancy Model
WealthNest implements strict multi-tenant isolation where each tenant is a **Household** (`households`), identified by `household_id UUID NOT NULL`. All financial tables, documents, and storage objects are scoped by `household_id`. Legacy user-level tenancy (`user_id` on financial entities) has been eliminated.

### 1.2 Threat Vectors Evaluated

| Threat Vector | Attack Scenario | Defense & Mitigation in WealthNest |
|---|---|---|
| **T-1: Cross-Household IDOR** | An authenticated user belonging to Household A attempts to read/write records in Household B by guessing or forging UUIDs. | Every RLS policy validates that `household_id` matches an active membership via `is_active_household_member(household_id)`. Without an active membership, rows are filtered out by the database engine. |
| **T-2: Admin Privacy Escalation** | A household admin or primary owner attempts to inspect private investments (`owner_only` or `restricted`) of an adult spouse/child. | RLS policies on `assets`, `holdings`, `liabilities`, `goals`, and `family_documents` verify ownership via `can_access_asset`, `can_access_holding`, etc. If `visibility = 'owner_only'`, non-owners are denied access regardless of whether they hold `admin` or `primary_owner` roles. |
| **T-3: Role Self-Promotion** | A `member` or `viewer` attempts to elevate themselves to `admin` or `primary_owner` via direct `UPDATE household_members`. | Direct updates to `household_role` are prohibited by RLS. Role transitions occur exclusively through trusted stored procedures: `appoint_household_admin` (requires active `primary_owner`) and `transfer_household_primary_owner` (atomic owner swap). |
| **T-4: Invitation Token Hijack / Replay** | An attacker intercepts an invitation token or attempts to reuse an expired/revoked invite to join a household. | Invitations store SHA-256 token hashes (`token_hash`), never raw tokens. `accept_household_invitation` enforces: (a) non-expired status (`expires_at > now()`), (b) unrevoked status (`revoked_at IS NULL`), (c) unaccepted status (`accepted_at IS NULL`), and (d) strict email match against `auth.users.email` with `email_confirmed_at IS NOT NULL`. Tokens are marked accepted in the same atomic transaction. |
| **T-5: Storage Path Traversal & Leakage** | An attacker modifies the storage path parameter to access files in another household's vault bucket. | Storage RLS on `storage.objects` for bucket `family-vault` enforces strict path prefixing: `(storage.foldername(name))[1] = household_id::text`. The file UUID is joined against `family_documents` to verify that the caller has document-level access (`can_access_family_document`). |
| **T-6: Unlinked Profile Takeover** | A non-admin user attempts to claim or reassign an unlinked minor/HUF profile to their own login. | Updating `family_members.linked_user_id` is restricted to admins/owners or via the cryptographically signed `accept_household_invitation` flow. |
| **T-7: Audit Trail Tampering** | A rogue admin deletes or updates audit log rows to cover unauthorized configuration changes. | `household_audit_logs` has `rowsecurity = true` with zero `UPDATE` or `DELETE` policies for any role. Platform admins and household members can only `SELECT` (read-only). |

---

## 2. Helper Functions & `SECURITY DEFINER` Hardening

PostgreSQL `SECURITY DEFINER` functions execute with the privileges of the function creator. To prevent privilege escalation attacks:
1. Every `SECURITY DEFINER` function explicitly sets `search_path = public` (`proconfig = [search_path=public]`), preventing search path hijacking.
2. Helper functions are designed to be non-recursive, avoiding circular RLS evaluation deadlocks.

### Inventory of Core Access Helpers

```sql
-- 1. Household Membership & Role Check
CREATE OR REPLACE FUNCTION public.is_active_household_member(p_household_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

-- 2. Household Role Inspection
CREATE OR REPLACE FUNCTION public.get_household_role(p_household_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT household_role FROM public.household_members
  WHERE household_id = p_household_id
    AND user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

-- 3. Granular Record Access Checks (e.g. Assets, Holdings, Liabilities, Documents)
-- Evaluates visibility: 'household_shared' (any active member), 'owner_only' (profile owner or delegate),
-- or 'restricted' (owner, delegate, or explicit grantee in restricted_record_grants).
```

---

## 3. RLS Policy Inventory Across Tables

All 17 application tables in `public` schema have Row Level Security enabled (`rowsecurity = true`).

| Table Name | SELECT Policy | INSERT Policy | UPDATE Policy | DELETE Policy |
|---|---|---|---|---|
| `households` | Active members | Authenticated (new household creation) | `primary_owner` or `admin` | `primary_owner` only |
| `household_members` | Active members of same household | `primary_owner` or `admin` (or via invite RPC) | `primary_owner` (for admin changes) / Self (leave) | `primary_owner` (remove others) / Self (leave) |
| `household_invitations` | `primary_owner` or `admin` | `primary_owner` or `admin` | `primary_owner` or `admin` (revoke) | — |
| `family_members` | Active members of same household | `primary_owner` or `admin` (or self linked) | `primary_owner`, `admin`, or profile owner | `primary_owner` or `admin` (unlinked only) |
| `family_member_access` | Active members of same household | Profile owner, `primary_owner`, or `admin` | Profile owner, `primary_owner`, or `admin` | Profile owner, `primary_owner`, or `admin` |
| `assets` | `can_access_asset(...)` | Active non-viewers with profile permissions | `can_edit_asset(...)` | `can_edit_asset(...)` |
| `holdings` | `can_access_holding(...)` | Active non-viewers with profile permissions | `can_edit_holding(...)` | `can_edit_holding(...)` |
| `holding_owners` | Inherited via parent holding | Inherited via parent holding | Inherited via parent holding | Inherited via parent holding |
| `transactions` | Inherited via parent holding | Inherited via parent holding | Inherited via parent holding | Inherited via parent holding |
| `liabilities` | `can_access_liability(...)` | Active non-viewers with party permissions | `can_edit_liability(...)` | `can_edit_liability(...)` |
| `liability_parties` | Inherited via parent liability | Inherited via parent liability | Inherited via parent liability | Inherited via parent liability |
| `goals` | `can_access_goal(...)` | Active non-viewers | `can_edit_goal(...)` | `can_edit_goal(...)` |
| `family_documents` | `can_access_family_document(...)` | Active non-viewers | `can_edit_family_document(...)` | `can_edit_family_document(...)` |
| `restricted_record_grants` | Record owner or active grantee | Record owner only | Record owner only | Record owner only |
| `household_audit_logs` | `primary_owner` or `admin` | System trigger only | **None (Forbidden)** | **None (Forbidden)** |
| `storage.objects` (`family-vault`) | Linked doc access verified | Active non-viewers in path | Active non-viewers in path | Document editor only |
| `asset_classes` | Public / Authenticated read | Super-admin only | Super-admin only | Super-admin only |

---

## 4. Verification & Audit Results

1. **pgTAP Test Suite Execution**:
   - `01_rls_and_household_isolation.sql`: 26 assertions pass.
   - `02_admin_rbac_and_audit_immutability.sql`: 14 assertions pass.
   - `03_household_ownership_privacy_and_invitations.sql`: 32 assertions pass.
   - **Total: 72 assertions, 0 failures.**
2. **Schema & Privilege Verification**:
   - `anon` role granted strictly `SELECT ON public.asset_classes`. All other tables refuse anonymous access.
   - All `prosecdef = true` functions verify `search_path = public`.
   - All public tables have `rowsecurity = true`.
