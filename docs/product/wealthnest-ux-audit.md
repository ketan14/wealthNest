# WealthNest — Comprehensive Product, UX, UI and Architecture Audit

**Target Document**: `docs/product/wealthnest-ux-audit.md`  
**Date**: November 2026  
**Auditor**: Antigravity Technical & Product Architecture  
**Scope**: Private Family Wealth Operating System (`WealthNest`)  
**Repository State**: Monorepo (`apps/web`, `packages/domain`, `packages/application`, `packages/shared`, `src-tauri`, `supabase`)  

---

## 1. Executive Summary

### 1.1 Current Application Maturity
WealthNest currently stands at an **Advanced Alpha / Early Engineering Preview** stage (Phase 10 verification level). 
- **Core Domain & Computation Strengths**: The financial foundation inside `packages/domain` is exceptionally high quality. It adheres strictly to DDD (Domain-Driven Design), handles currency with zero floating-point drift using integer paise (`BigInt` / `cents`), implements `en-IN` grouping (Lakhs/Crores), and provides rigorous valuation algorithms for XIRR, CAGR, capital gains (STCG/LTCG with Section 112A ₹1.25L exemption), and loan amortization.
- **Architectural Strengths**: Clean separation of concerns across workspace packages (`@wealthnest/domain`, `@wealthnest/application`, `@wealthnest/shared`, `@wealthnest/web`), offline-first repository abstractions, Tauri desktop/mobile runtime wrappers, and local Supabase integration.
- **Core Product & UX Gaps**: 
  1. **Developer-Centric Home Dashboard**: The primary `HomePage.tsx` functions more as an internal engineering debug & service monitor console (displaying Supabase Studio URLs, architecture layer badges, Docker ports, and schema seed tables) rather than a calm, trustworthy executive overview for a family.
  2. **Monolithic Page Components**: `PortfolioPage.tsx` exceeds 2,190 lines of code, mixing market quote feeds, CAS parsers, Demat accounts, broker CSV modals, family filter bars, and dense data tables.
  3. **Ownership vs. Tenant Isolation Mismatch**: While Supabase database schema has tables for `family_members` (`supabase/migrations/20260101000007_family_entities_and_accounts.sql`), several core RLS policies still isolate records by `user_id = auth.uid()` instead of `household_id`. This creates a critical gap where family members cannot collaboratively view or manage shared household wealth under separate logins without impersonation or shared credentials.
  4. **Mobile Usability & Information Density**: Many views rely on desktop-style tabular grids that overflow or shrink awkwardly on viewports below 390px, lacking optimized bottom sheets, mobile quick-action floating bars, and swipe gestures.

### 1.2 Top Usability & Product Gaps
1. **Developer jargon in primary views**: Exposure of technical jargon (Postgres ports, Supabase Studio links, BigInt cents display, schema migration references) on the main dashboard.
2. **Missing Global Quick Action ("Quick Add")**: Logging an EMI payment, an expense, an asset valuation, or a manual stock holding requires navigating deep into specific pages and hunting for nested modals.
3. **Overcrowded Portfolio View**: The Portfolio screen tries to be a live stock ticker, CAS statement reconciliation console, broker CSV importer, asset class taxonomy list, and transaction history simultaneously.
4. **Disjointed Real Estate & Liabilities Modeling**: Real estate is treated as an asset class entry under general holdings/assets, while loans are tracked separately under Liabilities. Equity calculation requires manual linking and lacks visual drill-downs (LTV, amortization breakdown, rental yield).
5. **No Unified Cash Flow & Expense Distinction**: Transactions page blends investment investments, dividend cashflows, transfers, and daily expenses without clear cash-versus-debt double-entry integrity.

