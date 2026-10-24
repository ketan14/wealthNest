# QA Test Plan: Phase 6A — Multi-Demat & Family Portfolios Verification

This document defines the formal Quality Assurance test cases for **Phase 6A** of WealthNest, covering:
1. **Multi-Entity Legal Structure**: Self, Spouse, Hindu Undivided Family (HUF), Minor Children, and Parents with PAN linkage.
2. **Multi-Demat & Broker Accounts**: Zerodha Kite, Groww, ICICI Direct, CAMS Mutual Fund Folios, SBI PPF & Bank Folios.
3. **Consolidated Family Wealth & Allocation**: Aggregate household net worth, multi-colored entity distribution bars, and individual entity net worth breakdown.
4. **HUF Section 112A Tax Harvest Engine**: Tax segregation quantifying the separate ₹1,25,000 annual Long-Term Capital Gains exemption per legal PAN entity (saving ₹15,625/year in taxes).
5. **Cross-Module Scoping & Badges**: Dynamic entity and Demat account filtering across `/portfolio`, `/analytics`, `/transactions`, and `/settings`.

---

## 🎯 Scope & Objectives
Validate that:
1. Database schema migration 7 (`family_members`, `portfolio_accounts`, `holdings.member_id`, `transactions.member_id`) applies cleanly with Row-Level Security (RLS) tenant isolation.
2. The pure functional domain math (`packages/domain/src/family/`) accurately calculates total family wealth, entity weights, and HUF Section 112A tax shield advantages.
3. The **FamilyFilterBar** component renders combined family pills and entity-specific pills with distinct colors and relationship icons.
4. Selecting a family entity scopes holding tables, analytics calculations (XIRR, CAGR, Allocation), and transaction cashflow histories to that specific legal entity.
5. In **Transactions & Cashflow** (`/transactions`), new transactions can be explicitly assigned to a family member and Demat/MF account.
6. In **Settings** (`/settings`), the "Family & Demats" tab allows creating, editing, and deleting legal entities and Demat accounts.
7. Automated test suites in `packages/domain`, `packages/application`, and `apps/web` pass with 100% success.

---

## 🧪 Test Cases

### TC-P6A-001: Pure Domain Family Wealth & HUF Tax Shield Calculation
- **Objective**: Verify that `calculateFamilyPortfolioSummary` computes exact family wealth distribution and HUF Section 112A tax savings with zero floating-point drift.
- **Preconditions**: `@wealthnest/domain` test suite is executable.
- **Test Steps**:
  1. Define family members: Self (`mem-self`), Spouse (`mem-spouse`), and HUF (`mem-huf`).
  2. Define holdings with capital gains across Self (₹2,00,000 gain) and HUF (₹1,50,000 gain).
  3. Execute `calculateFamilyPortfolioSummary`.
- **Expected Results**:
  - `totalFamilyWealthPaise` matches the exact sum of all holding valuations.
  - Member distribution percentages total exactly 100%.
  - `hufTaxHarvestBenefitPaise` quantifies the HUF ₹1,25,000 exemption @ 12.5% tax rate = `₹15,625.00` (`1562500n` paise).
  - Unit tests in `packages/domain/src/__tests__/family-portfolio.test.ts` pass.
- **Status**: ✅ **PASSED**

---

