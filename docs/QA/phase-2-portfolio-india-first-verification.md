# QA Test Plan: Phase 2 — Portfolio Dashboard & India-First Architecture

This document defines the formal Quality Assurance test cases for **Phase 2** of WealthNest, including the **India-First architecture** (`₹ INR`, Lakhs/Crores formatting, and Indian investment instruments).

---

## 🎯 Scope & Objectives
Validate that:
1. The portfolio dashboard is fully operational at `/portfolio`.
2. Indian Rupee (`₹ INR`) is the default primary currency across domain models, calculations, and UI.
3. The Indian numbering system (`en-IN`) correctly formats values with commas (`₹32,58,500.00`) and displays compact Lakh (`₹32.59 L`) / Crore (`Cr`) badges.
4. The segmented Asset Class Allocation bar correctly displays percentage distributions with custom taxonomy colors.
5. Filtering by asset class and searching by NSE ticker work responsively in real time.
6. The Add Holding Modal accurately captures asset positions and converts Rupee inputs into integer paise (`bigint`).
7. Real user positions persist into PostgreSQL tables (`assets`, `holdings`) when signed in.

---

## 🧪 Test Cases

### TC-P2-001: Portfolio Dashboard Rendering & India-First Branding
- **Objective**: Verify that the portfolio dashboard loads with India-First currency badges and metrics.
- **URL**: [http://wealthnest.local/portfolio](http://wealthnest.local/portfolio)
- **Preconditions**: Web app is running.
- **Test Steps**:
  1. Navigate to [http://wealthnest.local/portfolio](http://wealthnest.local/portfolio).
  2. Inspect the page header.
  3. Inspect the top 4 KPI cards.
- **Expected Results**:
  - Page header displays badge: `India First (₹ INR)`.
  - Top 4 cards render:
    - **Total Portfolio Value**: Formatted in `₹` (e.g. `₹32,58,500.00`).
    - **Total Cost Basis**: Formatted in `₹` (e.g. `₹30,92,000.00`).
    - **Unrealized Profit/Loss**: Green indicator with positive yield (e.g. `+₹1,66,500.00 (+5.39%)`).
    - **Asset Diversity**: Displays count of active positions and Indian asset categories.
- **Status**: ✅ **PASSED**

---

### TC-P2-002: Indian Numbering System (`en-IN`) & Lakh / Crore Badges
- **Objective**: Verify that currency numbers adhere to Indian comma grouping (2, 2, 3) rather than Western (3, 3, 3), and compact badges display correct L/Cr denominations.
- **Test Steps**:
  1. Review the **Total Portfolio Value** card.
  2. Review the compact denomination pill below the total.
  3. Review the **Total Cost Basis** card.
- **Expected Results**:
  - Total value displays as `₹32,58,500.00` (comma after 32 Lakhs, then 58 Thousands), NOT `₹3,258,500.00`.
  - Compact denomination pill reads `₹32.59 L` (or `₹1.50 Cr` when total exceeds 1 Crore).
  - Total cost basis reads `₹30.92 L`.
- **Status**: ✅ **PASSED**

---

### TC-P2-003: Asset Class Allocation Bar & Filter Pills
- **Objective**: Verify visual proportion breakdown and interactive asset class filtering.
- **Test Steps**:
  1. Inspect the segmented multi-color progress bar under **Asset Class Allocation (India Taxonomy)**.
  2. Hover over any color segment (e.g., blue for Equities, gold for SGB, purple for Fixed Income).
  3. Click the **Equities & Mutual Funds** pill below the bar.
  4. Click **Clear Filter**.
- **Expected Results**:
  - The bar segments match the exact percentage proportions of the portfolio.
  - Clicking the Equities pill filters the holdings table below to show only equity positions (`Reliance`, `Nifty 50 ETF`, `TCS`).
  - Clicking **Clear Filter** restores all holdings immediately.
- **Status**: ✅ **PASSED**

---

### TC-P2-004: Interactive Search by Name and NSE Ticker
- **Objective**: Verify responsive table search by asset name and NSE ticker symbol.
- **Test Steps**:
  1. In the search box labeled *"Filter asset or ticker..."*, type `RELIANCE`.
  2. Clear the box and type `SGB`.
  3. Clear the box.
- **Expected Results**:
  - Typing `RELIANCE` filters the table to only show *Reliance Industries Ltd*.
  - Typing `SGB` filters to show *Sovereign Gold Bond 2028*.
  - Clearing restores all 8 pre-seeded Indian positions.
- **Status**: ✅ **PASSED**

---

### TC-P2-005: Add Position Modal with Integer Paise Precision
- **Objective**: Verify that adding a new position computes values in integer paise without floating-point error.
- **Test Steps**:
  1. Click **+ Add Holding** in the top right.
  2. Enter the following test data:
     - **Asset Name**: `HDFC Bank Ltd`
     - **Ticker Symbol**: `HDFCBANK`
     - **Asset Class**: `Equities & Mutual Funds`
     - **Quantity**: `50`
     - **Unit Cost (INR ₹)**: `1600.00`
     - **Current Total Value (INR ₹)**: `88000.00`
  3. Click **Save Holding**.
- **Expected Results**:
  - Modal closes without errors.
  - `HDFC Bank Ltd` appears in the holdings table with `HDFCBANK` ticker badge.
  - Cost basis displays as `₹80,000.00` (`₹1,600.00/u`).
  - Current value displays as `₹88,000.00`.
  - Gain/loss displays as `+₹8,000.00 (+10.00%)`.
  - Total Portfolio Value increases by `₹88,000.00`.
- **Status**: ✅ **PASSED**

---

### TC-P2-006: Position Deletion & Dynamic Recalculation
- **Objective**: Verify that deleting a holding triggers dynamic pure-domain recalculation.
- **Test Steps**:
  1. In the holdings table, locate `Embassy Office Parks REIT`.
  2. Click the red **trash can icon**.
  3. Confirm the browser prompt.
- **Expected Results**:
  - The holding is removed from the table.
  - The Total Portfolio Value, Total Cost Basis, and Unrealized Return recalculate instantly.
  - The Real Estate segment in the allocation bar is removed.
- **Status**: ✅ **PASSED**

---

### TC-P2-007: Supabase Authentication & Real Database Persistence
- **Objective**: Verify that authenticated users persist their holdings to PostgreSQL rather than demo memory.
- **Test Steps**:
  1. Navigate to [http://wealthnest.local](http://wealthnest.local) and sign in with `investor@wealthnest.local`.
  2. Navigate back to [http://wealthnest.local/portfolio](http://wealthnest.local/portfolio).
  3. Observe the header badge.
  4. If the portfolio is empty, click **Seed 4 Starter Assets** or click **+ Add Holding** to add a real position.
  5. Refresh the page (`F5`).
- **Expected Results**:
  - Header badge displays **`Database Active`** (green).
  - Positions are queried directly from the PostgreSQL `holdings` and `assets` tables.
  - Positions remain intact after browser refresh (persisted across sessions).
- **Status**: ✅ **PASSED**

---

### TC-P2-008: Database Verification in Supabase Studio
- **Objective**: Verify that stored records in PostgreSQL contain exact integer paise.
- **URL**: [http://localhost:54323](http://localhost:54323)
- **Test Steps**:
  1. Open Supabase Studio -> **Table Editor**.
  2. Select `assets`: verify `currency` is `'INR'` and `name` matches the user's positions.
  3. Select `holdings`: verify `unit_cost_cents` and `current_value_cents` store BigInt paise values (e.g. ₹2,500.00 is stored as `250000`).
- **Expected Results**:
  - All foreign keys (`asset_id`, `user_id`, `asset_class_id`) are intact.
  - No floating-point values are present in currency columns.
- **Status**: ✅ **PASSED**

---

### TC-P2-009: Automated Regression & Build Suite
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
  - `test`: **16 passed tests** (Web: 2, Application: 3, Domain: 9, Shared: 2).
  - `build`: Production bundle generated cleanly in under 10 seconds.
- **Status**: ✅ **PASSED**
