# QA Test Plan: Phase 5 — Financial Goals & Milestones

This document defines the formal Quality Assurance test cases for **Phase 5** of WealthNest, covering financial goals, inflation-adjusted target corpus mathematics, required monthly SIP calculations, emergency fund runway analysis, and milestone tracking with **India-First architecture** (`₹ INR`, Lakhs/Crores formatting).

---

## 🎯 Scope & Objectives
Validate that:
1. The Goals & Milestones module is fully operational at `/goals`.
2. Emergency Fund Runway calculates accurately based on liquid cash reserves divided by simulated monthly living expenses (with 3-month and 6-month buffer thresholds).
3. Inflation-adjusted future target corpus values calculate using compound inflation ($FV = PV \times (1 + r)^n$).
4. Required Monthly SIP is reverse-calculated from remaining corpus gap, tenure months, and expected annual return rate.
5. Goal health status badges dynamically reflect progress (`Achieved`, `Ahead`, `On Track`, `Behind`, `Critical`).
6. The Create Goal Modal allows users to select archetypes (Emergency Fund, Retirement, Home Down Payment, Child Education, Vehicle, Vacation), adjust return and inflation sliders, and save positions.
7. Authenticated users persist goals into the PostgreSQL `goals` table with RLS tenant isolation.

---

## 🧪 Test Cases

### TC-P5-001: Goals Dashboard Rendering & Top KPIs
- **Objective**: Verify that the goals dashboard loads with accurate Indian Rupee metrics and emergency buffer status.
- **URL**: [http://wealthnest.local/goals](http://wealthnest.local/goals)
- **Preconditions**: Web app is running.
- **Test Steps**:
  1. Navigate to [http://wealthnest.local/goals](http://wealthnest.local/goals) (or click **Goals & Targets** in the sidebar).
  2. Inspect the top 4 KPI cards.
- **Expected Results**:
  - Top 4 cards render:
    - **Emergency Runway**: Months of living expenses covered (e.g. `5.4 Mos`) with badge `Optimal Buffer` or `Action Needed`.
    - **Target Corpus Sum**: Total future value sum formatted in Indian Lakhs/Crores (`₹2.95 Cr`).
    - **Accumulated Corpus**: Total currently funded savings (`₹53.00 L` with percentage funded).
    - **Committed Monthly SIP**: Total monthly contribution (`₹85,000/m`) with count of goals on track.
- **Status**: ✅ **PASSED**

---

### TC-P5-002: Emergency Reserve Buffer & Burn Rate Analyzer
- **Objective**: Verify dynamic recalculation of emergency runway when adjusting household monthly burn rate.
- **Test Steps**:
  1. Review the **Emergency Reserve Buffer & Burn Rate Analyzer** card.
  2. Note current runway months at default ₹65,000/mo.
  3. Drag the monthly expense slider to ₹1,00,000/mo.
- **Expected Results**:
  - The monthly living expense badge updates in real time.
  - The 6-month target corpus recalculates to ₹6.00 Lakh.
  - Runway months decrease proportionally (e.g. from 6.2 months down to 4.0 months).
  - Progress bar dynamically adjusts width.
- **Status**: ✅ **PASSED**

---

### TC-P5-003: Active Financial Milestones & Category Archetypes
- **Objective**: Verify that goal cards display category icons, countdowns, progress bars, and required SIPs.
- **Test Steps**:
  1. Review the milestone cards:
     - **Emergency Reserve Fund**: Emerald `Achieved` badge, 100% funded.
     - **Retirement & FIRE**: Target `₹2.50 Cr`, monthly committed vs required SIP.
     - **Apartment Down Payment**: Target `₹40 Lakh`, 3.5-year countdown.
     - **Child Higher Education**: Higher inflation factor (8.5% p.a.).
  2. Verify countdown text ("X mos remaining").
- **Expected Results**:
  - Category icons render appropriately (Shield, Target, Building, GraduationCap).
  - Progress bars reflect accumulated vs target corpus.
- **Status**: ✅ **PASSED**

---

### TC-P5-004: Create Goal Modal (Inflation & SIP Calculation)
- **Objective**: Verify that creating a goal calculates future corpus and committed contributions.
- **Test Steps**:
  1. Click **Create Financial Goal** in top right.
  2. Select category archetype: **Vehicle Purchase**.
  3. Enter Goal Name: `Tata Harrier EV Down Payment`.
  4. Enter Target Corpus: `800000` (₹8,00,000).
  5. Select Target Date: 2 years in the future.
  6. Enter Committed Monthly SIP: `25000` (₹25,000).
  7. Click **Save Financial Goal**.
- **Expected Results**:
  - Modal closes smoothly.
  - New goal card appears in the grid with a Car icon.
  - Total Target Corpus and Monthly Committed SIP increase.
- **Status**: ✅ **PASSED**

---

### TC-P5-005: Goal Deletion & Recalculation
- **Objective**: Verify that deleting a goal removes the card and recalculates total corpus metrics.
- **Test Steps**:
  1. On any goal card, click the trash can icon.
  2. Confirm browser prompt.
- **Expected Results**:
  - Card is removed from grid.
  - Target Corpus Sum and Monthly Committed SIP decrease accordingly.
- **Status**: ✅ **PASSED**

---

### TC-P5-006: Automated Monorepo Verification & Test Suite
- **Objective**: Verify that the entire monorepo builds cleanly and passes all Vitest test suites.
- **Test Commands**:
  ```bash
  # 1. Monorepo TypeScript check
  npm run type-check

  # 2. Automated Vitest suite across all workspaces
  npm test

  # 3. Production Vite bundle build
  npm run build
  ```
- **Expected Results**:
  - `type-check`: Code `0`, zero compiler errors.
  - `test`: All unit and component tests pass cleanly.
  - `build`: Production bundle generated cleanly.
- **Status**: ✅ **PASSED**
