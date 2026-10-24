# Chapter 3: Portfolio Management & Live Feeds

The **Portfolio Dashboard (`/portfolio`)** is the central command center of WealthNest, providing unified multi-asset visibility, institutional asset class allocation, automated statement ingestion, and real-time market quote polling.

---

## 📊 Supported Asset Classes & Indian Instruments

WealthNest tracks the complete spectrum of Indian wealth instruments:

| Asset Class | Key Instruments | Valuation Method |
| :--- | :--- | :--- |
| **Equities & Stocks** | Reliance, TCS, HDFC Bank, Infosys, Tata Motors | Real-time Live CMP from NSE/BSE feeds |
| **Mutual Funds** | Parag Parikh Flexi Cap, Bandhan Large & Mid Cap | Daily official NAV feed from AMFI (`NAVAll.txt`) |
| **Gold & Commodities** | Sovereign Gold Bonds (SGB 2028), Physical Gold | Official RBI issuance price & NSE secondary quotes |
| **Fixed Income & Debt** | Public Provident Fund (PPF), Senior Citizen FDs, EPF | Accrued interest & principal balances |
| **Cash & Liquid** | Bank Savings, Overnight Funds, Liquid Funds | Face value cash balances |
| **Real Estate & REITs** | Residential properties, Embassy REITs | Fair market valuation & unit trading price |

---

## 🕒 Real-Time NSE/BSE Stock CMP & AMFI NAV Feeds

WealthNest features an integrated dual-feed market pricing engine:

### 1. Indian Standard Time (IST) Market Session Indicator
At the top of the Portfolio dashboard, the **Market Session Badge** continuously evaluates Indian trading hours:
* **🟢 `NSE/BSE: OPEN`**: Active during Monday–Friday from 09:15 to 15:30 IST.
* **🟡 `NSE/BSE: PRE-MARKET`**: Active from 09:00 to 09:15 IST.
* **⚪ `NSE/BSE: CLOSED (HH:MM IST)`**: Active overnight and on weekends.

### 2. Auto-Polling Toggle Button (`Auto-Poll: ON / OFF`)
* Click the **Auto-Poll** button in the header actions bar to activate automatic background polling.
* When **ON**, the pulsing radar icon indicates active quote polling every 25 seconds during open market hours, updating your equity valuations without requiring page reloads.

### 3. Manual Multi-Asset Refresh
* Click **Refresh Quotes (NSE & AMFI)** at any time to simultaneously update both NSE/BSE equity share prices and AMFI mutual fund Net Asset Values.
* A banner notification confirms the synchronization count:
  ```
  ✓ Refreshed 8 securities (4 Stocks via NSE/BSE, 2 MFs via AMFI)
  ```

### 4. Live CMP & Day Change Percentage Indicators
* In the **Direct Equities** tab, each share displays its live CMP (Current Market Price) alongside a colored change badge: e.g. `₹2,950.45 (+1.45%) NSE`.
* In the **All Assets** table, the Current Value column displays both your total position value and the per-unit CMP/NAV.

---

## 📄 Automated CAS Statement Import (CDSL & NSDL)

Instead of manually entering dozens of mutual fund folios and stock trades, you can import your official **Consolidated Account Statement (CAS)**:

### How to Import Your CAS Statement:
1. Download your monthly or quarterly CAS PDF from **CDSL** ([mycas.cdslindia.com](https://mycas.cdslindia.com)) or **NSDL** ([nsdlcas.nsdl.com](https://nsdlcas.nsdl.com)).
2. In WealthNest, click the **Import CAS** button on the Portfolio dashboard.
3. Select your CAS PDF file and enter the statement password (typically your **10-character PAN in uppercase** or **PAN + Date of Birth in DDMMYYYY format**).
4. WealthNest decrypts and extracts all folios, ISINs, units, and average costs in **browser memory**.
5. In the preview step, select the **Owning Family Member** (e.g. `Parul Vaghela` or `Shamalbhai HUF`) and the **Target Demat Account**.
6. Click **Confirm & Import**. All positions are immediately synchronized into your active portfolio.

> [!NOTE]
> **Zero Server Uploads**: The entire decryption and text extraction workflow runs locally on your machine. Your CAS statement is never uploaded to any remote server or cloud AI service.

---

## 📈 Broker Tradebook & Holdings CSV Importers (Zerodha Kite & Groww)

In addition to CAS PDF parsing, WealthNest includes dedicated importers for direct CSV exports from India's leading discount brokers:

### Supported Formats & File Types:
1. **Zerodha Kite Holdings CSV (`holdings.csv`)**:
   - Downloaded from **Kite Console > Portfolio > Holdings > Download CSV**.
   - Extracts equity shares, ETFs, and gold bonds with live CMP and buy average cost basis.
2. **Zerodha Console Tradebook CSV (`tradebook.csv`)**:
   - Downloaded from **Kite Console > Reports > Tradebook > Download CSV**.
   - Ingests all historical Buy and Sell executions with exact execution timestamp, exchange (NSE/BSE), trade ID, quantity, and executed price into your WealthNest cashflow ledger.
3. **Groww Holdings CSV (`Holdings.csv`)**:
   - Downloaded from **Groww Web/App > Investments > Download CSV**.
   - Simultaneously extracts both Direct Equities and Mutual Fund schemes (e.g. Parag Parikh Flexi Cap Fund) with precise units and purchase prices.
4. **Groww Orders CSV (`Orders.csv`)**:
   - Downloaded from **Groww Web/App > Orders History**.
   - Extracts executed orders, normalizing date formats and ticker symbols.

### How to Import Broker CSVs:
1. On `/portfolio`, click **Import CAS**.
2. Select the **Zerodha Kite (CSV)** or **Groww (CSV)** tab in the modal header.
3. Drag & drop your exported `.csv` file. *(No password required! Broker CSV files are plain text).*
4. In the preview window:
   - Verify the parsed holdings across the **Direct Equities & ETFs** and **Mutual Funds** tabs.
   - For tradebook exports, inspect your historical executions under the **Historical Transactions** tab.
   - Assign the import to the appropriate **Legal Entity / Family Member** (e.g. `Ketan Vaghela`, `Parul Vaghela`, `Shamalbhai Vaghela HUF`) and **Demat Account** (e.g. `Zerodha Kite: Ketan Main`).
5. Click **Confirm & Import**. The holdings and trade records are immediately committed to your portfolio.

---

## ➕ Adding Positions Manually

For unlisted shares, private equity, or custom deposits:
1. Click **Add Holding** on `/portfolio`.
2. Select the **Asset Class** (e.g. *Equities*, *Mutual Funds*, *Fixed Income*).
3. Enter the Asset Name, Ticker (e.g. `RELIANCE`), and ISIN if available.
4. Select the **Owning Family Member** and **Demat Account**.
5. Input the **Quantity** and **Unit Purchase Cost (₹)**.
6. Click **Save Holding**.
