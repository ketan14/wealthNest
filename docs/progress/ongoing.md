# WealthNest: Ongoing Progress & Implementation Status

**System:** WealthNest — Institutional-Grade Personal Wealth & Asset Operating System  
**Architecture:** Modular Monolith Clean Architecture (`apps/web`, `packages/application`, `packages/domain`, `packages/shared`)  
**Locale & Standards:** India-First Architecture (`₹ INR`, Lakhs/Crores `en-IN`, NSE/BSE, AMFI Mutual Funds, SGBs, PPF/EPF, Union Budget 2024 Section 112A)  
**Last Updated:** October 2026  
**Primary Tracker:** `docs/progress/ongoing.md`

---

## 📌 Executive Status Matrix

| Milestone / Phase | Scope & Modules | Status | QA Test Suite | Notes |
| :--- | :--- | :---: | :---: | :--- |
| **Phase 0: Scaffold & Infra** | Monorepo npm workspaces, strict TS references, Docker Compose dev/prod, Nginx reverse proxy | ✅ Complete | ✅ Verified | Port `30000` via Nginx, Port `5174` direct Vite. |
| **Phase 1: Database & Auth** | Supabase PostgreSQL, RLS multi-tenant policies, auth trigger, Inbucket email mock | ✅ Complete | ✅ Verified | Clean separation of profiles and system auth users. |
| **Phase 1.1: Settings & Export** | User profile, Lakh/Crore vs Million toggle, full JSON/CSV portfolio backup & restore | ✅ Complete | ✅ Verified | Dedicated `/settings` page with system health checks. |
| **Phase 2: Portfolio & Valuation** | India-First Lakh/Crore (`₹ L / Cr`) formatting, asset class allocation, pure domain valuation | ✅ Complete | ✅ Verified | Zero floating-point drift with integer paise. |
| **Phase 2.1: CAS Import Engine** | Client-side in-memory NSDL/CDSL CAS PDF extraction, password decryption (PAN+DOB), ISIN matching | ✅ Complete | ✅ Verified | Client-side parsing ensures total privacy. |
| **Phase 3: Transactions & Cashflow** | Chronological audit ledger, trade-holding sync with weighted average cost & realized gains | ✅ Complete | ✅ Verified | Inflow/outflow tracking, capital gains tags. |
| **Phase 3.1: Loans & Liabilities** | Mortgages, EMIs, collateral linking, LTV ratios, and true Net Worth reconciliation | ✅ Complete | ✅ Verified | Complete `/liabilities` dashboard with debt KPIs. |
| **Phase 4: Performance Analytics** | Newton-Raphson XIRR solver, CAGR, SVG trajectory chart, Nifty 50 TRI alpha, rebalance radar | ✅ Complete | ✅ Verified | Full `/analytics` dashboard with Indian benchmarks. |
| **Phase 5: Financial Goals** | Inflation-adjusted target corpus math, reverse SIP calculator, emergency fund runway buffer | ✅ Complete | ✅ Verified | Complete `/goals` dashboard with milestone cards. |
| **Phase 5.1: Live Feeds & Tax** | AMFI daily NAV feed parser (`NAVAll.txt`), Budget 2024 LTCG (12.5% over ₹1.25L), STCG (20%), Tax-Loss Harvesting | ✅ Complete | ✅ Verified | Real-time quote refresh in `/portfolio` & `/analytics`. |
| **Phase 6A: Multi-Demat & Family** | Legal entities (Self, Spouse, HUF, Child, Parent), multi-broker accounts (Zerodha, Groww, ICICI Direct), multi-entity Section 112A tax benefits, goal beneficiaries & joint liabilities | ✅ Complete | ✅ Verified | Migrations 7 & 8 applied; domain math & application use cases complete; full frontend UI integrated in `/portfolio`, `/analytics`, `/transactions`, `/goals`, `/liabilities`, and `/settings`. |
| **Phase 6B: Desktop Runtime** | Tauri 2 + SQLite local offline sync | ⏳ Backlog | ❌ Pending | Future offline-first desktop runtime. |

---

## 🛠️ Completed Work Details

### 1. Recent Bug Fixes & System Stability
* **401 Unauthorized Console Errors (Resolved)**:
  - Configured valid local Supabase anon key in `apps/web/src/lib/supabase/client.ts`.
  - Added instant bypass in `apps/web/src/lib/supabase/user.adapter.ts` for unauthenticated/demo visitors (`demo-` prefix) to prevent invalid UUID queries to PostgreSQL.
  - Set `envDir` in `apps/web/vite.config.ts`.
  - Confirmed all Supabase REST API queries return `HTTP 200 OK`.
* **504 Outdated Optimize Dep (Resolved)**:
  - Cleared stale Vite cache and updated dependency optimization configuration.

