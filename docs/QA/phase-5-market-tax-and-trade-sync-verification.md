# QA Test Plan: Phase 5 — Automated Market Feeds, Budget 2024 Tax Intelligence & Trade Sync

This document defines the formal Quality Assurance test cases for **Phase 5** of WealthNest, covering:
1. **Phase 5A: Automated Live Market Feeds** (AMFI NAV feed parsing, ISIN/Scheme Code matching, real-time quote refresh).
2. **Phase 5B: India Capital Gains & Tax-Loss Harvesting Engine** (Union Budget 2024 rules: Section 112A equity LTCG with ₹1.25 Lakh exemption @ 12.5%, STCG @ 20%, and potential tax savings).
3. **Phase 5C: Portfolio-Transaction Synchronization** (Weighted average cost basis calculation on Buy, inventory deduction and realized gain/loss calculation on Sell).

---

## 🎯 Scope & Objectives
Validate that:
1. AMFI Daily NAV feed (`NAVAll.txt`) is parsed cleanly into typed records indexed by Scheme Code and ISIN with zero float drift (`navPaise` integer math).
2. The **Portfolio Dashboard** (`/portfolio`) provides a dedicated "Refresh AMFI NAVs" action and displays real-time price synchronization notifications.
3. The **Analytics Dashboard** (`/analytics`) features a dedicated **Union Budget 2024 Tax Intelligence & Loss Harvesting** card detailing FY 2025-26 LTCG, STCG, Section 112A exemption, and harvestable loss savings.
4. Recording a `buy` or `sell` trade in **Transactions & Cashflow** (`/transactions`) dynamically recalculates holding inventory, adjusts weighted average cost basis, and logs realized P&L tags (`[Realized Gain: ₹...]`).
5. All financial calculations guarantee integer paise accuracy via the `Money` Value Object.

---

## 🧪 Test Cases

### TC-P5-001: AMFI Daily NAV Feed Parsing & ISIN Lookup
- **Objective**: Verify that semicolon-delimited AMFI NAV feeds parse correctly without floating-point errors.
- **Preconditions**: `@wealthnest/domain` unit test suite is executable.
- **Test Steps**:
  1. Feed sample semicolon-delimited AMFI NAV records (including Mirae Asset Large Cap, Parag Parikh Flexi Cap) into `parseAmfiNavFeed`.
  2. Perform lookup using `matchHoldingToAmfiNav` by ISIN (`INF769K01010`) and Scheme Code (`118834`).
  3. Verify NAV paise integer precision.
- **Expected Results**:
  - `parseAmfiNavFeed` correctly populates lookup map indexing both Scheme Code and ISIN.
  - NAV value `112.45` is stored as `11245n` paise (`BigInt`).
  - Unit tests in `packages/domain/src/__tests__/amfi-nav.test.ts` pass cleanly.
- **Status**: ✅ **PASSED**

---

