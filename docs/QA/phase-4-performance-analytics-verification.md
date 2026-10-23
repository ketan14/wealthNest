# QA Test Plan: Phase 4 — Performance & Wealth Analytics

This document defines the formal Quality Assurance test cases for **Phase 4** of WealthNest, covering institutional return mathematics (XIRR, CAGR), benchmark comparisons (Nifty 50 TRI, Sensex, Sovereign Gold, SBI FD), asset allocation drift, and rebalancing recommendations with **India-First architecture** (`₹ INR`, Lakhs/Crores formatting).

---

## 🎯 Scope & Objectives
Validate that:
1. The Performance & Wealth Analytics module is fully operational at `/analytics`.
2. Portfolio **XIRR (Extended Internal Rate of Return)** calculates accurately using the pure domain Newton-Raphson cash flow solver with zero float drift.
3. **Compound Annual Growth Rate (CAGR)** and net capital gains render with compact Lakh badges (`+₹ L`).
4. **Benchmark Alpha** measures excess return vs India's premier equity index (**Nifty 50 TRI**).
5. The **Portfolio Trajectory & Capital Growth Timeline** renders an interactive SVG area/line chart comparing Current Portfolio Value, Invested Capital (Cost Basis), and Benchmark across timeframes (`1M`, `6M`, `1Y`, `ALL`).
6. The **Asset Allocation Drift & Rebalancing Radar** evaluates current vs target allocations across model portfolios (**Aggressive**, **Balanced**, **Conservative**) and provides actionable Buy/Trim recommendations.
7. **Concentration Risk Scoring** alerts users when any single asset or top 3 assets represent excessive portfolio weight.

---

## 🧪 Test Cases

### TC-P4-001: Analytics Page Rendering & KPI Cards
- **Objective**: Verify that the analytics dashboard loads with accurate Indian Rupee metrics and branding.
- **URL**: [http://wealthnest.local/analytics](http://wealthnest.local/analytics)
- **Preconditions**: Web app is running.
- **Test Steps**:
  1. Navigate to [http://wealthnest.local/analytics](http://wealthnest.local/analytics) (or click **Analytics** in the sidebar).
  2. Inspect the page header.
  3. Inspect the top 4 KPI cards.
- **Expected Results**:
  - Page header displays badges: `Phase 4: Wealth & Performance Analytics`, `India First (₹ INR)`, and `Demo Portfolio` (or `Live PostgreSQL Data` if authenticated).
  - Top 4 cards render:
    - **Portfolio XIRR**: Formatted annual percentage (e.g. `+18.4%` in emerald) with `Annualized` badge.
    - **Total Return & CAGR**: Cumulative percentage gain and point-to-point CAGR (e.g. `+24.00%` and `CAGR 15.3%`).
    - **Benchmark Alpha**: Signed alpha spread vs Nifty 50 TRI (`+4.20%` emerald badge).
    - **Diversification Score**: Score out of 100 with risk level badge (`Low Risk`, `Moderate`, or `High Risk`) and top asset weight.
- **Status**: ✅ **PASSED**

---

### TC-P4-002: Model Strategy Selector (Aggressive, Balanced, Conservative)
- **Objective**: Verify that switching allocation models dynamically updates target percentages and rebalancing calculations.
- **Test Steps**:
  1. In the top right header, click **Aggressive (75/15)**.
  2. Observe the **Asset Allocation Drift & Rebalancing** card:
     - Target equity percentage updates to `75%`.
     - Target debt percentage updates to `15%`.
  3. Click **Conservative (30/50)**:
     - Target equity updates to `30%` and debt updates to `50%`.
  4. Click **Balanced (55/30)** to restore the baseline balanced model.
- **Expected Results**:
  - Model transitions occur instantaneously without full page reload.
  - Rebalance amounts recalculate in exact integer paise (`₹`).
- **Status**: ✅ **PASSED**

---

### TC-P4-003: Interactive Wealth Trajectory Chart & Tooltip
- **Objective**: Verify that the trajectory SVG area chart renders historical points and interactive hover tooltips.
- **Test Steps**:
  1. Inspect the **Portfolio Trajectory & Capital Growth Timeline** area chart.
  2. Hover over any point on the emerald line.
  3. Inspect the active KPI tooltip bar above the chart.
  4. Click timeframe filters: `1M`, `6M`, `1Y`, `ALL`.
- **Expected Results**:
  - Tooltip displays the hovered date, exact Portfolio Value (`₹ L`), Invested Capital, and Benchmark value.
  - Emerald line displays current valuation, dashed line displays invested capital, and green gradient provides smooth area shading.
  - Timeframe filter updates the number of visible points smoothly.
- **Status**: ✅ **PASSED**

---

### TC-P4-004: Indian Market Benchmarks Comparison & Outperformance
- **Objective**: Verify comparative performance analysis against standard Indian benchmarks.
- **Test Steps**:
  1. Locate the **Indian Market Benchmarks & Alpha** card.
  2. Verify listed benchmarks:
     - **Nifty 50 TRI** (`14.2%`)
     - **BSE Sensex** (`13.8%`)
     - **Sovereign Gold (SGB)** (`12.4%`)
     - **SBI 1-Yr Fixed Deposit** (`7.1%`)
     - **Public Provident Fund (PPF)** (`7.1%`)
  3. Verify alpha tags render signed outperformance margins (`+X.X% Alpha`).
- **Expected Results**:
  - Progress bars scale proportionally to annualized return percentages.
  - Outperforming benchmarks show emerald badges.
- **Status**: ✅ **PASSED**

---

### TC-P4-005: Asset Allocation Drift & Rebalancing Recommendations
- **Objective**: Verify that asset class drifts calculate buy/trim actions with exact Indian Rupee amounts.
- **Test Steps**:
  1. Review the **Asset Allocation Drift & Rebalancing** rows.
  2. For underweight asset classes, verify blue badge reading `Buy +₹X.XX L`.
  3. For overweight asset classes, verify amber badge reading `Trim -₹X.XX L`.
  4. For asset classes within 1% of target, verify emerald `Balanced / Optimal Allocation` indicator.
- **Expected Results**:
  - Rebalancing amounts match the mathematical difference between target and current values.
- **Status**: ✅ **PASSED**

---

### TC-P4-006: Concentration Risk Advisory Alert
- **Objective**: Verify institutional concentration advisory warnings for top asset exposure.
- **Test Steps**:
  1. Inspect the bottom of the page when top holding exceeds 25-30% of total portfolio value.
  2. Review the **Institutional Concentration Advisory** banner.
- **Expected Results**:
  - Banner highlights the name of the dominant asset and its exact percentage.
  - Recommends diversification into debt or index funds to smooth out drawdowns.
- **Status**: ✅ **PASSED**

---

### TC-P4-007: Automated Monorepo Verification & Test Suite
- **Objective**: Verify that the entire monorepo builds cleanly and passes all Vitest test suites.
- **Test Commands**:
  ```bash
  # 1. Monorepo TypeScript check
  docker exec wealthnest-web-dev npm run type-check

  # 2. Automated Vitest suite across all workspaces
  docker exec wealthnest-web-dev npm test

  # 3. Production Vite bundle build
  docker exec wealthnest-web-dev npm run build
  ```
- **Expected Results**:
  - `type-check`: Code `0`, zero compiler errors.
  - `test`: All unit and component tests pass cleanly.
  - `build`: Production bundle generated without warnings or bundle failures.
- **Status**: ✅ **PASSED**