### 2. Phase 6A: Multi-Demat & Family Portfolios (Completed Layers)
* **Database Layer (`supabase/migrations/20260101000007_family_entities_and_accounts.sql`)**:
  - `family_members` table: `id`, `user_id`, `name`, `relationship` (`self`, `spouse`, `huf`, `child`, `parent`, `other`), `pan_masked`, `color_hex`, `is_primary`, `notes`, timestamps.
  - `portfolio_accounts` table: `id`, `user_id`, `member_id`, `account_name`, `broker_name` (Zerodha, Groww, Upstox, ICICI Direct, etc.), `depository` (`CDSL`, `NSDL`, `CAMS`, etc.), `account_type` (`demat`, `mutual_fund_folio`, `savings_bank`, `ppf_epf`), timestamps.
  - Extended `holdings` and `transactions` tables with `member_id` and `account_id` foreign keys and indices.
  - Row-Level Security (RLS) policies enabled for strict tenant isolation.
  - Migration successfully applied to local PostgreSQL container `supabase_db_wealthnest`.
* **Domain Layer (`packages/domain`)**:
  - `packages/domain/src/family/family-types.ts`: typed domain models for family members, accounts, distributions, and entity tax summaries.
  - `packages/domain/src/family/family-wealth-calculator.ts`:
    - Pure functional calculation of total family wealth, per-member distribution, and per-account distribution.
    - **Multi-Entity Section 112A Tax Segregation**: Quantifies the **HUF Tax Harvest Benefit** (where splitting capital gains across Self and HUF yields separate ₹1.25 Lakh tax exemptions, saving ₹15,625 in tax per year).
  - Unit tests in `packages/domain/src/__tests__/family-portfolio.test.ts` (100% passing).
* **Application Layer (`packages/application`)**:
  - `packages/application/src/ports/family-repository.port.ts`: `FamilyRepositoryPort`, `FamilyMemberDto`, `PortfolioAccountDto`.
  - Extended `TransactionDetailDto` and `CreateTransactionParams` in `packages/application/src/ports/transaction-repository.port.ts` with `memberId` and `accountId`.
  - `packages/application/src/use-cases/manage-family.ts`: `GetFamilyPortfolioSummaryUseCase`, `ManageFamilyMembersUseCase`, `ManagePortfolioAccountsUseCase`.
  - Extended `HoldingDetailDto` and `CreateHoldingParams` with `memberId` and `accountId`.
  - Unit tests in `packages/application/src/__tests__/family-use-case.test.ts` (100% passing).
* **Frontend UI Layer (`apps/web`)**:
  - `apps/web/src/lib/supabase/family.adapter.ts`: Supabase repository adapter with local storage & rich demo fallback (`mem-self`, `mem-spouse`, `mem-huf`, `mem-child`, `acc-zerodha`, `acc-groww`, `acc-icici`, `acc-cams`, `acc-sbi-ppf`).
  - `apps/web/src/lib/family/family-context.tsx`: Global family state managing active entity (`selectedMemberId`), Demat filter (`selectedAccountId`), summary calculation, and full CRUD operations.
  - `apps/web/src/components/family/FamilyFilterBar.tsx`: Responsive entity switcher with pills (`👨‍👩‍👧‍👦 Combined Family`, `👤 Self`, `💍 Spouse`, `🏛️ HUF`, `👶 Child`), scoped Demat selector, and management trigger.
  - `apps/web/src/components/family/FamilyDistributionWidget.tsx`: Multi-segment wealth allocation bar, entity card grid, and the Budget 2024 HUF Section 112A Tax Shield banner.
  - `apps/web/src/components/family/ManageFamilyModal.tsx`: Dual-tab modal for adding/deleting family entities and Demat/MF folios.
  - `apps/web/src/pages/SettingsPage.tsx`: Dedicated "Family & Demats" settings tab with registered entities, connected Demats, and Section 112A tax shield advisory.
  - `apps/web/src/pages/PortfolioPage.tsx`: Integrated filter bar, family distribution widget, dynamic holdings scoping by member & Demat account, and table entity/broker badges.
  - `apps/web/src/components/portfolio/AddHoldingModal.tsx`: Legal Entity and Demat account selectors with member-scoped broker filtering.
  - `apps/web/src/components/portfolio/ImportCasModal.tsx` & `cas-import.adapter.ts`: Entity and Demat assignment card during CAS statement preview, persisting `member_id` and `account_id` to imported positions and transactions.
  - `apps/web/src/pages/AnalyticsPage.tsx`: Integrated filter bar, dynamic scoping of XIRR, CAGR, benchmark alpha, asset allocation radar, and HUF Section 112A annual exemption indicator.
  - `apps/web/src/pages/TransactionsPage.tsx` & `RecordTransactionModal.tsx`: Integrated filter bar, cashflow KPIs scoped to entity, audit table entity & broker badges, and entity/account assignment on new transactions.
  - `apps/web/src/pages/GoalsPage.tsx` & `AddGoalModal.tsx`: Integrated filter bar, beneficiary badges on milestones (`Krisha Vaghela`, `Ketan Vaghela`, `Shamalbhai Vaghela HUF`), family member entity selection in add goal modal, and entity-scoped goal progress and emergency runway.
  - `apps/web/src/pages/LiabilitiesPage.tsx` & `AddLiabilityModal.tsx`: Integrated filter bar, primary borrower and joint co-borrower tags (`Ketan Vaghela` + `Joint: Parul Vaghela`), entity-scoped Net Worth and debt calculations, and borrower selectors in add/edit liability modal.
  - `apps/web/src/__tests__/FamilyPortfolio.test.tsx`: Comprehensive integration test suite (16 tests) covering components, modal interactions, CAS preview tagging, and page integration for Portfolio, Settings, Transactions, Analytics, Goals, and Liabilities.