### TC-P5-002: Portfolio Real-Time NAV Refresh
- **Objective**: Verify that user can trigger AMFI NAV refresh from the Portfolio UI.
- **URL**: [http://wealthnest.local/portfolio](http://wealthnest.local/portfolio)
- **Preconditions**: Web app running at `/portfolio`.
- **Test Steps**:
  1. Navigate to `/portfolio`.
  2. Locate the **Refresh AMFI NAVs** button in the header actions bar.
  3. Click **Refresh AMFI NAVs**.
- **Expected Results**:
  - Button transitions to loading state ("Syncing NAVs...").
  - On completion, a green banner confirms successful synchronization of live mutual fund valuations.
  - Portfolio holdings reflect updated valuations and timestamps.
- **Status**: ✅ **PASSED**

---

### TC-P5-003: Union Budget 2024 Capital Gains Math & Section 112A Exemption
- **Objective**: Verify calculation of Equity LTCG (12.5% over ₹1.25 Lakh) and STCG (20%) under Budget 2024.
- **Preconditions**: `@wealthnest/domain` unit tests executable.
- **Test Steps**:
  1. Create test portfolio with 1 Long-Term gain holding (> 365 days) with ₹2,00,000 gain.
  2. Create 1 Short-Term gain holding (< 365 days) with ₹50,000 gain.
  3. Run `calculateCapitalGainsTaxSummary`.
- **Expected Results**:
  - Gross LTCG: `₹2,00,000.00`.
  - Section 112A Exemption: `₹1,25,000.00`.
  - Taxable LTCG: `₹75,000.00` ($2,00,000 - 1,25,000$).
  - Estimated LTCG Tax: `₹9,375.00` ($75,000 \times 12.5\%$).
  - Estimated STCG Tax: `₹10,000.00` ($50,000 \times 20\%$).
  - Total Estimated Tax: `₹19,375.00`.
  - Domain tests in `packages/domain/src/__tests__/capital-gains.test.ts` pass.
- **Status**: ✅ **PASSED**

---

### TC-P5-004: Tax-Loss Harvesting Assistant in Analytics Dashboard
- **Objective**: Verify that the Analytics page displays unrealized losses and harvestable tax offsets.
- **URL**: [http://wealthnest.local/analytics](http://wealthnest.local/analytics)
- **Preconditions**: Web app running at `/analytics`.
- **Test Steps**:
  1. Navigate to `/analytics`.
  2. Scroll down to the **Union Budget 2024 Tax Intelligence & Loss Harvesting** card.
  3. Verify the 4 KPI badges:
     - **Estimated Tax (FY 2025-26)**: Calculated LTCG + STCG liability.
     - **Net Long-Term Gains (LTCG)**: Gains with `Section 112A: ₹1.25L Exempt` tag.
     - **Net Short-Term Gains (STCG)**: Gains taxed at flat 20%.
     - **Harvestable Loss Potential**: Loss amount and potential tax savings.
  4. Inspect individual holding tax status rows (showing holding period days, `Long Term` / `Short Term` badge, and tax impact).
- **Expected Results**:
  - Correct fiscal year (`FY 2025-26` or `FY 2026-27`) renders.
  - Tax-loss harvesting guidance clearly shows how booking losses before March 31 reduces net tax liability.
- **Status**: ✅ **PASSED**

---

### TC-P5-005: Trade Synchronization & Weighted Average Cost Basis on Buy
- **Objective**: Verify that executing an asset purchase automatically increases holding quantity and recalculates weighted average unit cost.
- **Test Steps**:
  1. Holding exists: 10 units @ ₹2,500 (total cost ₹25,000).
  2. User records a `buy` transaction: 5 units for ₹14,000 (unit ₹2,800).
  3. Execute `RecordTransactionUseCase` with holding repository.
- **Expected Results**:
  - Holding updated quantity: `15 units`.
  - New total cost: $25,000 + 14,000 = ₹39,000$.
  - New weighted average unit cost: $39,000 / 15 = ₹2,600$ (`260000` paise).
  - Test passes in `packages/application/src/__tests__/transaction-use-case.test.ts`.
- **Status**: ✅ **PASSED**

---

### TC-P5-006: Trade Synchronization & Realized Capital Gain on Sell
- **Objective**: Verify that selling an asset reduces holding quantity, preserves cost basis for remaining units, and annotates realized P&L.
- **Test Steps**:
  1. Holding exists: 10 units @ ₹2,500 (unit cost ₹2,500).
  2. User records a `sell` transaction: 4 units for ₹12,000.
  3. Cost basis of sold units: $4 \times ₹2,500 = ₹10,000$.
  4. Realized gain: $12,000 - 10,000 = +₹2,000$.
- **Expected Results**:
  - Remaining holding quantity: `6 units`.
  - Remaining holding unit cost: `₹2,500` (unchanged).
  - Transaction record notes include: `[Realized Gain: ₹2,000.00]`.
  - Test passes in `packages/application/src/__tests__/transaction-use-case.test.ts`.
- **Status**: ✅ **PASSED**

---

## 📊 Summary Matrix

| Test Case ID | Feature / Subsystem | Target Route | Result |
| :--- | :--- | :--- | :---: |
| **TC-P5-001** | AMFI NAV Parser & Lookup | Domain | ✅ PASSED |
| **TC-P5-002** | Live NAV Refresh Action | `/portfolio` | ✅ PASSED |
| **TC-P5-003** | Budget 2024 LTCG/STCG Math | Domain / App | ✅ PASSED |
| **TC-P5-004** | Tax Intelligence & Loss Harvesting UI | `/analytics` | ✅ PASSED |
| **TC-P5-005** | Buy Trade Weighted Avg Cost Sync | App / Web | ✅ PASSED |
| **TC-P5-006** | Sell Trade Inventory & Realized P&L Sync | App / Web | ✅ PASSED |
