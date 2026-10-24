# WealthNest System Architecture & Technical Design

## 1. Architectural Overview & Clean Architecture Principles

WealthNest is engineered as an institutional-grade, privacy-first personal wealth operating system tailored for Indian investors. It adheres to strict **Domain-Driven Design (DDD)** and **Clean / Hexagonal Architecture** within an **npm workspaces** monorepo:

```
+-----------------------------------------------------------------------------------------+
|                                        apps/web                                         |
|    React 18 + Vite + Tailwind CSS + TanStack Query + Reactive Market Polling Hooks      |
+--------------------------------------------+--------------------------------------------+
                                             | consumes
                                             v
+-----------------------------------------------------------------------------------------+
|                                  packages/application                                   |
|   Use Cases, DTOs, Repository Ports, Ingestion Services, Market Data Port contracts    |
+--------------------------------------------+--------------------------------------------+
                                             | consumes
                                             v
+-----------------------------------------------------------------------------------------+
|                                    packages/domain                                      |
|    Pure Business Logic: Money Value Object (Paise), Family Tax Shield Math,             |
|    NSE/BSE Trading Session Detector, AMFI Feed Parser, XIRR/CAGR Solvers, Net Worth     |
+--------------------------------------------+--------------------------------------------+
                                             | consumes
                                             v
+-----------------------------------------------------------------------------------------+
|                                    packages/shared                                      |
|            Functional Result<T, E> Pattern, Nominal Branding, Format Utilities          |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Package Boundaries & Responsibilities

### `apps/web` (Presentation & Infrastructure Adapters)
- **Role**: User interface, reactive state management, and concrete infrastructure adapters.
- **Tech Stack**: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, Lucide Icons.
- **Adapters**:
  - `SupabaseHoldingAdapter`, `SupabaseTransactionAdapter`, `SupabaseGoalAdapter`, `SupabaseLiabilityAdapter`, `SupabaseFamilyAdapter`.
  - `MarketDataAdapter`: Connects to NSE/BSE stock price feeds and AMFI daily NAV feeds with in-memory caching and tick simulation.
  - `CasImportAdapter`: In-memory PDF parser utilizing `pdfjs-dist` to extract NSDL/CDSL CAS investments completely client-side without uploading statements to external servers.
- **Rules**: Must never execute raw financial arithmetic without domain models; must map database rows to application DTOs and domain value objects at adapter boundaries.

### `packages/domain` (Core Financial Domain Logic)
- **Role**: Pure financial business logic, invariant enforcement, and zero-drift mathematical engines.
- **Core Modules**:
  1. **Money Value Object (`money/`)**: Implements currency math exclusively using integer cents/paise (`BigInt` / integer cents). Eliminates IEEE 754 floating-point drift.
  2. **Multi-Entity Family Wealth & Tax Shield (`family/`)**:
     - `FamilyMemberEntity`: Models PAN-holding legal entities (`self`, `spouse`, `huf`, `child`, `parent`).
     - `family-wealth-calculator.ts`: Functional calculation of household net worth and **Section 112A Multi-Entity Tax Segregation**. Quantifies separate ₹1,25,000 annual Long-Term Capital Gains exemptions across distinct PANs (yielding ₹15,625 in direct tax savings per year per added legal entity).
  3. **Real-Time Market Data & Trading Sessions (`market/`)**:
     - `nse-bse-cmp.ts`: IST (UTC+5:30) trading session state machine (`OPEN`, `PRE_MARKET`, `POST_MARKET`, `CLOSED`, `WEEKEND`), ticker normalizer (`RELIANCE.NS`, `500325.BO`), and `StockCmpRecord`.
     - `amfi-nav.ts`: Semicolon-delimited official AMFI NAV feed parser (`NAVAll.txt`) indexing records by ISIN and Scheme Code.
  4. **Financial Goals & Reverse SIP Engine (`goals/`)**:
     - Inflation-adjusted corpus formulas, required monthly SIP calculations, emergency runway buffer math, and family beneficiary linkage.
  5. **Loans, Collateral & Net Worth (`liabilities/`)**:
     - Debt reconciliation, Loan-To-Value (LTV) ratios, EMI commitments, joint co-borrower relationships, and true net worth.
  6. **Institutional Analytics (`analytics/`)**:
     - Newton-Raphson XIRR solver, compound annual growth rate (CAGR), asset class drift, and Nifty 50 TRI benchmark alpha.
  7. **Union Budget 2024 Capital Gains Tax (`tax/`)**:
     - Equity LTCG (12.5% over ₹1.25L exemption), STCG (20%), and Tax-Loss Harvesting radar.
- **Strict Constraints**: ZERO external runtime dependencies (only `@wealthnest/shared`). No React, no Vite, no DOM, no database drivers.

### `packages/application` (Use Cases & Port Contracts)
- **Role**: Application workflows, orchestration, DTO transformations, and repository/service port interfaces.
- **Ports**:
  - `HoldingRepositoryPort`, `TransactionRepositoryPort`, `GoalRepositoryPort`, `LiabilityRepositoryPort`, `FamilyRepositoryPort`, `MarketDataPort`.
- **Use Cases**:
  - `GetPortfolioSummaryUseCase`, `RefreshMarketQuotesUseCase`, `ManageFamilyMembersUseCase`, `ManageGoalsUseCase`, `CreateLiabilityUseCase`, `GetNetWorthSummaryUseCase`, `ParseCasPdfUseCase`, `ConfirmCasImportUseCase`.
- **Strict Constraints**: Framework-agnostic TypeScript.

### `packages/shared` (Cross-Cutting Foundations)
- **Role**: Generic primitives and functional error-handling patterns.
- **Contents**:
  - `Result<T, E>` pattern (`ok`, `err`, `isOk`, `isErr`).
  - Nominal branding (`Brand<K, T>`) for IDs and currency codes.
  - Number and date formatting primitives.

---

## 3. Financial & Precision Guidelines

1. **Zero Floating-Point Drift (Integer Paise Standard)**:
   - Currency values are never stored or computed as floating-point decimals.
   - All amounts are represented as integer paise (e.g. `₹2,950.45` is stored as `295045n` paise or `295045` cents).
   - Conversions to display strings occur strictly at presentation time.
2. **India-First Formatting (`en-IN`)**:
   - Numbers are formatted using the Indian numbering system (`₹ Lakhs` and `₹ Crores`) rather than millions/billions.
   - Example: `₹1,25,00,000.00` (1 Crore 25 Lakhs).

---

## 4. Multi-Entity Family & Demat Portfolio Architecture

To serve real-world Indian households, WealthNest supports multi-entity wealth tracking where assets, transactions, goals, and liabilities are partitioned across family legal entities:

```
                          +------------------------+
                          |   User Account (Auth)  |
                          +-----------+------------+
                                      | 1:N
             +------------------------+------------------------+
             |                        |                        |
             v                        v                        v