---

## ⏳ Current Work In Progress & Pending Backlog

The following areas are pending for review and prioritization:

### 1. Priority 1: Phase 6A Frontend UI Integration (Multi-Demat & Family Portfolios)
* [x] **Family Repository Adapter (`apps/web/src/lib/supabase/family.adapter.ts`)**:
  - Implement Supabase adapter with fallback demo data (Self: Zerodha Kite, Spouse: Groww Direct, HUF: ICICI Direct, Child: Parag Parikh Folio).
* [x] **Family Context Provider (`apps/web/src/lib/family/family-context.tsx`)**:
  - Global state managing `selectedMemberId` (`'all'` for combined family net worth or specific entity ID) and `selectedAccountId`.
* [x] **Family Entity Switcher Bar (`apps/web/src/components/family/FamilyFilterBar.tsx`)**:
  - Top entity switcher with pills: "👨‍👩‍👧‍👦 All Family", "👤 Self", "💍 Spouse", "🏛️ HUF", "👶 Child" and Demat account dropdown.
* [x] **Family Wealth & HUF Tax Widget (`apps/web/src/components/family/FamilyDistributionWidget.tsx`)**:
  - Visual wealth breakdown by entity and the **HUF Tax Benefit** banner.
* [x] **Entity & Account Management (`apps/web/src/components/family/ManageFamilyModal.tsx` / Settings Tab)**:
  - Dedicated tab in `/settings` to add, edit, or remove family members and Demat accounts.
* [x] **Update `/portfolio`, `/analytics`, `/transactions` & Ingestion Modals**:
  - Filter holdings and transactions by active entity/account.
  - Add entity and broker badges to holdings table rows and transaction audit rows.
  - Assign transactions and holdings to specific entities and Demat folios in record modal, add holding modal, and CAS statement preview.
* [x] **Component & Integration Tests**:
  - Comprehensive unit test suite in `apps/web/src/__tests__/FamilyPortfolio.test.tsx` (10 tests covering all UI components, modals, and pages).

### 2. Priority 2: Automated Live Stock CMP Feed (Phase 5A Expansion)
* [ ] Integrate live NSE/BSE stock quote adapter (Yahoo Finance / rapid market proxy) alongside the existing AMFI mutual fund NAV feed.

### 3. Priority 3: QA Documentation
* [x] Created `docs/QA/phase-6-1-family-portfolios-verification.md` covering all 7 test cases for family entities, multi-Demat accounts, and HUF tax rules.
* [x] Updated `docs/QA/README.md`.

### 4. Priority 4: Phase 6B Desktop Offline Architecture (Tauri 2 + SQLite)
* [ ] Tauri 2 desktop bundle scaffolding with local SQLite adapter for complete offline operation.

---

## 📈 Quality Gates & System Health

* **TypeScript Compilation**: `npm run type-check` compiles with **0 errors**.
* **Automated Test Coverage**: **150 passing tests** across 35 test suites (`vitest`).
* **Persona & Real-World Dogfooding**: Fully personalized to the **Vaghela Family** (`Ketan Vaghela`, `Parul Vaghela`, `Krisha Vaghela`, `Shamalbhai Vaghela HUF`, `Ramilaben Vaghela`) with strict global rule enforcement.
* **Active Containers**:
  - Web App: `http://localhost:30000` (Nginx Proxy) / `http://localhost:5174` (Vite)
  - Supabase Studio: `http://localhost:54323`
  - PostgreSQL DB: `127.0.0.1:54322`
  - Inbucket Mock Email: `http://localhost:54324`
  - Kong Gateway: `http://127.0.0.1:54321`
