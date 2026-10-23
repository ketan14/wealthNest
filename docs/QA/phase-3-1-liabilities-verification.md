# QA Test Plan: Phase 3.1 & Loans — Liabilities & Debt Service Verification

This document defines the formal Quality Assurance test cases for **Phase 3.1: Loans & Liabilities Engine** (`/liabilities`) of WealthNest, covering home mortgages, vehicle loans, personal credit lines, EMI calculations, property collateral linking, Loan-To-Value (LTV) monitoring, and true Net Worth reconciliation with **India-First architecture** (`₹ INR`, Lakhs/Crores formatting).

---

## 🎯 Scope & Objectives
Validate that:
1. The Loans & Liabilities module is fully operational at `/liabilities`.
2. Total Outstanding Debt accurately aggregates all active loan balances in integer paise with zero floating-point drift.
3. Monthly EMI Commitment accurately calculates total monthly cash outflow required to service active obligations.
4. Debt-To-Assets Ratio and True Net Worth accurately offset gross portfolio assets with outstanding liabilities ($NetWorth = GrossAssets - TotalDebt$).
5. Property Equity & Loan-To-Value (LTV) section calculates net equity ($HomeEquity = PropertyValuation - MortgageBalance$) and flags underwater/negative equity when $LTV > 100\%$.
6. The loan portfolio table renders loans with bank/lender names (e.g. State Bank of India, HDFC Bank), interest rates, floating/fixed rate badges, and account numbers.
7. Filtering between `Active`, `Closed`, and `All` loans functions smoothly.
8. The Add Loan / Liability Modal opens, validates inputs, and triggers creation with collateral asset linkage.

---

## 🧪 Test Cases

### TC-LIA-001: Liabilities Dashboard KPIs & Solvency Status
- **Objective**: Verify that the top 4 debt KPI cards render accurate aggregate figures in Indian Rupee format.
- **URL**: [http://wealthnest.local/liabilities](http://wealthnest.local/liabilities)
- **Preconditions**: Web app is running.
- **Test Steps**:
  1. Navigate to [http://wealthnest.local/liabilities](http://wealthnest.local/liabilities) or click **Loans & Liabilities** in the sidebar.
  2. Inspect the 4 KPI cards:
     - **Total Outstanding Debt**: Total active loan principal sum (e.g. `₹49,75,000`).
     - **Monthly EMI Commitment**: Total monthly EMI servicing obligation (e.g. `₹73,731`).
     - **Debt-To-Assets Ratio**: Percentage of debt relative to asset base with health badge (`Conservative` $\le 30\%$, `Moderate` $\le 50\%$, `High Leverage` $> 50\%$).
     - **True Net Worth**: Net wealth remaining after deducting debt obligations.
- **Expected Results**:
  - All 4 cards render with proper currency symbols and formatted values.
  - Active loan count subtitle reflects active records.
- **Status**: ✅ **PASSED**

---

### TC-LIA-002: Property Collateral Linking & LTV Analysis
- **Objective**: Verify property valuation offsetting, net home equity, and LTV ratio calculations.
- **Test Steps**:
  1. Review the **Property Equity & Loan-To-Value (LTV)** section.
  2. Inspect the collateral card (e.g. `3BHK Apartment - Bengaluru`).
  3. Verify the 3 sub-metrics: Property Value (`₹85,00,000`), Secured Debt (`₹41,25,000`), Net Home Equity (`₹43,75,000`).
  4. Inspect the LTV progress bar and percentage badge.
- **Expected Results**:
  - Net home equity equals Property Value minus Secured Debt.
  - LTV bar displays $48.5\%$ with emerald status (within typical Indian bank 80% ceiling).
  - Secured loans list under collateral identifies the linked mortgage.
- **Status**: ✅ **PASSED**

---

### TC-LIA-003: Loan Table Filtering & Institution Details
- **Objective**: Verify loan portfolio table renders with institutional metadata and filter tabs.
- **Test Steps**:
  1. Inspect the **Loan Portfolio & Balances** table.
  2. Verify records: `SBI Green Home Loan` (`State Bank of India`) and `HDFC EV Auto Loan` (`HDFC Bank`).
  3. Click the filter button **Closed (0)**.
  4. Click the filter button **Active (2)**.
- **Expected Results**:
  - Active loans display with loan type badge (`Home loan`, `Vehicle loan`), principal, current balance, interest rate, and EMI.
  - Switching to `Closed` filters the view and displays closed loan status or empty state message.
  - Switching to `Active` restores active records.
- **Status**: ✅ **PASSED**

---

### TC-LIA-004: Add Loan / Liability Modal Interaction
- **Objective**: Verify that user can open the Add Loan modal and select loan archetypes.
- **Test Steps**:
  1. Click the primary **Add Loan / Liability** button.
  2. Verify the modal dialog titled **Add New Loan / Liability** appears.
  3. Verify loan type selector includes Indian archetypes: Home Loan, Vehicle / Auto Loan, Personal Loan, Education Loan, Gold Loan, Business / MSME Loan, Credit Card.
  4. Click the **Cancel** button.
- **Expected Results**:
  - Modal opens cleanly with backdrop blur.
  - Form fields include Loan Name, Lender, Principal (₹), Current Balance (₹), Interest Rate (%), Interest Type (Floating/Fixed), EMI (₹), and Collateral asset dropdown.
  - Clicking Cancel closes the modal and returns focus to dashboard.
- **Status**: ✅ **PASSED**

---

## 📊 Summary of Execution
| Module | Total Tests | Passed | Failed | Status |
|---|---|---|---|---|
| Debt KPI Cards & Solvency | 1 | 1 | 0 | ✅ PASSED |
| Property Collateral & LTV | 1 | 1 | 0 | ✅ PASSED |
| Loan Portfolio Table & Filters | 1 | 1 | 0 | ✅ PASSED |
| Add Loan Modal Interaction | 1 | 1 | 0 | ✅ PASSED |
| **Total** | **4** | **4** | **0** | **✅ 100% PASSED** |
