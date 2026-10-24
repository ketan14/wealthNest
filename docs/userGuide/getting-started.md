# Chapter 1: Getting Started with WealthNest

WealthNest is designed to give Indian families institutional-grade control over their personal wealth without compromising data privacy.

---

## 🚀 Running WealthNest Locally

WealthNest runs as a self-hosted or locally-contained application stack with Docker Compose and Vite:

| Service | Local URL | Description |
| :--- | :--- | :--- |
| **Web Application** | [http://wealthnest.local](http://wealthnest.local) *(or [http://localhost:30000](http://localhost:30000))* | Primary dashboard & user interface |
| **Direct Vite Dev** | [http://localhost:5174](http://localhost:5174) *(or `5173`)* | Direct frontend development server |
| **Supabase Studio GUI** | [http://localhost:54323](http://localhost:54323) | Visual database table browser and query editor |
| **Inbucket Email Box** | [http://localhost:54324](http://localhost:54324) | Local mock mailbox for email verification & magic links |
| **PostgreSQL Database** | `127.0.0.1:54322` | Dedicated PostgreSQL database (`postgres`/`postgres`) |

---

## 👤 Interactive Demo Mode vs Registered User

WealthNest offers two operating modes:

### 1. Interactive Demo Mode (Instant Evaluation)
* When you open WealthNest without logging in, the app operates in **Interactive Demo Mode**.
* It pre-populates a realistic Indian household portfolio (the **Vaghela Family** portfolio) featuring:
  * **Direct Equities**: Reliance Industries Ltd, Tata Consultancy Services (TCS).
  * **Mutual Funds**: Parag Parikh Flexi Cap Direct Growth, Bandhan Large & Mid Cap Direct Growth.
  * **Gold & Fixed Income**: Sovereign Gold Bond (SGB) 2028, Public Provident Fund (PPF), Senior Citizen FDs.
  * **Loans & Liabilities**: SBI Green Home Loan, HDFC EV Auto Loan.
  * **Financial Goals**: Krisha's Higher Education, Ketan & Parul FIRE, Parents' Pilgrimage & Health Buffer.
* You can add, delete, import CAS statements, toggle live auto-polling, and experiment with the reverse SIP calculator entirely in browser memory.

### 2. Registered Account Mode (Persistent Database Storage)
* When you create an account or sign in with your email:
  * WealthNest activates PostgreSQL **Row-Level Security (RLS)**.
  * All holdings, transactions, family members, accounts, goals, and liabilities are stored in your private database schema.
  * No one else on the network or machine can read your data.

---

## 🧭 Navigating the WealthNest Interface

The left navigation sidebar provides one-click access to all wealth management modules:

* 📊 **Portfolio (`/portfolio`)**: Consolidated view of all holdings across Direct Equities, Mutual Funds, Gold, and Fixed Income. Features live NSE/BSE stock CMP feeds and daily AMFI NAV updates.
* 📈 **Analytics (`/analytics`)**: Institutional performance engine computing exact Newton-Raphson XIRR, CAGR, benchmark alpha against Nifty 50 TRI, and Union Budget 2024 capital gains tax liabilities.
* 💸 **Transactions (`/transactions`)**: Comprehensive audit ledger of all trades, buy/sell executions, dividend credits, and capital inflows/outflows tagged by family member and broker.
* 🎯 **Goals (`/goals`)**: Milestone tracker computing inflation-adjusted corpus requirements and required monthly SIP amounts linked to specific family beneficiaries.
* 💳 **Liabilities (`/liabilities`)**: Debt tracking dashboard calculating total household EMI outflow, collateralized Loan-To-Value (LTV) ratios, and reconciled True Net Worth.
* ⚙️ **Settings (`/settings`)**: Profile settings, Family Entities & Connected Demats management, full offline JSON/CSV backup exports, and system health checks.

---

## 🔒 Privacy & Client-Side Processing Architecture

> [!IMPORTANT]
> **Your financial statements never leave your computer.**
> When you import Consolidated Account Statements (CAS) from CDSL or NSDL:
> 1. The password-protected PDF is decrypted entirely in your local browser memory using WebAssembly/JavaScript.
> 2. No third-party servers, cloud analytics, or external AI services receive your PAN, folio numbers, or trade history.
> 3. Even market quote feeds are fetched directly or proxied through your local instance.