### TC-P6A-002: Family Filter Bar & Entity Switching
- **Objective**: Verify that the top entity switcher pills allow instant filtering across household members.
- **URL**: [http://wealthnest.local/portfolio](http://wealthnest.local/portfolio)
- **Preconditions**: Web app running at `/portfolio`.
- **Test Steps**:
  1. Navigate to `/portfolio`.
  2. Observe the top entity switcher bar (`FamilyFilterBar`).
  3. Verify the existence of the `👨‍👩‍👧‍👦 Combined Family` pill.
  4. Verify the member pills: `Ketan Vaghela (Self)`, `Parul Vaghela (Spouse)`, `Krisha Vaghela (Child)`, `Shamalbhai Vaghela HUF (HUF PAN)`, `Ramilaben Vaghela (Mother)`.
  5. Click on `Shamalbhai Vaghela HUF`.
- **Expected Results**:
  - `Shamalbhai Vaghela HUF` pill highlights with active purple badge.
  - The Demat account dropdown automatically updates to only show accounts belonging to the HUF (`ICICI Direct HUF`).
  - Holdings table instantaneously filters to display only TCS (assigned to HUF).
  - Holdings belonging to Self (Reliance) or Spouse (Parag Parikh) disappear from the active view.
  - Clicking `Combined Family` restores all household holdings.
- **Status**: ✅ **PASSED**

---

### TC-P6A-003: Family Distribution Widget & HUF Section 112A Banner
- **Objective**: Verify that the Consolidated Family Wealth & HUF Tax Shield widget renders when viewing combined family net worth.
- **URL**: [http://wealthnest.local/portfolio](http://wealthnest.local/portfolio)
- **Preconditions**: Web app running with `selectedMemberId === 'all'`.
- **Test Steps**:
  1. Navigate to `/portfolio`.
  2. Ensure `Combined Family` is selected.
  3. Inspect the `FamilyDistributionWidget` card.
- **Expected Results**:
  - Total Family Wealth displays in Indian Lakh/Crore notation (`₹ L / Cr`).
  - Multi-segment allocation bar displays proportional entity colors.
  - Entity cards grid shows individual member wealth, percentage, and connected Demat count.
  - **HUF Section 112A Tax Shield Active** banner renders with Budget 2024 badge, explaining the ₹1.25 Lakh exemption and displaying `₹15,625 / year` annual tax advantage.
- **Status**: ✅ **PASSED**

---

### TC-P6A-004: Holdings Table Entity & Demat Badges
- **Objective**: Verify that each holding in the portfolio table shows its owning entity and broker badges.
- **URL**: [http://wealthnest.local/portfolio](http://wealthnest.local/portfolio)
- **Test Steps**:
  1. Navigate to `/portfolio` with `Combined Family` selected.
  2. Inspect the "Asset & Entity" column.
- **Expected Results**:
  - Reliance Industries displays `Ketan` entity pill (blue) and `Zerodha` broker badge.
  - Parag Parikh Flexi Cap displays `Parul` entity pill (pink) and `Groww` broker badge.
  - TCS displays `Shamalbhai HUF` entity pill (purple) and `ICICI Direct` broker badge.
- **Status**: ✅ **PASSED**

---

### TC-P6A-005: Analytics Dashboard Scoped Entity Intelligence
- **Objective**: Verify that the Analytics dashboard recomputes XIRR, CAGR, benchmark alpha, and Section 112A capital gains tax for the selected family member.
- **URL**: [http://wealthnest.local/analytics](http://wealthnest.local/analytics)
- **Test Steps**:
  1. Navigate to `/analytics`.
  2. Note the page header badge: `Combined Family Portfolio (4 Entities)`.
  3. Select `Shamalbhai Vaghela HUF` in the `FamilyFilterBar`.
- **Expected Results**:
  - Header badge switches to `Shamalbhai Vaghela HUF (HUF)`.
  - Portfolio performance metrics (XIRR, CAGR, benchmark alpha) recompute for HUF holdings.
  - Capital Gains Tax card displays `HUF Section 112A Exemption` with `Independent HUF PAN exemption` annotation.
- **Status**: ✅ **PASSED**

---

### TC-P6A-006: Transactions & Cashflow Audit Ledger Scoping & Badges
- **Objective**: Verify that the cashflow audit ledger filters by entity and supports entity/Demat assignment on new transaction entries.
- **URL**: [http://wealthnest.local/transactions](http://wealthnest.local/transactions)
- **Test Steps**:
  1. Navigate to `/transactions`.
  2. Observe entity badges on audit rows (`Ketan`, `Parul`, `Shamalbhai HUF`) and broker badges (`Zerodha`, `Groww`, `ICICI Direct`).
  3. Click `Shamalbhai Vaghela HUF` filter pill.
  4. Verify that Total Inflows, Total Outflows, and Net Cashflow recompute specifically for HUF transactions (TCS dividend).
  5. Click **Record Transaction**.
  6. Verify that the modal contains **Legal Entity / Member** dropdown and **Demat / Broker Account** dropdown.
  7. Fill in transaction details, select `Parul Vaghela (SPOUSE)` and `Groww / BoB Direct Demat`, and submit.
- **Expected Results**:
  - New transaction appears in the audit ledger with `Parul (Spouse)` and `Groww` badges.
  - Cashflow KPIs update automatically.
- **Status**: ✅ **PASSED**

---

### TC-P6A-007: Entity & Demat Account Management in Settings
- **Objective**: Verify that users can manage legal entities and Demat accounts via Settings.
- **URL**: [http://wealthnest.local/settings](http://wealthnest.local/settings)
- **Test Steps**:
  1. Navigate to `/settings`.
  2. Click on the **Family & Demats** tab.
  3. Verify the listing of Registered Family Entities and Connected Demat Accounts.
  4. Click **Manage Entities & Accounts**.
  5. In the modal, switch between the **Family Entities** tab and **Demat & Folio Accounts** tab.
  6. Click **Add Family Member or HUF Entity**, provide Name and Relationship, and save.
- **Expected Results**:
  - Modal opens and transitions smoothly without console errors.
  - Added member appears in the entity list and in the top `FamilyFilterBar`.
- **Status**: ✅ **PASSED**

---

### TC-P6A-008: Manual Holding & CAS PDF Import Entity & Demat Account Tagging
- **Objective**: Verify that both manual holding entry and automated CAS PDF imports allow selecting owning family entity and Demat account.
- **URL**: [http://wealthnest.local/portfolio](http://wealthnest.local/portfolio)
- **Test Steps**:
  1. Navigate to `/portfolio`.
  2. Click **Add Holding**: Observe "Legal Entity / Member" and "Demat / Broker / Folio" selectors populated with household members and scoped Demat accounts.
  3. Fill in asset details, select `Parul Vaghela (Spouse)` and `Groww / BoB Direct Demat`, and submit.
  4. Click **Import CAS PDF**: Load mock CDSL/NSDL statement fixture.
  5. In statement preview, verify the "Assign To Legal Entity / Member" and "Assign Demat / Broker Account" assignment card.
  6. Select `Shamalbhai Vaghela HUF` and confirm import.
- **Expected Results**:
  - Manual holding is created with `memberId` and `accountId` and immediately reflects under `Parul Vaghela` when filtered.
  - CAS holdings are ingested with `memberId` for HUF and appear tagged with HUF and Demat broker badges.
- **Status**: ✅ **PASSED**

### TC-P6A-009: Goal Beneficiaries & Milestone Entity Filtering
- **Objective**: Verify that financial goals can be linked to specific family members (e.g., Krisha's Higher Education, Ketan & Parul FIRE) and that `/goals` filters by beneficiary entity.
- **URL**: [http://wealthnest.local/goals](http://wealthnest.local/goals)
- **Test Steps**:
  1. Navigate to `/goals`.
  2. Observe the milestone cards:
     - `Krisha Higher Education (Ivy League / BITS)` displays `Krisha Vaghela (Child)` beneficiary badge.
     - `Ketan & Parul Retirement & FIRE` displays `Ketan Vaghela (Self)` beneficiary badge.
     - `Shamalbhai & Ramilaben Healthcare & Pilgrimage` displays `Shamalbhai Vaghela HUF` beneficiary badge.
  3. Filter by `Krisha Vaghela (Child)` in `FamilyFilterBar`.
  4. Verify that only Krisha's education milestone is displayed, and target corpus and emergency runway recompute for the child.
  5. Click **Create Goal**: Verify the modal provides the **Goal Beneficiary / Family Entity** selector.
- **Expected Results**:
  - Goals page seamlessly scopes milestones and emergency funds per family beneficiary.
  - Adding a goal saves the `member_id` foreign key.
- **Status**: ✅ **PASSED**

---

### TC-P6A-010: Joint Borrower & Co-Borrower Liabilities Scoping
- **Objective**: Verify that loans and liabilities support a primary borrower and multiple joint co-borrowers, and that `/liabilities` filters debt accordingly.
- **URL**: [http://wealthnest.local/liabilities](http://wealthnest.local/liabilities)
- **Test Steps**:
  1. Navigate to `/liabilities`.
  2. Observe loan cards:
     - `SBI Green Home Loan` displays `Ketan Vaghela (Primary)` and `Joint: Parul Vaghela` badge.
     - `HDFC EV Auto Loan` displays `Parul Vaghela (Primary)` badge.
  3. Filter by `Ketan Vaghela` -> Verify home loan is visible (since Ketan is primary borrower).
  4. Filter by `Parul Vaghela` -> Verify both auto loan (primary) and home loan (joint co-borrower) are visible.
  5. Click **Add Loan / Liability**: Verify modal provides **Primary Borrower** dropdown and interactive toggle pills for **Joint Co-Borrowers**.
- **Expected Results**:
  - Debt KPIs, monthly EMIs, and net liabilities reconcile with joint borrower relationships.
- **Status**: ✅ **PASSED**

---

## ⚡ Automated Test Verification Matrix

| Test Suite | File | Tests | Status |
| :--- | :--- | :---: | :---: |
| **Domain Family Portfolios** | `packages/domain/src/__tests__/family-portfolio.test.ts` | 6 Tests | ✅ Passing |
| **Application Family Use Cases** | `packages/application/src/__tests__/family-use-case.test.ts` | 8 Tests | ✅ Passing |
| **Web Family Components & Pages** | `apps/web/src/__tests__/FamilyPortfolio.test.tsx` | 16 Tests | ✅ Passing |
| **Goals & Liabilities Integration** | `apps/web/src/__tests__/GoalsPage.test.tsx`, `LiabilitiesPage.test.tsx` | 8 Tests | ✅ Passing |

---

## 📝 Conclusion & Sign-Off
Phase 6A fulfills all architectural, domain, application, and UI integration criteria for institutional-grade multi-Demat, family portfolio operations, goal beneficiaries, and joint debt liabilities in India.

