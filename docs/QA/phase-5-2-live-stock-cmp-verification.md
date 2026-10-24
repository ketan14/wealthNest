# Phase 5.2 QA Verification: Automated Live Stock CMP Feed (NSE/BSE) & AMFI Synchronization

**Milestone:** Phase 5.2 / Phase 5A Expansion: Real-Time Market Data & Trading Session Hours  
**Target Modules:** `packages/domain/src/market/nse-bse-cmp.ts`, `packages/application/src/ports/market-data.port.ts`, `packages/application/src/use-cases/refresh-market-quotes.ts`, `apps/web/src/lib/market/useLiveMarketFeed.ts`, `apps/web/src/pages/PortfolioPage.tsx`  
**Test Suite:** `packages/domain/src/__tests__/nse-bse-cmp.test.ts`, `packages/application/src/__tests__/market-data-use-case.test.ts`, `apps/web/src/__tests__/LiveMarketFeed.test.tsx`, `apps/web/src/__tests__/PortfolioPage.test.tsx`  
**Status:** ✅ Verified (100% Passing)

---

## 1. Scope & Objective

The objective of this verification protocol is to validate that WealthNest delivers real-time market quote polling for Indian Equities (NSE/BSE) alongside daily AMFI mutual fund Net Asset Values (NAVs). Key capabilities verified include:
1. **IST Market Session Hours Evaluation**: Accurate detection of Indian Standard Time (UTC+5:30) trading sessions (`OPEN` 09:15-15:30 IST, `PRE_MARKET` 09:00-09:15 IST, `POST_MARKET` 15:30-16:00 IST, `CLOSED`, `WEEKEND`).
2. **Zero Floating-Point Drift**: Conversion of equity prices into `BigInt` integer paise.
3. **Multi-Asset Quote Aggregation**: Simultaneous refresh across equities (NSE/BSE) and mutual funds (AMFI).
4. **Reactive Auto-Polling Hook**: Periodic background quote synchronization (`useLiveMarketFeed`) with toggling controls.
5. **UI Experience**: Market session indicator badge, auto-poll toggle, live CMP prices, and day change percentage pills.

---

## 2. Test Cases & Verification Protocol

### Test Case 1: Indian Market Session Detection (IST UTC+5:30)
* **Goal**: Validate that the market session state machine accurately categorizes trading hours based on Indian Standard Time regardless of host timezone.
* **Input Scenarios**:
  - Weekday 10:30 AM IST -> Status: `OPEN`, `isOpen: true`.
  - Weekday 09:08 AM IST -> Status: `PRE_MARKET`, `isOpen: false`.
  - Weekday 15:45 IST -> Status: `POST_MARKET`, `isOpen: false`.
  - Weekday 21:00 IST -> Status: `CLOSED`, `isOpen: false`.
  - Sunday 11:00 AM IST -> Status: `WEEKEND`, `isOpen: false`.
* **Assertion**:
  - `getIndianMarketSession()` returns expected `status`, `isOpen`, human-readable description, and formatted `istTimeString`.
* **Result**: ✅ Verified in `packages/domain/src/__tests__/nse-bse-cmp.test.ts`.

### Test Case 2: Zero Floating-Point Drift Integer Paise Conversion
* **Goal**: Confirm stock quotes maintain integer paise precision.
* **Input**: Reliance CMP ₹2,950.45, Previous Close ₹2,910.00.
* **Expected Output**:
  - `cmpPaise = 295045n`
  - `previousClosePaise = 291000n`
  - `change = 40.45`
  - `changePercent = 1.39%`
* **Result**: ✅ Verified in `packages/domain/src/__tests__/nse-bse-cmp.test.ts`.

### Test Case 3: Ticker Symbol Normalization & Matching
* **Goal**: Normalize various exchange ticker formats to canonical NSE/BSE representations.
* **Input**: `RELIANCE`, `RELIANCE.NS`, `NSE:INFY`, `500325.BO`, `BSE:TATAMOTORS`.
* **Assertion**:
  - NSE equities map to exchange `NSE` and `.NS` query symbol.
  - BSE equities map to exchange `BSE` and `.BO` query symbol.
  - `matchHoldingToStockCmp` successfully matches by ISIN first, then ticker symbol.
* **Result**: ✅ Verified in `packages/domain/src/__tests__/nse-bse-cmp.test.ts`.

### Test Case 4: Application Use Case Multi-Asset Quote Aggregation
* **Goal**: Ensure `RefreshMarketQuotesUseCase` aggregates both NSE equity quotes and AMFI mutual fund quotes.
* **Input**: Portfolio containing Reliance Industries (`NSE: RELIANCE`) and Parag Parikh Flexi Cap (`AMFI: INF879O01019`).
* **Assertion**:
  - `totalUpdatedHoldings = 2`
  - `equitiesCount = 1`
  - `mutualFundsCount = 1`
  - `marketSession` metadata populated.
* **Result**: ✅ Verified in `packages/application/src/__tests__/market-data-use-case.test.ts`.

### Test Case 5: Reactive Auto-Polling Hook (`useLiveMarketFeed`)
* **Goal**: Verify background timer triggers quote refresh when enabled and halts when disabled.
* **Test Flow**:
  1. Initialize `useLiveMarketFeed` with `defaultPolling: false`.
  2. Call `refreshNow()` -> Verify quotes map updates and callback triggers with status message.
  3. Set `isPolling: true` -> Advance timers by 5,000ms -> Verify automatic polling tick occurs.
  4. Set `isPolling: false` -> Advance timers -> Verify no further polling invocations occur.
* **Result**: ✅ Verified in `apps/web/src/__tests__/LiveMarketFeed.test.tsx`.

### Test Case 6: Portfolio Page UI Integration
* **Goal**: Verify the interactive UI elements on `/portfolio`.
* **Verification Steps**:
  1. Open `/portfolio`.
  2. Confirm the **Market Session Badge** is present (`NSE/BSE: OPEN` or `NSE/BSE: CLOSED`).
  3. Verify the **Auto-Poll Toggle Button** toggles between `Auto-Poll: OFF` and `Auto-Poll: ON`.
  4. Click **Refresh Quotes (NSE & AMFI)** -> Verify button displays `Fetching Feeds...` with spinner.
  5. Confirm success alert appears: `Refreshed X securities (Y Stocks via NSE/BSE, Z MFs via AMFI)`.
  6. Switch to **Direct Equities** view -> Verify CMP, NSE exchange tag, and day change percentage pills render for each stock.
* **Result**: ✅ Verified in `apps/web/src/__tests__/PortfolioPage.test.tsx`.

---

## 3. Automated Execution Commands

Execute the following commands to run the automated test suite for market feeds:

```bash
# Run domain market data tests (11 tests)
node node_modules/vitest/vitest.mjs run packages/domain/src/__tests__/nse-bse-cmp.test.ts

# Run application use case tests
node node_modules/vitest/vitest.mjs run packages/application/src/__tests__/market-data-use-case.test.ts

# Run live market feed hook tests (4 tests)
node node_modules/vitest/vitest.mjs run apps/web/src/__tests__/LiveMarketFeed.test.tsx

# Run portfolio page integration tests (5 tests)
node node_modules/vitest/vitest.mjs run apps/web/src/__tests__/PortfolioPage.test.tsx
```
