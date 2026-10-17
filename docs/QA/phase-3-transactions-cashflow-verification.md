# QA Test Plan: Phase 3 — Transactions & Cashflow Management

This document defines the formal Quality Assurance test cases for **Phase 3** of WealthNest, covering cashflow tracking, trades, dividend payouts, statutory charges, and the audit log ledger with **India-First architecture** (`₹ INR`, Lakhs/Crores formatting).

---

## 🎯 Scope & Objectives
Validate that:
1. The Transactions & Cashflow module is fully operational at `/transactions`.
2. Total Inflows, Total Outflows, and Net Cashflow calculate with exact integer paise precision (`bigint`).
3. The visual Cashflow Ratio bar compares capital inflows versus deployed outflows and fees.
4. The Chronological Audit Log table renders signed currency amounts (`+₹` in emerald, `-₹` in rose).
5. Category filter pills (**All**, **Inflow**, **Outflow**, **Trades**) and text search filter the audit ledger responsively.
6. The Record Transaction modal captures inflows (Deposits, Dividends, Sells) and outflows (Buys, Withdrawals, Fees) and links to assets.
7. Real user transactions persist into the PostgreSQL `transactions` table (with RLS isolation) when authenticated.

---

## 🧪 Test Cases

### TC-P3-001: Transactions Page Rendering & KPI Cards
- **Objective**: Verify that the cashflow dashboard loads with accurate Indian Rupee metrics and branding.
- **URL**: [http://wealthnest.local/transactions](http://wealthnest.local/transactions)
- **Preconditions**: Web app is running.
- **Test Steps**:
  1. Navigate to [http://wealthnest.local/transactions](http://wealthnest.local/transactions) (or click **Transactions** in the sidebar).
  2. Inspect the page header.
  3. Inspect the top 4 KPI cards.
- **Expected Results**:
  - Page header displays badges: `India First (₹ INR)` and `Demo Mode` (or `Database Active` if logged in).
  - Top 4 cards render:
    - **Total Inflows**: Green text formatted in `₹` (e.g. `+₹1,58,550.00`) with compact Lakh badge.
    - **Total Outflows**: Rose text formatted in `₹` (e.g. `-₹1,00,685.00`) with compact Lakh badge.
    - **Net Cashflow**: Signed net capital balance (`+₹57,865.00` in emerald).
    - **Audit Volume**: Count of chronological records.
- **Status**: ✅ **PASSED**

---

### TC-P3-002: Cashflow Ratio Bar & Category Breakdown
- **Objective**: Verify visual proportion breakdown of Inflows vs Outflows and category summary pills.
- **Test Steps**:
  1. Inspect the two-tone progress bar under **Cashflow Ratio & Category Breakdown**.
  2. Inspect the 6 category breakdown cards: Deposits, Asset Buys, Dividends, Asset Sells, Withdrawals, Fees & STT.
- **Expected Results**:
  - Green segment reflects percentage of inflows; rose segment reflects percentage of outflows.
  - Category cards display compact Rupee sums (e.g. Deposits `₹1.50 L`, Dividends `₹8.55 K`, Fees `₹185.00`).
- **Status**: ✅ **PASSED**

---

### TC-P3-003: Chronological Audit Log & Type Badges
- **Objective**: Verify that audit log records render with color-coded type badges and formatted dates.
- **Test Steps**:
  1. Review the **Transaction Audit Log** table rows.
  2. Verify the visual badges:
     - Deposits & Dividends: Emerald badge with down-left arrow.
     - Sells: Teal badge with down-left arrow.
     - Buys: Blue badge with up-right arrow.
     - Withdrawals: Rose badge with up-right arrow.
     - Charges/Fees: Amber badge.
- **Expected Results**:
  - Dates format in Indian locale (`01 Apr 2026`).
  - Amounts display signed notation (`+₹1,50,000.00` for deposits; `-₹37,500.00` for buys).
- **Status**: ✅ **PASSED**

---

### TC-P3-004: Category Filter Pills & Description Search
- **Objective**: Verify responsive filtering by transaction category and keyword search.
- **Test Steps**:
  1. Click the **Inflow** pill in the table header.
     - **Result**: Table displays only Deposits, Dividends, and Sells.
  2. Click the **Trades** pill.
     - **Result**: Table displays only Buy and Sell orders.
  3. Click **All** to restore full list.
  4. In the search box, type `Dividend`.
     - **Result**: Table filters down to dividend events (TCS, SGB).
- **Expected Results**:
  - Filter pills and search operate with zero delay.
- **Status**: ✅ **PASSED**

---

### TC-P3-005: Record Transaction Modal (Inflow, Outflow & Trade Logging)
- **Objective**: Verify that adding a new transaction calculates values in integer paise and links to assets.
- **Test Steps**:
  1. Click **+ Record Transaction** in the top right.
  2. Select type: **Dividend / Interest (Inflow)**.
  3. Enter custom asset name: `Infosys Ltd` (Ticker: `INFY`).
  4. Enter amount: `6500.00` (₹6,500.00).
  5. Enter notes: `Interim dividend credited`.
  6. Click **Save Transaction**.
- **Expected Results**:
  - Modal closes smoothly.
  - `Infosys Ltd` (`INFY`) appears at the top of the audit table with an emerald `Dividend` badge and `+₹6,500.00`.
  - **Total Inflows** and **Net Cashflow** increase by `₹6,500.00`.
- **Status**: ✅ **PASSED**

---

### TC-P3-006: Transaction Deletion & Balance Recalculation
- **Objective**: Verify that deleting a transaction updates net cashflow metrics dynamically.
- **Test Steps**:
  1. In the audit table, locate the `fee` charge transaction (`₹185.00`).
  2. Click the red **trash can icon**.
  3. Confirm the browser prompt.
- **Expected Results**:
  - Row is removed from the audit table.
  - **Total Outflows** decreases by `₹185.00`.
  - **Net Cashflow** recalculates in real time.
- **Status**: ✅ **PASSED**

---

### TC-P3-007: Supabase Authentication & Real Database Persistence
- **Objective**: Verify that authenticated users persist transactions to the PostgreSQL `transactions` table.
- **Test Steps**:
  1. Sign in via [http://wealthnest.local](http://wealthnest.local) with `investor@wealthnest.local`.
  2. Navigate to [http://wealthnest.local/transactions](http://wealthnest.local/transactions).
  3. Observe the header badge: verify it reads **`Database Active`** (green).
  4. If empty, click **Seed Starter Transactions** or click **+ Record Transaction**.
  5. Refresh the page (`F5`).
- **Expected Results**:
  - Data persists across browser refreshes from PostgreSQL.
  - Row-Level Security (RLS) ensures only the signed-in user's transactions are visible.
- **Status**: ✅ **PASSED**

---

### TC-P3-008: Database Verification in Supabase Studio
- **Objective**: Verify that stored transaction records in PostgreSQL contain exact integer paise.
- **URL**: [http://localhost:54323](http://localhost:54323)
- **Test Steps**:
  1. Open Supabase Studio -> **Table Editor**.
  2. Click `transactions`:
     - Verify: `amount_cents` stores BigInt paise (e.g. ₹1,50,000.00 is stored as `15000000`).
     - Verify: `currency` is `'INR'`.
     - Verify: `type` matches the recorded enum.
- **Expected Results**:
  - Records match the frontend audit table exactly.
- **Status**: ✅ **PASSED**

---

### TC-P3-009: Automated Regression & Build Suite
- **Objective**: Verify that the entire monorepo builds cleanly and passes all test suites.
- **Test Commands**:
  ```bash
  # 1. Monorepo TypeScript check
  docker exec wealthnest-web-dev npm run type-check

  # 2. Automated Vitest suite across all 4 workspaces
  docker exec wealthnest-web-dev npm test

  # 3. Production Vite bundle build
  docker exec wealthnest-web-dev npm run build
  ```
- **Expected Results**:
  - `type-check`: Code `0`, zero compiler errors.
  - `test`: **23 passed tests** (Web: 3, Application: 5, Domain: 13, Shared: 2).
  - `build`: Production bundle generated cleanly in under 10 seconds.
- **Status**: ✅ **PASSED**
