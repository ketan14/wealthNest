# Household Permission Matrix

This reference document defines the complete access control and authorization matrix for WealthNest's multi-user household architecture. It establishes how **Household Governance Roles**, **Managed Profile Types**, **Visibility Scopes**, and **Explicit Delegations** govern read, write, and administrative capabilities across every entity in the system.

Related architectural baseline: [household-ownership-and-access-model.md](file:///home/ketan/projects/Krisha/wealthNest/docs/architecture/household-ownership-and-access-model.md).

---

## 1. Household Roles & Personas

WealthNest decouples **Identity & Governance** (`household_members`) from **Financial Attribution** (`family_members`). A single user account (`auth.users`) may belong to multiple households, holding distinct roles in each.

### 1.1 Governance Roles (`household_members.household_role`)

| Role | Cardinality | Primary Responsibilities | Scope Restrictions |
|---|---|---|---|
| **`primary_owner`** | **Exactly 1** active per household (enforced by partial unique index `(household_id) WHERE household_role = 'primary_owner' AND status = 'active'`) | Full administrative governance: household renaming/deletion, billing, inviting and offboarding members, appointing/demoting admins, transferring primary ownership, creating/managing household-shared assets, liabilities, and documents. | **Cannot** view or edit `owner_only` or `restricted` records of other linked members unless explicitly granted. Cannot bypass RLS privacy boundaries. |
| **`admin`** | 0 or more per household | Day-to-day household operations: inviting new members, managing unlinked family member profiles (minors, HUFs, unlinked elders), viewing and creating household-shared financial records, uploading family documents. | **Cannot** appoint/demote other admins, cannot transfer primary ownership, cannot delete the household, and **cannot** view `owner_only` or `restricted` financial records or documents belonging to other linked members. |
| **`member`** | 0 or more per household | Standard participating adult: manages their own linked profile, creates/manages personal financial records (`owner_only`, `restricted`, or `household_shared`), participates in joint holdings/liabilities, uploads private/shared documents, and delegates granular access to their profile. | **Cannot** access other members' `owner_only` or `restricted` records, cannot manage unlinked member profiles unless explicitly granted via `family_member_access`, cannot invite members or alter household governance settings. |
| **`viewer`** | 0 or more per household | Read-only auditor/family member: inspects household-shared net worth, asset allocations, goals, and shared family documents. | **Strictly read-only**: Cannot insert, update, or delete any financial records, liabilities, goals, documents, or household settings. Can only view records with `visibility = 'household_shared'`. |

### 1.2 Managed Profile Personas (`family_members`)

Every financial record links to one or more `family_members` rows:

1. **Linked Adult Member** (`linked_user_id IS NOT NULL`):
   - Backed by an authenticated `auth.users` account.
   - Manages their own records; has autonomy over their visibility and access delegation.
2. **Unlinked Managed Profile** (`linked_user_id剪IS NULL`):
   - Represents a minor, an elderly family member without login credentials, or a non-individual financial vehicle (such as a Hindu Undivided Family / HUF or family trust).
   - Created and managed by household admins/owners, or by the specific member who created them (`created_by`).
   - May later be claimed by inviting an email and accepting via `accept_household_invitation(token)`.

---

## 2. Record Visibility Scopes

Every financial entity (`assets`, `holdings`, `liabilities`, `goals`, `family_documents`) enforces a `visibility` column:

```sql
visibility text NOT NULL DEFAULT 'household_shared' 
CHECK (visibility IN ('household_shared', 'owner_only', 'restricted'))
```

1. **`household_shared`**:
   - **Audience:** All active members of the household (`primary_owner`, `admin`, `member`, `viewer`).
   - **Purpose:** Collective family assets (e.g., family primary residence, joint bank accounts, common education funds, shared emergency funds).
2. **`owner_only`**:
   - **Audience:** The financial owner(s) only. For linked members, this is strictly the user matching `family_members.linked_user_id`. For unlinked profiles, this is the profile creator and household admins.
   - **Hidden From:** Household `primary_owner` and `admin` if owned by a *different* linked member. Household `viewer` has zero access.
   - **Purpose:** Personal discretionary portfolios, individual EPF/PPF accounts, private bank balances, personal credit cards.
3. **`restricted`**:
   - **Audience:** The record owner(s) **plus** specific users explicitly granted read/write access via `restricted_record_grants`.
   - **Purpose:** Private records shared with a spouse or trusted sibling, but hidden from parents, children, or other household members.

---

## 3. Delegation Mechanisms

WealthNest provides two levels of explicit access delegation:

### 3.1 Profile Delegation (`family_member_access`)
Grants another household member permissions over an entire `family_members` profile:
- **`view`**: Grantee can view all `household_shared` and `owner_only` records owned by this profile.
- **`manage`**: Grantee can view, create, edit, and delete financial records and documents on behalf of this profile.

### 3.2 Granular Record Delegation (`restricted_record_grants`)
Grants a specific household member access to an individual `restricted` record:
- Table: `restricted_record_grants(household_id, record_type, record_id, grantee_user_id, can_edit)`
- Allows surgical sharing of an individual asset, liability, goal, or document without exposing the member's other private records.

---

## 4. Entity CRUD Matrix by Governance Role & Visibility

The following table details the maximum permission permitted by RLS for each entity type based on household governance role and record visibility.

> **Legend:**
> - **C**: Create / Insert
> - **R**: Read / Select
> - **U**: Update
> - **D**: Delete
> - **—**: No Access (enforced by RLS)
> - **(own)**: Allowed only if the user is the owner/creator or has been granted explicit profile management.
> - **(grant)**: Allowed if explicitly granted in `family_member_access` or `restricted_record_grants`.

| Entity | Visibility Scope | `primary_owner` | `admin` | `member` | `viewer` |
|---|---|:---:|:---:|:---:|:---:|
| **`households`** | N/A | **CRUD** | **R** (Update name/settings only) | **R** | **R** |
| **`household_members`** | N/A | **CRUD** (Appoint admins, transfer owner) | **CR** (Invite/remove members/viewers) | **R** (Self leave) | **R** (Self leave) |
| **`household_invitations`** | N/A | **CRUD** | **CRUD** | — | — |
| **`family_members` (linked)** | N/A | **R** | **R** | **RU** (own profile) | **R** |
| **`family_members` (unlinked)** | N/A | **CRUD** | **CRUD** | **CRUD** (if creator/delegate) | **R** |
| **`family_member_access`** | N/A | **CRUD** (for unlinked profiles) | **CRUD** (for unlinked profiles) | **CRUD** (for own profile) | — |
| **`assets`** | `household_shared` | **CRUD** | **CRUD** | **CRUD** | **R** |
| | `owner_only` | **CRUD** (own) / — (others) | **CRUD** (own) / — (others) | **CRUD** (own) / — (others) | — |
| | `restricted` | **CRUD** (own) / **R[U]** (grant) | **CRUD** (own) / **R[U]** (grant) | **CRUD** (own) / **R[U]** (grant) | — |
| **`holdings` & `holding_owners`** | `household_shared` | **CRUD** | **CRUD** | **CRUD** | **R** |
| | `owner_only` | **CRUD** (own) / — (others) | **CRUD** (own) / — (others) | **CRUD** (own) / — (others) | — |
| | `restricted` | **CRUD** (own) / **R[U]** (grant) | **CRUD** (own) / **R[U]** (grant) | **CRUD** (own) / **R[U]** (grant) | — |
| **`transactions`** | Inherited from holding | Matches holding | Matches holding | Matches holding | Matches holding |
| **`liabilities` & `parties`** | `household_shared` | **CRUD** | **CRUD** | **CRUD** | **R** |
| | `owner_only` | **CRUD** (own) / — (others) | **CRUD** (own) / — (others) | **CRUD** (own) / — (others) | — |
| | `restricted` | **CRUD** (own) / **R[U]** (grant) | **CRUD** (own) / **R[U]** (grant) | **CRUD** (own) / **R[U]** (grant) | — |
| **`goals`** | `household_shared` | **CRUD** | **CRUD** | **CRUD** | **R** |
| | `owner_only` | **CRUD** (own) / — (others) | **CRUD** (own) / — (others) | **CRUD** (own) / — (others) | — |
| | `restricted` | **CRUD** (own) / **R[U]** (grant) | **CRUD** (own) / **R[U]** (grant) | **CRUD** (own) / **R[U]** (grant) | — |
| **`family_documents`** | `household_shared` | **CRUD** | **CRUD** | **CRUD** | **R** |
| | `owner_only` | **CRUD** (own) / — (others) | **CRUD** (own) / — (others) | **CRUD** (own) / — (others) | — |
| | `restricted` | **CRUD** (own) / **R[U]** (grant) | **CRUD** (own) / **R[U]** (grant) | **CRUD** (own) / **R[U]** (grant) | — |
| **`storage.objects` (`family-vault`)** | Matches doc metadata | Matches doc metadata | Matches doc metadata | Matches doc metadata | Matches doc metadata |
| **`restricted_record_grants`** | N/A | **CRUD** (if record owner) | **CRUD** (if record owner) | **CRUD** (if record owner) | — |
| **`household_audit_logs`** | N/A | **R** (Append via trigger only) | **R** (Append via trigger only) | — | — |

---

## 5. Joint Ownership & Multi-Party Allocations

For joint assets (`holding_owners`) and multi-borrower liabilities (`liability_parties`):
1. **Holding Co-Owners**:
   - Multiple `family_members` may share ownership percentages (`ownership_share numeric(5,2)`).
   - Deferrable constraint triggers ensure the sum of `ownership_share` across all co-owners equals exactly `100.00%`.
   - Any co-owner who is an active linked member has read access to the holding. Edit access requires editor status on the parent holding.
2. **Liability Co-Borrowers & Guarantors**:
   - Co-borrowers divide `liability_share numeric(5,2)` totaling `100.00%`. Guarantors hold `party_role = 'guarantor'` with `liability_share = 0.00%`.
   - All co-borrowers and guarantors have visibility into the liability record.
3. **Net Worth & Section 112A Tax Roll-up**:
   - When aggregated at the household level, `allocatePaiseByShares` ensures deterministic `BigInt` distribution down to the exact paisa with zero rounding drift.
   - Private (`owner_only`) holdings are excluded from household totals when viewed by non-owners, ensuring zero data leakage in charts, metrics, or summaries.

---

## 6. Audit Immutability & Administrative Boundary

1. **Immutability of Audit Trails**:
   - `household_audit_logs` has no `UPDATE` or `DELETE` policies for any authenticated user, including `primary_owner`.
   - System triggers insert immutable change records for sensitive security events: role assignments, ownership transfers, invitation dispatches, and member removals.
2. **Platform Support Boundary**:
   - Platform super-admins (`platform_admin_roles`) do not have automatic SELECT access on user financial tables.
   - Support sessions require explicit just-in-time impersonation or time-bounded support grants logged to `admin_audit_logs`.
