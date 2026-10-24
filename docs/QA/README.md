# WealthNest Quality Assurance (QA) Documentation

This directory contains formal, executable Quality Assurance (QA) test suites, verification protocols, and regression test cases for WealthNest.

---

## 📑 Test Suite Index

| Document | Scope & Phase | Description | Status |
| :--- | :--- | :--- | :---: |
| [Phase 1: Database & Auth Verification](./phase-1-database-auth-verification.md) | Phase 1 | Database schema migrations, Supabase Studio visual GUI, user registration trigger, email verification, and Row-Level Security (RLS) multi-tenant isolation. | ✅ Verified |
| [Phase 1.1: System & Account Settings](./phase-1-1-settings-preferences-verification.md) | Phase 1.1 | User profile management, India-First currency/FY/tax localization rules, offline JSON backups, CSV spreadsheet exports, and system diagnostics. | ✅ Verified |
| [Phase 2: Portfolio & India-First Verification](./phase-2-portfolio-india-first-verification.md) | Phase 2 | India-First architecture (`₹ INR`, Lakh/Crore formatting, Indian financial instruments), pure domain valuation engine, asset class distribution, and holdings management. | ✅ Verified |
| [Phase 2.1: Automated Investment Import Engine](./phase-2-1-cas-import-verification.md) | Phase 2.1 | In-memory NSDL & CDSL CAS PDF parser, password decryption, ISIN recognition, idempotent PostgreSQL upsert, and import batch audit ledger. | ✅ Verified |
| [Phase 3: Transactions & Cashflow Verification](./phase-3-transactions-cashflow-verification.md) | Phase 3 | Cashflow audit ledger, capital inflows/outflows, trade logging, dividend payouts, STT/charges, and real-time net cashflow calculations. | ✅ Verified |
| [Phase 3.1: Loans & Liabilities Verification](./phase-3-1-liabilities-verification.md) | Phase 3.1 | Mortgages, EMI commitments, collateral linking, Loan-To-Value (LTV) ratios, and true Net Worth reconciliation. | ✅ Verified |
| [Phase 4: Performance & Wealth Analytics](./phase-4-performance-analytics-verification.md) | Phase 4 | Institutional return mathematics (XIRR, CAGR), benchmark comparisons (Nifty 50 TRI, Sensex, SGB, SBI FD), asset allocation drift, and rebalancing recommendations. | ✅ Verified |
| [Phase 5: Financial Goals & Milestones](./phase-5-goals-milestones-verification.md) | Phase 5 | Inflation-adjusted target corpus math, required monthly SIP calculations, emergency fund runway buffer analyzer, and milestone tracking. | ✅ Verified |
| [Phase 5.1: Market Feeds, Budget 2024 Tax & Trade Sync](./phase-5-market-tax-and-trade-sync-verification.md) | Phase 5.1 | AMFI Daily NAV feed ingestion, ISIN matching, Budget 2024 equity LTCG/STCG calculation, Section 112A exemption, Tax-Loss Harvesting, and trade inventory synchronization. | ✅ Verified |
| [Phase 5.2: Automated Live Stock CMP Feed (NSE/BSE)](./phase-5-2-live-stock-cmp-verification.md) | Phase 5.2 | Real-time NSE/BSE stock quotes, Indian Standard Time (IST) trading hours state machine, auto-polling toggle, BigInt integer paise conversion, and dual equity/MF synchronization. | ✅ Verified |
| [Phase 6A: Multi-Demat & Family Portfolios](./phase-6-1-family-portfolios-verification.md) | Phase 6A | Legal entities (Self, Spouse, HUF, Child, Parent), multi-broker accounts (Zerodha, Groww, ICICI Direct), HUF Section 112A tax shield, goal beneficiaries, joint loan liabilities, and cross-module scoping. | ✅ Verified |
| [Phase 6.2: Broker CSV Importers (Zerodha & Groww)](./phase-6-2-broker-csv-import-verification.md) | Phase 6.2 | Direct statement importers for Zerodha Kite Holdings & Console Tradebooks, Groww Holdings & Orders CSV exports, Zero Float drift paise parsing, and family assignment. | ✅ Verified |
| [Phase 7: Admin Portal, User Management & Security](./phase-7-admin-portal-verification.md) | Phase 7 | Centralized user directory, platform-level RBAC (super_admin, support_admin, auditor), lifecycle management, append-only immutable audit trail, and zero-knowledge financial isolation boundary. | ✅ Verified |


---

## 🌐 QA Environment & Service Matrix

Before executing manual or automated test cases, ensure all local containers are healthy:

| Service | Target URL / Port | Credentials / Protocol | Role |
| :--- | :--- | :--- | :--- |
| **Web Application** | [http://wealthnest.local](http://wealthnest.local)<br>*(or [http://localhost](http://localhost))* | Port `80` (Nginx Proxy) | Primary user interface & testing target |
| **Supabase Studio** | [http://localhost:54323](http://localhost:54323) | Free visual GUI *(phpMyAdmin alternative)* | PostgreSQL table inspector (`profiles`, `family_members`, `portfolio_accounts`, `holdings`, `goals`, `liabilities`, `transactions`) |
| **PostgreSQL Port** | `127.0.0.1:54322` | **User**: `postgres`<br>**Pass**: `postgres` | Direct database connection (DBeaver / TablePlus) |
| **Inbucket (Email)** | [http://localhost:54324](http://localhost:54324) | Web inbox | Mock confirmation & magic link emails |
| **Kong API Gateway** | [http://localhost:54321](http://localhost:54321) | REST / Auth API | Backend authentication and database queries |

---

## ⚡ Automated Verification Commands

Run these automated verification commands in your terminal to ensure zero regressions across the Clean Architecture monorepo:

```bash
# 1. Type-check across all workspaces (@wealthnest/domain, application, shared, web)
./node_modules/.bin/tsc -b

# 2. Run all unit & integration test suites (220 test cases across 43 test files)
node node_modules/vitest/vitest.mjs run


# 3. Production bundle compilation verification
npm run build
```

---

## 👤 Recommended QA Test Personas

| Persona | Entity / Details | Holdings & Coverage | Purpose |
| :--- | :--- | :--- | :--- |
| **Demo Visitor** | *(Unauthenticated)* | 8 Pre-seeded Indian Assets | Test in-memory domain math, filters, auto-poll, and modals without database login |
| **Vaghela Family Household** | `Ketan Vaghela` (Self, Freelance Contractor)<br>`Parul Vaghela` (Spouse, Bank Clerk)<br>`Krisha Vaghela` (Daughter, 1st Std)<br>`Shamalbhai Vaghela HUF` (Karta / Father)<br>`Ramilaben Vaghela` (Mother) | Direct Equities (Reliance, TCS), MFs (Parag Parikh, Bandhan), SGBs, PPF, Senior Citizen FDs | Full multi-entity family portfolio, Section 112A tax shield, goal beneficiaries, joint loans |
