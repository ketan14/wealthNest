# Chapter 8: Settings, Preferences & Offline Data Management

The **Settings Dashboard (`/settings`)** gives you complete control over your user profile, multi-entity family structure, India-first financial preferences, offline backup/restore procedures, and system diagnostics.

---

## 🧭 Navigation & Settings Tabs

The Settings page is organized into 5 dedicated tabs:

| Tab | Purpose & Features |
| :--- | :--- |
| **👤 Profile** | Display name configuration, email display, authentication session status, and secure logout. |
| **👨‍👩‍👧‍👦 Family & Demats** | Overview of registered family legal entities, connected Demats, and the **HUF Section 112A Tax Shield** advisory. |
| **🌐 Localization** | Currency formatting (`₹ INR`), number scale (`Lakhs & Crores`), financial year cycle, and capital gains tax rules. |
| **💾 Data Management** | Offline JSON portfolio backups, CSV spreadsheet exports, and safe in-memory data restores. |
| **⚙️ System Diagnostics** | Architecture health status, domain layer integrity, Supabase database connection, and local service URLs. |

---

## 👤 1. Profile Management

In the **Profile** tab:
* **Display Name**: Update your primary investor name (e.g. `Ketan Vaghela`). This updates your personal greeting and primary entity badge across the platform.
* **Email Address**: Displays your verified login email address.
* **Session Controls**: Click **Log Out** to securely terminate your current browser session and revoke active auth tokens.

---

## 👨‍👩‍👧‍👦 2. Family Entities & Connected Demats

The **Family & Demats** tab serves as the command center for your household structure:
* **Registered Legal Entities Card**: Displays all household entities with relationship tags, masked PAN numbers, and custom color indicators:
  - `Ketan Vaghela` (`Self` / Primary Investor)
  - `Parul Vaghela` (`Spouse` / Working Professional)
  - `Shamalbhai Vaghela HUF` (`HUF` / Tax Shield)
  - `Krisha Vaghela` (`Child` / Education Compounding)
  - `Ramilaben Vaghela` (`Parent` / Senior Citizen Deposits)
* **Connected Demat & Folio Accounts Card**: Displays connected broker accounts (Zerodha, Groww, ICICI Direct, CAMS folios, SBI PPF).
* **Section 112A Tax Shield Advisory**: Highlights the direct ₹15,625 annual tax savings unlocked by utilizing a separate HUF PAN for long-term equity capital gains.
* **Manage Family Entities Button**: Launches the dual-tab modal to add, edit, or remove entities and broker accounts.

---

## 🌐 3. Localization & Indian Financial Preferences

WealthNest is built with an India-First philosophy, but provides granular configuration options:

### Number Scale System
* **Lakhs & Crores (`lakh_crore`) [Default]**: Formats numbers according to the Indian numbering system:
  - Thousands: `₹1,00,000` (1 Lakh)
  - Millions: `₹10,00,000` (10 Lakhs)
  - Tens of Millions: `₹1,00,00,000` (1 Crore)
* **Millions & Billions (`million_billion`)**: Standard Western numbering format for NRI or international reporting.

### Primary Currency
* **`INR (₹)` [Default]**: Indian Rupee with full integer paise calculation.
* **`USD ($)`**, **`EUR (€)`**, **`GBP (£)`**: Supported secondary currencies with automatic symbol localization.

### Financial Year Cycle
* **April 1 – March 31 [Default]**: Standard Indian Financial Year cycle used for income tax assessment, capital gains harvesting, and annual goal milestones.
* **January 1 – December 31**: Calendar year cycle for international accounting.

### Capital Gains Tax Regime
* **Union Budget 2024 Regime [Default]**:
  - Equity LTCG: **12.5%** on gains exceeding **₹1,25,000** per PAN.
  - Equity STCG: **20.0%** from the first Rupee.
  - SGBs: **0% (Tax-Free)** at maturity.

---

## 💾 4. Offline Data Backup & Safe Restore

WealthNest ensures complete data sovereignty. You can export and restore your entire portfolio at any time without vendor lock-in.

### 1. Exporting Full Portfolio (JSON)
* Click **Download JSON Backup**.
* WealthNest generates a complete, timestamped export file: `wealthnest-backup-YYYY-MM-DD.json`.
* The file contains:
  - User profile & preferences
  - All registered family members & Demat accounts
  - Complete holdings inventory with acquisition costs and asset classes
  - Full chronological transaction ledger
  - All active liabilities, EMI schedules, and collateral links
  - Financial goals, milestones, and reverse SIP configurations

### 2. Exporting Spreadsheets (CSV)
* Click **Export Holdings (CSV)**.
* Generates a standard spreadsheet file (`wealthnest-holdings-YYYY-MM-DD.csv`) compatible with Microsoft Excel, Google Sheets, or LibreOffice Calc.
* Includes Asset Name, Ticker, ISIN, Asset Class, Owning Member, Broker Account, Quantity, Average Buy Price, Current Valuation, and Unrealized P&L.

### 3. Safe In-Memory Restore
To restore from a previous JSON backup:
1. In the **Restore Portfolio Data** card, click **Select Backup File** and upload your `.json` backup.
2. **Pre-Commit In-Memory Validation**: WealthNest inspects the file schema *before* applying any changes and displays a validation preview:
   - Holdings Count (e.g. `8 positions`)
   - Transactions Count (e.g. `12 records`)
   - Liabilities Count (e.g. `2 loans`)
   - Goals Count (e.g. `4 milestones`)
3. Click **Confirm & Restore**. The data is safely committed into your database schema.

---

## ⚙️ 5. System Architecture Status & Diagnostics

The **System Diagnostics** tab confirms the runtime health of your WealthNest installation:
* **Clean Architecture Layers**:
  - `Domain Layer`: Pure business logic, Integer Paise Zero-Drift math, IST trading state machine.
  - `Application Layer`: Ports, use cases, and DTO boundaries.
  - `Presentation & Adapters`: React 18, Vite, and Supabase client adapters.
* **Active Database & Service Matrix**:
  - Supabase PostgreSQL: `127.0.0.1:54322` (`CONNECTED`)
  - Supabase Studio GUI: `http://localhost:54323`
  - Inbucket Mock Email: `http://localhost:54324`
  - Kong Gateway: `http://127.0.0.1:54321`
