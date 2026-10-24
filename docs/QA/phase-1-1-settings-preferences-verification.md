# QA Test Plan: Phase 1 & Settings — System & Account Settings Verification

This document defines the formal Quality Assurance test cases for **Settings & Control Center** (`/settings`) of WealthNest, covering User Profile management, **India-First localization preferences** (`₹ INR`, Lakhs/Crores `en-IN`, FY cycle, Tax Regimes), **Data Portability & Backup Engine** (JSON/CSV exports and JSON backup restoration), and **System Diagnostics**.

---

## 🎯 Scope & Objectives
Validate that:
1. The Settings & Control Center module is fully operational at `/settings` with no placeholder fallbacks.
2. User profile details (display name, email verification badge, Pro Tier badge) display and update reactively.
3. Currency preferences toggle smoothly between `INR (₹)`, `USD ($)`, `EUR (€)`, and `GBP (£)`.
4. Number format toggles between the Indian Numbering System (`en-IN` Lakhs/Crores grouping) and the Western International System (`en-US` Millions/Billions).
5. Financial Year selection (`Apr 01 - Mar 31` vs `Jan 01 - Dec 31`) and Tax Regime preferences (`New Regime Sec 115BAC` vs `Old Regime`) persist across refreshes.
6. The Live Formatting Preview dynamically demonstrates how large Rupee amounts and monthly SIP amounts format in real-time.
7. Data Portability generates valid, downloadable RFC 4180 CSV reports for Holdings, Transactions, Liabilities, and Goals.
8. The JSON backup generator exports full portfolio state (`wealthnest-portfolio-v1` schema) and the backup validator inspects uploaded backups.
9. System Diagnostics displays the status of all 4 Clean Architecture layers, database connectivity, and cache usage.

---

## 🧪 Test Cases

