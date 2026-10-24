# WealthNest User Guide: Platform Admin Portal & Access Control

## Overview

The **WealthNest Platform Admin Portal** is an administrative console built for system administrators, customer support representatives, and compliance auditors. It provides centralized user lifecycle management, platform-level Role-Based Access Control (RBAC), multi-user household oversight, and an immutable forensic audit log.

---

## 1. Core Architectural Principle: Zero-Knowledge Financial Isolation

> [!IMPORTANT]
> **Tenant Isolation Boundary**: Platform administrators possess elevated rights to manage identity, lifecycle states, and platform access, but are **cryptographically barred by PostgreSQL Row Level Security (RLS)** from viewing personal financial records.

Platform administrators **CANNOT** view, query, or export:
- Private investment holdings (stocks, mutual funds, Sovereign Gold Bonds).
- Bank balances and cash accounts.
- Loan liabilities and repayment schedules.
- Personal financial goals and milestone allocations.
- Real-time net worth valuations or portfolio returns.

Administrative capabilities are strictly scoped to identity metadata, account lifecycle states, household seat quotas, and platform audit records.

---

## 2. Platform Role-Based Access Control (RBAC)

Platform roles are independent of household/family roles and govern platform operations:

| Role | Permissions & Authority | Prohibited Actions |
| :--- | :--- | :--- |
| **`super_admin`** | Full platform governance, role delegation (grant/revoke platform roles), user lifecycle management (suspend, reactivate, offboard), password reset triggers, audit trail explorer. | Viewing private financial portfolios. Suspending own account. Revoking the last active super_admin. |
| **`support_admin`** | User lifecycle management (suspend, reactivate), issuing onboarding invitations, triggering password reset emails, tenant metadata overview. | Assigning or revoking platform roles. Modifying audit logs. |
| **`auditor`** | Read-only inspection of the append-only audit trail and forensic telemetry. System diagnostics and compliance monitoring. | Modifying any user status, inviting users, granting roles, or modifying audit records. |

### Protected Administrative Invariants
1. **Self-Suspension Prohibited**: An administrator cannot suspend or deactivate their own active account, preventing accidental platform lockout.
2. **Last Super-Admin Protection**: The system enforces that there must always be at least one active `super_admin`. Revoking the role from the sole remaining super administrator is rejected by domain and database constraints.
3. **Mandatory Reason Codes**: Suspending or deactivating any user account mandates selecting a valid reason code (e.g. `SUSPICIOUS_LOGIN_ATTEMPTS`, `POLICY_VIOLATION`, `FRAUD_PREVENTION`) which is recorded into the immutable audit trail.

---

## 3. Navigating the Admin Portal

When logged in with an administrative entitlement (`super_admin`, `support_admin`, or `auditor`), a discreet **"Admin Portal"** shortcut appears in the primary navigation sidebar.

### Sections & Features

### 3.1 Overview Dashboard (`/admin`)
- **System Telemetry Cards**: Real-time counts of Total Users, Active Accounts, Suspended Accounts, Pending Invitations, Household Tenants, and Total Audit Events.
- **Tenant Isolation Notice**: Confirms active RLS protection and zero-knowledge perimeter.
- **Recent Administrative Events Feed**: Live stream of administrative actions with timestamp, actor, target, and outcome.

### 3.2 User Directory & Lifecycle Management (`/admin/users`)
- **Search & Filter**: Search by name or email; filter by lifecycle status (`active`, `suspended`, `invited`, `deactivated`) and platform role.
- **Invite Investor**: Issue an email onboarding invitation with optional platform role delegation.
- **Account Suspension / Reactivation**: Click the suspension action icon to open the lifecycle modal. Select a new status, specify a mandatory reason code, and append optional contextual notes.
- **Administrative Password Reset**: Trigger an automated, secure recovery email directly to the investor's verified email.

### 3.3 User Detail View (`/admin/users/:userId`)
- Detailed overview of registration date, last sign-in timestamp, and user UUID.
- Household membership list displaying household name, seat role (`primary_owner`, `member`), and joined date.
- Explicit confidentiality perimeter reminder.
- Direct role delegation interface (available to `super_admin`).
- User-specific administrative audit history.

### 3.4 Multi-User Household Tenants (`/admin/households`)
- Overview of registered household collectives (e.g., `Vaghela Household`).
- Metadata oversight: Primary Owner, member counts, creation date.
- Financial isolation guarantee reminder.

### 3.5 Staff Entitlements & Platform Roles (`/admin/roles`)
- RBAC capability matrix detailing rights per role.
- Active staff directory displaying assigned roles and entitlements.
- Delegation form for Super Admins to promote or demote staff members.

### 3.6 Immutable Audit Trail Explorer (`/admin/audit-logs`)
- Filterable log of all actions (`USER_STATUS_CHANGE`, `PASSWORD_RESET_REQUESTED`, `ROLE_GRANTED`, `ROLE_REVOKED`, `USER_INVITED`, `SYSTEM_BOOTSTRAP`).
- Outcome tracking (`success`, `denied`, `failure`).
- **Interactive Payload Viewer**: Click **"Payload"** on any entry to inspect sanitized metadata JSON (passwords, tokens, PAN, and credentials are automatically stripped prior to logging).

### 3.7 Platform Security Policies (`/admin/settings`)
- Configuration of administrative MFA enforcement, session timeout durations, and minimum password lengths.
- System integrity diagnostics confirming PostgreSQL 15 connection, Integer Paise BigInt zero-drift engine, and `en-IN` currency formatting.

### 3.8 Support Impersonation Mode ("View as User")
- Troubleshoot user issues without obtaining user passwords or hijacking sessions.
- Initiate via the **View Application as User** button on any user's profile (`/admin/users/:userId`).
- Requires a mandatory ticket reason (minimum 8 characters).
- Enforces an ephemeral 15-minute TTL countdown timer with an ambient top banner.
- All private financial queries are server-validated read-only RPCs (`support_get_user_*`).
- For complete details, see [Support Impersonation Mode Guide](./support-impersonation.md).

---

## 4. Bootstrapping the First Administrator

In a fresh deployment, initialize the first platform administrator using the automated CLI script:

```bash
./scripts/bootstrap-admin.sh investor@wealthnest.local
```

The script:
1. Verifies the user exists in `auth.users`.
2. Sets `user_access_status` to `active`.
3. Grants `super_admin` in `public.platform_admin_roles`.
4. Creates the default `Vaghela Household` tenant.
5. Records the initial `BOOTSTRAP_ADMIN_GRANTED` event in `public.admin_audit_logs`.
