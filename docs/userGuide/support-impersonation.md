# Admin Support Impersonation Mode ("View as User") Guide

## 1. Overview & Purpose

WealthNest manages sensitive personal and family financial assets, including demat equity holdings, mutual fund SIPs, bank loans, and family wealth goals across the Vaghela household (`Ketan Vaghela`, `Parul Vaghela`, `Shamalbhai Vaghela HUF`, `Ramilaben Vaghela`, `Krisha Vaghela`).

When an investor encounters an issue (such as a portfolio synchronization discrepancy or Section 112A LTCG tax calculation question), support engineers and platform administrators need the ability to inspect the user's permitted application experience **without obtaining their password, generating arbitrary JWTs, or hijacking their active authentication session**.

**Support Impersonation Mode ("View as User")** allows authorized administrators (`super_admin` or `support_admin`) to enter a temporary, bounded, strictly read-only session to view the target user's holdings, liabilities, transactions, and goals.

---

## 2. Security Architecture & Boundary Guarantees

```
┌────────────────────────────────────────────────────────┐
│  Platform Administrator (e.g. Ketan Vaghela)          │
│  Authenticated JWT: auth.uid() = admin_id              │
│  Role: super_admin / support_admin                     │
└──────────────────────────┬─────────────────────────────┘
                           │
             1. Requests "View as User"
                with mandatory ticket reason (>= 8 chars)
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  Server-Side Database Security-Definer RPC             │
│  admin_start_support_session(target_id, reason)        │
│  - Verifies admin role & prevents self-impersonation   │
│  - Issues ephemeral session (15-min TTL) in DB        │
│  - Writes immutable entry to public.admin_audit_logs   │
└──────────────────────────┬─────────────────────────────┘
                           │
             2. Delivers ephemeral session_id
                (Admin maintains OWN JWT, NO credentials swapped)
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  Active Support Session in Browser                     │
│  - Persistent sticky top banner with countdown timer   │
│  - Mutation buttons (Add Holding, Import CAS, Delete)  │
│    are strictly disabled                               │
│  - Reads target user data via support_get_user_* RPCs  │
│    validating active session & expiry                  │
└──────────────────────────┬─────────────────────────────┘
                           │
             3. Session Termination
                - Manual click: "Exit View as User"      │
                - Automatic expiration after 15 minutes  │
                - Immediate server-side revocation       │
```

### Key Security Invariants
1. **Zero Credential Swapping**: The administrator remains authenticated as themselves throughout the entire session (`auth.uid() = admin_id`). The target user's password or tokens are never touched.
2. **Untouched Row Level Security (RLS)**: Private financial tables (`holdings`, `transactions`, `liabilities`, `goals`) continue enforcing strict `auth.uid() = user_id` policies. Direct table queries by the administrator continue to be rejected by PostgreSQL RLS.
3. **Dedicated Read-Only RPCs**: Data access for the target user is granted exclusively through server-side stored procedures (`support_get_user_summary`, `support_get_user_portfolio`, etc.) that validate that:
   - The caller is an authorized administrator.
   - The provided `session_id` is currently in `status = 'active'`.
   - The session has not exceeded its 15-minute expiration timestamp (`expires_at > now()`).
4. **Zero Mutation RPCs**: No update, insert, or delete RPCs exist for support sessions. All state changes are impossible while in support mode.
5. **No Self-Impersonation**: An administrator cannot initiate a support session targeting their own account (`admin_id === target_user_id`).
6. **Immutable Audit Ledger**: Starting, ending, or denying a support session is logged synchronously to `public.admin_audit_logs` with timestamps, administrator details, and IP addresses.

---

## 3. Step-by-Step Usage Guide

### Step 1: Navigate to the User Profile
1. Log in to WealthNest with administrator privileges.
2. Navigate to **Platform Administration** (`/admin/users`).
3. Select the user you wish to troubleshoot (e.g., `Shamalbhai Vaghela HUF`).
4. On the user detail page (`/admin/users/:userId`), locate the action buttons in the profile card.

### Step 2: Initiate "View Application as User"
1. Click the **View Application as User** button (with the eye icon).
2. The **Support View as User** modal will appear:
   - Verify the target account information (`Shamalbhai Vaghela HUF`).
   - Note the 15-minute session TTL.
   - Read the security and audit isolation notice.
3. In the **Support Reason / Ticket ID** field, enter a documented justification of at least 8 characters (e.g., `Investigating Section 112A LTCG tax shield report discrepancy (Ticket #402)`).
4. Click **Start Support Session**.

### Step 3: Inspecting User Data with High-Visibility Banner
Upon session activation:
- The browser transitions into **Support Impersonation Mode**.
- A prominent sticky banner appears at the very top of the window displaying:
  - **Support Impersonation Mode** badge.
  - Target user information: `Viewing as Shamalbhai Vaghela HUF (shamalbhai.huf@wealthnest.local)`.
  - Security indicator: `Read-Only • Direct Mutations Disabled`.
  - Countdown timer: `14:58` (counts down second-by-second).
  - Quick action buttons: **View Portfolio** and **Exit View as User**.
- The investor portfolio displays the target user's holdings, current values, and unrealized gains.
- All mutation buttons (**Add Holding**, **Import CAS**, row deletions) are visibly disabled to maintain read-only data integrity.

### Step 4: Expiration Warning & Session Termination
- **Expiring Soon Warning**: When 2 minutes remain on the session countdown (`<= 120s`), the top banner shifts to an amber/rose pulsing state to notify the administrator.
- **Manual Early Exit**: Click the **Exit View as User** button on the banner at any time. The session is immediately revoked on the server, local session storage is purged, and the administrator returns to the administrative directory.
- **Automatic Expiration**: If the 15-minute TTL expires, the session is invalidated immediately on PostgreSQL. Subsequent RPC attempts fail, and the UI resets automatically.