### TC-SET-001: Settings Control Center Layout & Tabbed Navigation
- **Objective**: Verify that the Settings & Control Center loads with all 4 functional tabs and active security badges.
- **URL**: [http://wealthnest.local/settings](http://wealthnest.local/settings)
- **Preconditions**: Web app is running.
- **Test Steps**:
  1. Navigate to `/settings` or click **Settings** in the sidebar.
  2. Inspect header badges: `System & Preferences` and `Client-Side Privacy Enforced`.
  3. Verify presence of all 4 navigation tabs:
     - Profile & Security
     - Localization & Tax Standards
     - Data Portability & Backup
     - System Diagnostics
- **Expected Results**:
  - Control Center header renders with subtitle and Quick Backup button.
  - Profile & Security tab is active by default.
- **Status**: ✅ **PASSED**

---

### TC-SET-002: User Profile Management & Reactive Persistence
- **Objective**: Verify that user display name can be edited and persisted locally and via Supabase profiles adapter.
- **Test Steps**:
  1. Under the **Profile & Security** tab, enter a new display name (e.g. `Ketan Vaghela`).
  2. Click **Save Profile Changes**.
- **Expected Results**:
  - Button switches to active state.
  - Green confirmation banner `Profile updated successfully!` displays.
  - The initials avatar badge in the right-hand Account Tier card updates dynamically.
  - Changes persist across page reloads via `localStorage` cache.
- **Status**: ✅ **PASSED**

---

### TC-SET-003: India-First Localization & Tax Regime Customization
- **Objective**: Verify real-time format toggling for currency, numeration systems, and tax rules.
- **Test Steps**:
  1. Switch to the **Localization & Tax Standards** tab.
  2. Select **Default Base Currency**: `INR (₹)`.
  3. Select **System of Numeration**: `Indian System (en-IN)`.
  4. Select **Financial Year Cycle**: `Indian Fiscal Year (Apr 1 - Mar 31)`.
  5. Select **Income Tax Regime**: `New Regime (Sec 115BAC)`.
  6. Inspect the sticky **Live Formatting Preview** card.
- **Expected Results**:
  - Full valuation displays in Lakhs/Crores notation: `₹ 24,50,00,000.00`.
  - Compact valuation displays: `₹ 24.50 Cr`.
  - Monthly SIP displays: `₹ 50,000.00`.
  - Switching to `USD ($)` or `en-US` instantly updates the preview card to `$ 24,500,000.00` and `$ 24.50 M`.
- **Status**: ✅ **PASSED**

---

### TC-SET-004: Data Portability & Complete JSON Portfolio Backup
- **Objective**: Verify full client portfolio export into standardized JSON format.
- **Test Steps**:
  1. Switch to the **Data Portability & Backup** tab.
  2. Click **Download JSON** under **Complete JSON Backup**.
- **Expected Results**:
  - File download initiates with filename `wealthnest_portfolio_backup_YYYY-MM-DD.json`.
  - Exported JSON contains schema `wealthnest-portfolio-v1`, version `1.0.0`, user profile, holdings, transactions, liabilities, goals, and aggregate portfolio metrics.
  - A green success alert appears: `Full JSON portfolio backup downloaded successfully!`.
- **Status**: ✅ **PASSED**

---

### TC-SET-005: Spreadsheet CSV Report Generation
- **Objective**: Verify independent CSV report downloads for each module.
- **Test Steps**:
  1. In the **Spreadsheet CSV Reports** section, click:
     - **Holdings & Valuations (.csv)**
     - **Transactions Log (.csv)**
     - **Loans & EMIs (.csv)**
     - **Goals & Runway (.csv)**
- **Expected Results**:
  - Each button generates and downloads a formatted CSV with standard RFC 4180 headers.
  - Numeric columns format correctly in Rupee units without float drift.
- **Status**: ✅ **PASSED**

---

### TC-SET-006: Restore Portfolio from Backup Validation
- **Objective**: Verify backup upload validator against compliant and corrupted JSON files.
- **Test Steps**:
  1. Click the file upload dropzone under **Restore from Backup**.
  2. Upload an exported WealthNest backup JSON.
- **Expected Results**:
  - Backup validator parses file structure.
  - Displays green validation badge `Valid Backup (v1.0.0)`.
  - Displays summary preview: Holdings count, Transactions count, Liabilities count, Goals count, and Net Worth.
  - Clicking **Confirm & Restore Portfolio** triggers local merge and displays a confirmation notification.
- **Status**: ✅ **PASSED**

---

### TC-SET-007: Clean Monorepo System Diagnostics
- **Objective**: Verify diagnostic reporting of architectural layers and database state.
- **Test Steps**:
  1. Switch to the **System Diagnostics** tab.
  2. Inspect the 4 top metric cards: Monorepo Layers (`4`), Database Engine (`PostgreSQL / Supabase`), Client Memory Cache (`Reactive`), Architecture (`Clean Arch`).
  3. Review the **Architectural Layer Verification** breakdown.
- **Expected Results**:
  - All 4 packages are verified with green badges:
    - `@wealthnest/domain` (Pure financial rules, zero dependencies)
    - `@wealthnest/application` (Use cases & port contracts)
    - `@wealthnest/shared` (Branded types & Result pattern)
    - `@wealthnest/web` (Vite + React UI shell)
- **Status**: ✅ **PASSED**

---

## 📊 Summary of Execution
| Module | Total Tests | Passed | Failed | Status |
|---|---|---|---|---|
| User Profile & Security | 2 | 2 | 0 | ✅ PASSED |
| Localization & Tax Rules | 2 | 2 | 0 | ✅ PASSED |
| Data Portability (JSON/CSV) | 2 | 2 | 0 | ✅ PASSED |
| Restore Validation | 1 | 1 | 0 | ✅ PASSED |
| System Diagnostics | 1 | 1 | 0 | ✅ PASSED |
| **Total** | **8** | **8** | **0** | **✅ 100% PASSED** |