+------------------------+ +---------------------+ +----------------------+
| Ketan Vaghela (Self)   | | Parul Vaghela       | | Shamalbhai Vaghela   |
| Primary Investor       | | Spouse (Bank Clerk) | | HUF (Tax Shield)     |
+-----------+------------+ +----------+----------+ +-----------+----------+
            | 1:N                     | 1:N                    | 1:N
            v                         v                        v
+------------------------+ +---------------------+ +----------------------+
| Zerodha Kite Demat     | | Groww Direct Demat  | | ICICI Direct HUF     |
+------------------------+ +---------------------+ +----------------------+
            |                         |                        |
            v                         v                        v
    Holdings & Trades         Holdings & Trades        Holdings & Trades
```

### Database Schema Extension (`supabase/migrations`)
- `family_members`: `id`, `user_id`, `name`, `relationship` (`self`, `spouse`, `huf`, `child`, `parent`, `other`), `pan_masked`, `color_hex`, `is_primary`.
- `portfolio_accounts`: `id`, `user_id`, `member_id`, `account_name`, `broker_name`, `depository`, `account_type`.
- Foreign keys: `holdings.member_id`, `holdings.account_id`, `transactions.member_id`, `transactions.account_id`, `goals.member_id`, `liabilities.member_id`, `liabilities.co_borrower_ids` (`uuid[]`).

---

## 5. Real-Time Market Data & Auto-Polling Architecture

WealthNest combines daily mutual fund NAVs with live equity tick updates:

```
[ Market Data Port Interface ]
             |
             +---> AMFI Daily Feed Parser (NAVAll.txt) -> Mutual Fund NAVs
             |
             +---> NSE / BSE Stock CMP Feed -----------> Real-Time Equity CMPs
             |
             v
[ Indian Market Session State Machine (IST) ]
  - 09:00 - 09:15 IST: PRE_MARKET
  - 09:15 - 15:30 IST: OPEN (Live Ticks & Auto-Polling Active)
  - 15:30 - 16:00 IST: POST_MARKET
  - 16:00 - 09:00 IST: CLOSED
  - Weekends: WEEKEND
             |
             v
[ useLiveMarketFeed React Hook ]
  - Auto-polling interval timer (e.g. 25-30s)
  - Short-lived in-memory quote cache (15s TTL)
  - Reactive portfolio revaluation
```

---

## 6. Client-Side In-Memory CAS Statement Privacy

Consolidated Account Statements (CAS) from CDSL and NSDL contain sensitive personal and financial data. WealthNest processes CAS statements **entirely inside browser memory**:
1. CAS PDF is loaded locally via HTML5 File API.
2. User provides statement password (PAN + DOB/PIN).
3. `CasParserRegistry` matches statement format (CDSL vs NSDL) and parses text in-memory.
4. ISINs are mapped to assets without uploading the PDF to any backend server.
5. User confirms positions, assigning owning family entity and Demat account before committing to the database.

---

## 7. Future Offline-First Desktop Runtime (Tauri 2 + SQLite)

Because core business rules in `packages/domain` have zero dependencies on web or database runtimes:
1. `apps/web` can be packaged inside a Tauri 2 desktop shell.
2. Local SQLite adapters will implement the identical `HoldingRepositoryPort`, `FamilyRepositoryPort`, and `MarketDataPort`.
3. WealthNest will operate 100% offline with zero external cloud dependencies.