### 1.3 Critical Financial Integrity & Security Risks (P0)
- **RLS Policy Household Boundary (Security P0)**: Core financial tables (`assets`, `holdings`, `liabilities`, `transactions`) enforce `auth.uid() = user_id`. Household members sharing a family unit either cannot see each other's legal holdings or must share a single administrative login.
- **Time-Aware As-Of Valuations (Financial Integrity P0)**: Historical net worth calculations calculate historical asset values and liabilities, but lack point-in-time loan amortization reconstruction when ad-hoc prepayments or interest rate adjustments occur without recorded balance checkpoints.
- **Goal Funding vs. Asset Double-Allocation (Financial P0)**: A single asset or holding can be allocated across multiple financial goals (e.g., Krisha's Education and Retirement) without checking whether the total percentage allocation exceeds 100%.

---

## 2. Existing Feature Inventory

| Feature Area | Existing Implementation | Reusable Components / Code | Issues Identified | Recommendation | Status |
|---|---|---|---|---|---|
| **System Overview (Home)** | `HomePage.tsx` (462 LOC) | `Card`, `Badge`, `Button`, `AuthCard` | Displays Docker ports, database URLs, test math badges, and internal technical diagnostics. | Redesign into an executive family dashboard: Net worth, Liquid assets, Debt obligations, Goal milestones, Recent alerts. | Requires Redesign |
| **Portfolio & Holdings** | `PortfolioPage.tsx` (2198 LOC) | `HoldingCard`, `AddHoldingModal`, `EditHoldingModal`, `ImportCasModal` | Monolithic file; mixes NSE/BSE quote fetching, CAS imports, broker CSV imports, and family filtering. | Split into sub-views: (1) Assets & Real Estate, (2) Equities & MF, (3) Demat/Accounts. Extract modals into dedicated feature directories. | Partially Implemented |
| **Loans & Liabilities** | `LiabilitiesPage.tsx` (939 LOC) | `AddLiabilityModal`, `UpdateBalanceModal`, `UpdateValuationModal` | Excellent domain models; lacks automated amortisation schedule generator and visual LTV tracker for mortgaged assets. | Promote linked property equity view; add prepayment scenario calculator and monthly EMI outflow tracker. | Complete (Needs Polish) |
| **Cashflow & Transactions** | `TransactionsPage.tsx` (976 LOC) | `TransactionCard`, `RecordTransactionModal` | Blends operational expenses with transfers and investment purchases; double-counting risk on own-account transfers. | Categorize transactions into Income, Expenses, and Transfers. Enforce double-entry debit/credit rules. | Complete (Needs Verification) |
| **Analytics & Taxes** | `AnalyticsPage.tsx` (1081 LOC) | SVG Donut charts, Bar charts, XIRR/CAGR cards | High quality math; complex visual layout; lacks multi-year comparative historical charts on mobile. | Standardize responsive chart containers; simplify metrics into high-level returns vs. tax-pack drilldown. | Complete |
| **Financial Goals** | `GoalsPage.tsx` (796 LOC) | `AddGoalModal`, Goal progress bars | Visual progress is linked to holdings, but lacks asset over-allocation prevention and milestone projection curve. | Add allocation cap (≤ 100% per asset) and inflation-adjusted milestone trajectory (e.g. Higher Education in 2038). | Complete |
| **Family & Entity Hub** | `FamilyFilterBar`, `ManageFamilyModal`, `family-context.tsx` | `FamilyDistributionWidget`, Member avatar badges | State is largely client-side managed; member creation does not automatically map to isolated Supabase logins. | Connect family member entities to role-based access control and individual PAN/HUF profiles. | Partially Implemented |
| **Admin & Support** | `pages/admin/*`, `SupportModeBanner.tsx`, `ViewAsUserModal.tsx` | `AdminLayout`, `AdminGuard`, Audit log tables | Highly sophisticated impersonation and audit system; however, platform admin routes clutter the family app bundle. | Retain as privileged side-car route `/admin`; ensure total RLS isolation so platform admins cannot see unmasked financial balances. | Complete |
| **Tauri Integration** | `src-tauri/`, `tauri-runtime.ts`, `tauri-file-dialog.ts`, `tauri-sqlite-adapter.ts` | Tauri file picker, SQLite offline repository adapter | Excellent desktop foundations; mobile packaging and bi-directional sync engine not yet implemented. | Keep abstraction layer clean (`RepositoryProvider`); prioritize web and Tauri desktop before mobile bundling. | Complete (Ready for Reuse) |

---

## 3. Product Information Architecture

### 3.1 Current Navigation Assessment
- **Current Desktop Sidebar**:
  1. `System Overview` (`/`)
  2. `Portfolio` (`/portfolio`)
  3. `Loans & Liabilities` (`/liabilities`)
  4. `Transactions` (`/transactions`)
  5. `Analytics` (`/analytics`)
  6. `Goals & Targets` (`/goals`)
  7. `Settings` (`/settings`)
  8. `Admin Portal` (`/admin` - conditionally rendered)
- **Current Mobile Bottom Bar**:
  1. `Overview` (`/`)
  2. `Portfolio` (`/portfolio`)
  3. `Liabilities` (`/liabilities`)
  4. `Cashflow` (`/transactions`)
  5. `Settings` (`/settings`)
  *(Goals and Analytics are completely hidden from mobile bottom navigation!)*

### 3.2 Recommended Target Information Architecture
To make the application family-centric, intuitive, and clean:

```
WealthNest Navigation Structure
├── 1. Home (Executive Family Dashboard)
│   ├── Family Net Worth KPI & Liquid Reserves
│   ├── Asset Allocation Overview
│   ├── Upcoming EMIs & Financial Deadlines
│   └── Goal Milestones Snapshot
├── 2. Portfolio (What the Family Owns & Owes)
│   ├── Holdings (Equities, Mutual Funds, Gold, Deposits)
│   ├── Real Estate & Property Equity (Value, Mortgages, Net Equity, Rental)
│   ├── Liabilities & Loans (Home Loans, Vehicle Loans, Personal Lines)
│   └── Accounts & Demats (Zerodha, Groww, Bank Folios, CAMS)
├── 3. Transactions (Cash Flow & Activity)
│   ├── Cash Flow (Income vs. Expenses)
│   ├── Investment Activity (Buys, Sells, Dividends, SIPs)
│   └── Transfers (Inter-account transfers - zero P&L)
├── 4. Reports & Insights (Financial Performance & Taxes)
│   ├── Net Worth Trend (Historical timeline)
│   ├── Returns & Performance (XIRR, CAGR, Asset Benchmarks)
│   ├── Tax Shield (LTCG / STCG, Sec 112A ₹1.25L exemption, HUF tracking)
│   └── Loan Amortization & Debt-Free Trajectory
├── 5. Goals (Family Financial Life-Goals)
│   ├── Child Higher Education (Krisha - Target 2038)
│   ├── Retirement & Independence (Ketan & Parul - Target 2045)
│   ├── Emergency Contingency Fund (6-12 Months Runway)
│   └── Custom Capital Milestones
├── 6. Family Hub (Entities & Household Ownership)
│   ├── Members & Legal Profiles (Ketan, Parul, Krisha, Shamalbhai HUF, Ramilaben)
│   ├── Ownership Distribution (Individual vs. Joint vs. HUF)
│   └── Access Permissions & Invite Links
└── 7. Settings & Platform
    ├── Preferences (INR formatting, Lakhs/Crores, Dark Mode)
    ├── Data Import & Backups (CAS PDF, Broker CSV, Encrypted JSON)
    └── Security & Active Sessions
```

---

## 4. Dashboard UX Audit

### 4.1 Evaluation of Existing `HomePage.tsx`
- **Does it answer "What is family net worth?"**: Yes, partially. It shows total assets, liabilities, and net worth, but relies on a demo calculation box (`150000.5 + 49999.5 = 200000`) and debug badges.
- **Does it answer "How much is liquid?"**: No. Cash and liquid assets are combined with total assets.
- **Does it answer "What needs attention?"**: No. There are no actionable alerts (e.g. "Property valuation overdue", "EMI due in 4 days", "Tax exemption threshold remaining").
- **Visual noise**: High. Exposes Postgres port `54322`, Studio port `54323`, and architectural status cards for `@wealthnest/domain`.

### 4.2 Revised Dashboard Specification & Wireframe
```
+------------------------------------------------------------------------------------+
|  WEALTHNEST FAMILY DASHBOARD                      [ Household: Vaghela Family (5) v ]
+------------------------------------------------------------------------------------+
|  FAMILY NET WORTH            LIQUID RUNWAY         MONTHLY CASHFLOW     DEBT / ASSETS
|  ₹ 1.84 Crores               ₹ 24.50 Lakhs         +₹ 1.65 Lakhs/mo     22.4% (Safe)
|  +14.2% YoY                  8.2 Months Exp        Income: ₹2.85L       EMI: ₹58,400
+------------------------------------------------------------------------------------+
|  ASSET ALLOCATION                      |  UPCOMING OBLIGATIONS & ATTENTION
|  [■ Equity 42% | ■ Real Estate 38%     |  • SBI Home Loan EMI (₹43,391) due in 5 days
|   ■ Mutual Funds 12% | ■ Gold 5%       |  • Shamalbhai HUF LTCG: ₹45,000 / ₹1,25,000 used
|   ■ Liquid Cash 3%]                    |  • 3BHK Bengaluru valuation not updated in 9 mos
+------------------------------------------------------------------------------------+
|  NET WORTH TRAJECTORY (12M / 3Y / ALL) |  GOAL MILESTONES PROGRESS
|  [=== Responsive Interactive SVG Chart ===] |  • Krisha College: 42% on track (₹24L / ₹50L)
|                                        |  • Emergency Fund: 100% funded (₹15L / ₹15L)
+------------------------------------------------------------------------------------+
|  RECENT ACTIVITY & RECONCILIATIONS     |  FAMILY MEMBER CONTRIBUTION
|  • Parag Parikh Flexi Cap SIP recorded |  • Ketan (Self): 58%
|  • CAMS/KFintech CAS imported 2d ago   |  • Parul (Spouse): 28%
|  • HDFC EV Loan EMI debited            |  • Shamalbhai HUF: 14%
+------------------------------------------------------------------------------------+
```

---

## 5. Mobile UX Audit

### 5.1 Viewport Breakpoint Testing Analysis
- **320px - 360px (iPhone SE, Small Android)**:
  - Form dialogs (`AddHoldingModal`, `AddLiabilityModal`) have crowded buttons; cancellation and submit buttons squeeze into one line or clip.
  - Number inputs with currency formatting jump cursor position on soft keyboards.
  - Donut chart legends in Analytics wrap awkwardly and push data off-screen.
- **375px - 414px (Standard iOS & Android)**:
  - Bottom navigation bar works well with 44px min-touch targets, but lacks quick-add button.
  - Multi-column tables on `PortfolioPage` require forced horizontal scrolling; important action icons (Edit/Delete) are hidden past the right viewport boundary.
- **768px (iPad / Tablet)**:
  - Sidebar toggles to hidden, relying on bottom navigation, leaving excessive empty horizontal whitespace in tablet portrait mode.

### 5.2 Mobile-Specific Recommendations
1. **Sticky Floating Action Button (FAB)**: A centered, elevated `+` button in the bottom navigation for instant Quick-Add (Holdings, Expense, Valuation, EMI).
2. **Bottom Sheet Pattern**: Replace desktop centered modal dialogs (`<div className="fixed inset-0 ...">`) with native-style mobile bottom sheets that slide up from the bottom with clear drag handles and fixed submit headers.
3. **Card-Based View for Holdings & Loans on Mobile**: Replace wide table layouts on mobile with `HoldingCard` and `LiabilityCard` stacked views with swipe-to-reveal actions.

---

## 6. Desktop UX Audit

### 6.1 Information Density & Layout
- The desktop interface has a clean dark aesthetic, but fails to utilize widescreen display real estate effectively.
- **Table vs Card Usage**: Currently, some pages use cards where dense tables are required (e.g. liabilities), while the portfolio page uses a massive table that could benefit from sticky column headers, collapsible categories, and master-detail split panes.
- **Keyboard Shortcuts**: Lacks common power-user desktop shortcuts (`Ctrl+K` for global search, `Esc` to dismiss drawers, `N` for new entry).

---

## 7. Family Management and Ownership

### 7.1 Existing Family Implementation
- The repository introduced family entities in migration `20260101000007_family_entities_and_accounts.sql`:
  - `family_members`: Supports `legal_name`, `pan_number`, `relationship`, `is_huf_entity`.
  - `portfolio_accounts`: Supports Demat and bank account folios linked to family members.
  - `holdings.member_id` and `liabilities.member_id`, `liabilities.co_borrower_member_ids`.
- **The Gap**:
  - The UI currently simulates family distribution via client-side calculations (`useFamily()`).
  - There is no legal distinction between the **Record Creator**, the **Beneficial Owner**, and the **HUF Karta**.
  - RLS policies still isolate tables by `user_id = auth.uid()`. As a result, Parul and Ketan cannot have distinct logins that both securely query the same household portfolio unless one impersonates the other.

---

## 8. Financial Module UX Audit

### 8.1 Module Breakdown

#### A. Assets & Real Estate
- Real estate is currently squeezed into the general `assets` and `holdings` table.
- **Issue**: Real estate requires specialized attributes: purchase price, registration date, stamp duty, municipal tax, current circle rate/market valuation, linked mortgage loans, and rental yields.
- **Requirement**: Separate real estate into its own specialized section under Portfolio, automatically calculating **Net Property Equity = Current Estimated Market Value - Outstanding Mortgage Principal**.

#### B. Loans and Liabilities
- Implementation in `LiabilitiesPage.tsx` is clean and comprehensive.
- **Issue**: When an EMI is paid, there is no automatic bifurcation into interest expense vs. principal reduction in the transaction ledger.

#### C. Investments (Equities & Mutual Funds)
- Supported by CAS parsers (`cams-kfin-cas-parser.ts`, `cdsl-cas-parser.ts`, `nsdl-cas-parser.ts`) and broker CSV importers (Zerodha, Groww).
- **Issue**: Reconciliation is cumbersome when a stock name or folio number from a broker CSV slightly differs from an imported CAS statement.

#### D. Transactions & Cashflow
- Currently handles basic transactions.
- **Issue**: Lacks recurring transaction rules (e.g., monthly SIPs, recurring EMI debits) and does not clearly prevent transfers between self-accounts from distorting the monthly cash flow.

#### E. Financial Goals
- Goals can link to holdings.
- **Issue**: Goals do not enforce target allocation limits across assets, leading to the risk of multiple goals claiming 100% of the same asset.

---

## 9. Financial Data Integrity Audit

### 9.1 Point-in-Time Net Worth Calculation
- **Rule**: Historical asset valuation must use `valuation_date <= report_date` (latest valid valuation).
- **Audit Result**: Domain functions in `packages/domain/src/liabilities/net-worth-calculator.ts` correctly handle point-in-time valuation lookups.
- **Risk**: For liabilities, if intermediate monthly balance updates are missed, the application falls back to linear interpolation rather than strictly compounding interest and amortizing payments.

### 9.2 Zero Floating-Point Drift Verification
- The application uses `Money.ts` backed by `BigInt` paise (`cents`).
- All tests in `packages/domain/src/__tests__/money.test.ts` pass with 100% precision.
- India-first formatting with `en-IN` correctly displays `₹ 15,00,000` (15 Lakhs) and `₹ 1,50,00,000` (1.50 Crores).

---

## 10. Design System and Accessibility

- **Visual Design**: Sleek slate and emerald color palette (`bg-card`, `border-border`, `text-primary`).
- **Contrast Ratios**: Verified WCAG AA compliant on primary text; however, muted text (`text-muted-foreground`) at `text-[10px]` occasionally falls below 4.5:1 on dark backgrounds.
- **Screen Reader & Keyboard Accessibility**:
  - Modal dialogs trap focus reasonably well, but lack `aria-describedby` associations on several input groups.
  - Interactive charts use raw SVG elements that lack accessible table fallbacks or `aria-label` tags for screen readers.

---

## 11. Security and Privacy Audit

### 11.1 Row-Level Security (RLS) Analysis
- **Finding**: Migrations `20260101000001_core_schema.sql` through `20260101000013_profiles_insert_policy_and_inr_default.sql` implement RLS on all public tables.
- **Vulnerability**: Every policy checks `WHERE user_id = auth.uid()`.
  - While this provides absolute single-user data isolation, it completely blocks the primary family product requirement: **multi-member household collaboration**.
  - A user cannot invite their spouse (`Parul`) or parents (`Shamalbhai HUF`) to view or co-manage household holdings with granular read/write permissions.

---

## 12. Tauri and Cross-Platform Readiness

- **Current State**: Tauri configuration exists in `src-tauri/` (Tauri v2).
- **Storage Decoupling**: The codebase already features a clean `RepositoryProvider` architecture that can switch between Supabase HTTP/PostgREST client and a local SQLite database adapter (`tauri-sqlite-adapter.ts`).
- **Readiness Tier**:
  - `packages/domain`: **Tier A (100% Reusable unchanged)**
  - `packages/application`: **Tier A (100% Reusable unchanged)**
  - `packages/shared`: **Tier A (100% Reusable unchanged)**
  - `apps/web/src/lib/persistence`: **Tier B (Responsive modification / SQLite sync)**
  - `apps/web/src/pages`: **Tier E (Refactor before reuse: split monolithic pages)**

---

## 13. Prioritized Improvement Backlog

| ID | Area | Issue Description | Recommended Action | Priority | Complexity | Dependencies |
|---|---|---|---|---|---|---|
| **SEC-01** | Security / Auth | RLS policies restrict all data to `user_id = auth.uid()` preventing family sharing. | Introduce `household_members` join in RLS policies with `can_view` and `can_edit` role checks. | **P0** | High | Migration & Auth |
| **FIN-01** | Financial Integrity | Assets can be double-allocated to multiple goals past 100%. | Add validation invariant in `goal-calculator.ts` enforcing total allocated percentage $\le 100\%$. | **P0** | Medium | Domain models |
| **FIN-02** | Financial Integrity | EMI payments do not automatically bifurcate principal vs interest. | Implement amortization ledger entries when recording loan repayments. | **P0** | Medium | Liabilities & Txns |
| **UX-01** | Dashboard UX | Home screen displays internal developer diagnostics and database ports. | Redesign Home dashboard into an executive family summary (Net Worth, Runway, EMIs, Goals). | **P1** | Medium | Web UI |
| **UX-02** | Mobile UX | Missing global Quick Add button and bottom sheets on mobile. | Add center-docked Quick Add button in `BottomNavigationBar.tsx` and mobile bottom sheet wrappers. | **P1** | Medium | Mobile Shell |
| **UX-03** | Information Arch | `PortfolioPage.tsx` is an oversized monolith (>2,190 LOC). | Refactor into modular sub-routes: `/portfolio/assets`, `/portfolio/investments`, `/portfolio/accounts`. | **P1** | High | Web Pages |
| **UX-04** | Real Estate | Real estate is merged into general equity holdings without property metrics. | Dedicated Real Estate view with LTV, Net Property Equity, and Rental Yield tracking. | **P1** | Medium | Portfolio & Loans |
| **PERF-01** | Performance | Heavy bundle size due to inlining PDF.js and charting libraries in single chunks. | Dynamic import for `pdfjs-dist` and CAS parsers; route-level code splitting. | **P2** | Low | Vite Config |
| **A11Y-01** | Accessibility | SVG charts lack keyboard focusability and accessible tabular data fallbacks. | Wrap charts in accessible SVG containers with ARIA labels and screen-reader data summaries. | **P2** | Low | UI Components |
| **DESK-01** | Desktop UX | Lacks power-user keyboard navigation and search dialog (`Ctrl+K`). | Introduce global command palette for quick navigation, search, and data entry. | **P3** | Medium | UI Shell |

---

## 14. Proposed Development Roadmap

### Phase 1: Core Family Experience (Immediate Priority)
- Clean up `HomePage.tsx` to remove developer debug cards and replace them with the Family Net Worth Executive Summary.
- Implement Global Quick Add floating action button.
- Separate mobile and desktop navigation paths to ensure Goals and Analytics are accessible on mobile.

### Phase 2: Financial Accuracy & History
- Enforce strict goal allocation cap ($\le 100\%$ per holding).
- Introduce automated EMI interest vs. principal split in transactions.
- Enhance historical point-in-time valuation lookups for irregular debt prepayments.

### Phase 3: Family Financial Operations & Multi-User RLS
- Upgrade database RLS policies to support `household_id` collaboration.
- Enable member-level privacy controls (e.g. spouse private account vs. shared family pool).
- Support HUF Karta declaration and Section 112A annual tax shield tracker.

### Phase 4: Financial Planning & Real Estate Specialization
- Build dedicated Real Estate equity sub-module.
- Add milestone projection curves for child education and retirement goals.

### Phase 5: Intelligence, Reconciliation & Automation
- Enhanced auto-reconciliation between CAS statements and broker trade books.
- Automated alert triggers (overdue asset valuations, upcoming loan rate resets).

### Phase 6: Cross-Platform Tauri Maturity
- Tauri desktop build hardening with local SQLite synchronization.
- Android / iOS standalone packaging via Tauri Mobile.

---

## 15. Acceptance Criteria

1. **Dashboard Usability**: 100% free of internal engineering diagnostic badges or ports; displays Family Net Worth, Liquid Reserves, Debt Ratio, and Upcoming EMIs within 1.5 seconds of page load.
2. **Financial Precision**: All portfolio calculations execute using `BigInt` paise with zero floating-point drift across all Indian number formatters (`₹ Lakhs` and `₹ Crores`).
3. **Mobile Ergonomics**: All actionable buttons have $\ge 44 \times 44\text{px}$ touch targets; zero horizontal page scroll on screens down to 360px wide; modal workflows open in smooth bottom sheets on mobile.
4. **Security & RLS**: All household financial records are strictly protected under household-level RLS policies; platform administrators cannot view unmasked balances without explicit support session consent.
5. **Code Maintainability**: No single React component file exceeds 500 lines of code; all domain business logic resides strictly inside `@wealthnest/domain` or `@wealthnest/application`.

