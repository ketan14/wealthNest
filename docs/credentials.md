# WealthNest: Default Credentials & Authentication Reference

This document outlines the default user accounts, administrative credentials, local database credentials, and service URLs for the WealthNest platform.

---

## 🔐 1. Default Application Accounts

| Account Type | Email Address | Default Password | Role | Primary Use |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Investor (Self)** | `investor@wealthnest.local` | `WealthNest@2026` | `super_admin` | Full personal portfolio, Vaghela Family household, Section 112A tax shield, Demat accounts, and Admin Portal access. |
| **Platform Administrator** | `admin@wealthnest.local` | `WealthNest@2026` | `super_admin` | Platform governance at `/admin`, user lifecycle management, audit logs, and Support Impersonation Mode. |
| **Demo / Guest Access** | *(None required)* | *(None required)* | `guest` | Instant local evaluation pre-seeded with 8 Indian assets (equities, mutual funds, SGBs) without database login. |

> [!TIP]
> Both `investor@wealthnest.local` and `admin@wealthnest.local` have **`super_admin`** permissions, allowing access to both the primary investor dashboards (`/portfolio`, `/analytics`, `/goals`, `/liabilities`) and the administrative portal (`/admin`).

---

## 🛠️ 2. How to Reset or Create New Admin Accounts

To reset the password for any existing account or bootstrap a new administrator, execute the bootstrap script from the project root:

```bash
# Syntax: ./scripts/bootstrap-admin.sh <email> <password> <role> <full_name>
./scripts/bootstrap-admin.sh investor@wealthnest.local WealthNest@2026 super_admin "Ketan Vaghela"
./scripts/bootstrap-admin.sh admin@wealthnest.local WealthNest@2026 super_admin "Platform Admin"
```

Available administrative roles:
* `super_admin`: Full system control, user management, audit logs, and Support Impersonation.
* `support_admin`: User lifecycle management, invite links, and password resets.
* `auditor`: Read-only forensic review of append-only audit trail.

---

## 🌐 3. Local Infrastructure & Service Credentials

| Service | Target URL / Host | Port | Credentials | Purpose |
| :--- | :--- | :---: | :--- | :--- |
| **Web App (Nginx Proxy)** | [http://localhost:30000](http://localhost:30000) | `30000` | Application accounts above | Primary web access |
| **Web App (Vite Dev)** | [http://localhost:5174](http://localhost:5174) | `5174` | Application accounts above | Direct Vite development server |
| **Supabase Studio GUI** | [http://localhost:54323](http://localhost:54323) | `54323` | *(No password)* | Visual PostgreSQL table & auth browser |
| **PostgreSQL Database** | `127.0.0.1` | `54322` | **User**: `postgres`<br>**Password**: `postgres`<br>**DB**: `postgres` | Direct connection (DBeaver, TablePlus, psql) |
| **Inbucket (Email Mock)** | [http://localhost:54324](http://localhost:54324) | `54324` | *(No password)* | Intercepts sign-up confirmation emails & password reset links |
| **Kong API Gateway** | `http://127.0.0.1:54321` | `54321` | Anon key in `.env` | Supabase REST and Auth endpoints |

---

## 📬 4. Testing Password Recovery & Email Verification

When registering new accounts or requesting password resets via the `/login` **"Forgot Password?"** link:
1. Emails are not sent to the internet; they are routed to the local **Inbucket** mail server.
2. Open [http://localhost:54324](http://localhost:54324) in your browser.
3. Locate the incoming email addressed to your user and click the confirmation or password recovery link.
