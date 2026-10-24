# QA Test Verification: Broker Tradebook & Holdings CSV Importers (Zerodha Kite & Groww)

**Feature / Scope**: Broker CSV Statement Importers (Zerodha Kite & Groww)  
**Execution Date**: 2026-10-24  
**Status**: ✅ All 5 Test Cases Passed (180 Total Suite Tests Green)  

---

## 📌 Executive Summary

This test plan validates the statement ingestion engine extension complementing CAS PDF parsing with direct CSV export parsers from India's primary retail discount brokers: **Zerodha Kite** and **Groww**.

All imports enforce **Zero Floating-Point Drift** through `BigInt` integer paise computations and integrate cleanly with **Family Member** and **Demat Account** scoping.

---

## 🧪 Test Cases & Verification Results

### Test Case 1: Import Source Format Switcher & Password State
* **Objective**: Verify user can seamlessly switch between `CAS Statement (PDF)`, `Zerodha Kite (CSV)`, and `Groww (CSV)`.
* **Steps**:
  1. Open the Import Modal on `/portfolio`.
  2. Verify initial state defaults to CAS PDF with password input displayed.
  3. Click `Zerodha Kite (CSV)`.
  4. Verify accept attribute transitions to `.csv,text/csv` and password input is replaced by "No Document Password Required" information banner.
  5. Click `Groww (CSV)`.
  6. Verify Groww-specific instructions and file guidelines appear.
* **Result**: ✅ **PASSED**. UI dynamically reconfigures without page refresh.

---

### Test Case 2: Zerodha Kite Holdings CSV Parsing
* **Objective**: Ingest sample Zerodha Kite `holdings.csv` containing equities and commodity ETFs.
* **Sample Content**:
  ```csv
  Instrument,Qty.,Avg. cost,LTP,Cur. val,P&L,Net chg.,Day chg.
  RELIANCE,80,2500.00,2950.00,"2,36,000.00","36,000.00",18.00,1.25
  TCS,40,"3,600.00","4,150.00","1,66,000.00","22,000.00",15.28,-0.45
  GOLDBEES,500,52.50,58.20,29100.00,2850.00,10.86,0.34
  ```
* **Verification**:
  - `RELIANCE` correctly resolved to `Reliance Industries Ltd` (`INE002A01018`), quantity `80`, unit cost `₹2,500.00` (250000 paise).
  - `TCS` correctly resolved to `Tata Consultancy Services Ltd` (`INE467B01029`), quantity `40`, unit cost `₹3,600.00` (360000 paise).
  - `GOLDBEES` categorized under `commodity` with `Nippon India ETF Gold BeES` (`INF204KB14I2`).
  - Total reported value computed with zero float precision (`₹4,31,100.00`).
* **Result**: ✅ **PASSED**.

---

### Test Case 3: Zerodha Console Tradebook CSV (Buy/Sell Executions)
* **Objective**: Ingest sample Zerodha Console `tradebook.csv` containing historical buy and sell trades.
* **Sample Content**:
  ```csv
  symbol,isin,trade_date,exchange,segment,series,trade_type,quantity,price,trade_id,order_id,order_execution_time
  RELIANCE,INE002A01018,2024-03-15,NSE,EQ,EQ,buy,50,2500.00,123456,987654,2024-03-15 11:20:15
  TCS,INE467B01029,2024-04-10,NSE,EQ,EQ,buy,40,3600.00,123457,987655,2024-04-10 14:15:30
  RELIANCE,INE002A01018,2024-05-20,NSE,EQ,EQ,sell,10,2900.00,123458,987656,2024-05-20 10:05:00
  ```
* **Verification**:
  - Automatically transitions preview to **Historical Transactions** tab.
  - Generates 3 transaction records with exact date parsing (`2024-03-15`, `2024-04-10`, `2024-05-20`).
  - Correct trade types: 2 BUYs (`RELIANCE`, `TCS`) and 1 SELL (`RELIANCE`).
  - Preserves exchange, trade IDs, and integer paise total amounts.
* **Result**: ✅ **PASSED**.

---

### Test Case 4: Groww Multi-Asset Holdings CSV (Equities & Mutual Funds)
* **Objective**: Ingest sample Groww `Holdings.csv` containing both stocks and mutual fund schemes.
* **Sample Content**:
  ```csv
  Company Name,Symbol,Shares,Average Price,Current Value,Market Price
  Reliance Industries Ltd,RELIANCE,30,"2,480.00","88,500.00","2,950.00"
  Tata Consultancy Services Ltd,TCS,20,"3,550.00","83,000.00","4,150.00"
  Parag Parikh Flexi Cap Fund Direct-Growth,PPFAS-FLEXI,1000,55.00,78450.00,78.45
  ```
* **Verification**:
  - `Reliance` and `TCS` correctly classified as equities and rendered under the **Direct Equities & ETFs** tab.
  - `Parag Parikh Flexi Cap Fund Direct-Growth` recognized as mutual fund and rendered under the **Mutual Funds** tab.
  - Unit values, average prices, and current values accurately mapped without rounding errors.
* **Result**: ✅ **PASSED**.

---

### Test Case 5: Family Member & Demat Account Scoping
* **Objective**: Confirm that imported broker CSV positions can be scoped to any family member and Demat account.
* **Steps**:
  1. Open Import Modal from `/portfolio`.
  2. Load sample Groww Holdings CSV.
  3. Change "Assign To Legal Entity / Member" dropdown to `Parul Vaghela (SPOUSE)`.
  4. Demat account dropdown automatically updates to show relevant accounts for `Parul Vaghela`.
  5. Click **Confirm & Import**.
  6. Verify holdings are committed with `memberId: 'mem-spouse'` and portfolio aggregates update in real time.
* **Result**: ✅ **PASSED**.

---

## 📊 Automated Regression Matrix

| Test Suite File | Tests | Status |
| :--- | :---: | :---: |
| `packages/domain/src/__tests__/broker-csv-parser.test.ts` | 6 | ✅ Pass |
| `packages/application/src/__tests__/import-broker-csv.test.ts` | 2 | ✅ Pass |
| `apps/web/src/__tests__/ImportBrokerCsv.test.tsx` | 5 | ✅ Pass |
| **Total Project Test Suite (40 files)** | **180** | ✅ **100% Pass** |
