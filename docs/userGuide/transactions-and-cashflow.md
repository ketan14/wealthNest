# Chapter 4: Transactions, Trade Ingestion & Cashflow Ledger

Managing wealth requires an accurate, chronological record of every financial event. The **Transactions Dashboard (`/transactions`)** provides an institutional-grade cashflow audit ledger, tracking capital inflows, buy/sell executions, dividend credits, and fees across all family entities and broker accounts.

---

## 💸 Supported Transaction Types & Indian Conventions

WealthNest tracks 6 core transaction categories with dedicated cashflow direction tags:

| Transaction Type | Flow Direction | Financial Impact | Real-World Example |
| :--- | :---: | :--- | :--- |
| **`deposit`** | Inflow (🟢) | Increases liquid capital available for investment | Monthly freelance contractor capital allocation to Zerodha Kite |
| **`withdrawal`** | Outflow (🔴) | Liquid capital taken out for household expenses | Capital transferred to savings bank account for home renovation |
| **`buy`** | Outflow (🔴) | Deploys cash into an asset position | Purchasing 15 shares of Reliance Industries Ltd on NSE |
| **`sell`** | Inflow (🟢) | Liquidates asset position back into cash | Selling 20 shares of TCS for Section 112A annual tax harvesting |
| **`dividend`** | Inflow (🟢) | Passive income credited to bank or Demat | Quarterly dividend credit from TCS directly to Bank of Baroda account |
| **`fee`** | Outflow (🔴) | Brokerage, STT, exchange turnover fees | Securities Transaction Tax (STT) and DP charges |

---

## 📊 Cashflow Summary KPIs

At the top of the Transactions page, 4 real-time KPI metric cards provide instant financial visibility:

1. **Total Inflow (🟢)**: Sum of all cash deposits, realized sale proceeds, and dividend payouts.
2. **Total Outflow (🔴)**: Sum of all purchase outlays, cash withdrawals, and brokerage/tax charges.
3. **Net Invested Cashflow (⚖️)**: The net delta (`Total Inflow - Total Outflow`), indicating whether your household is a net accumulator or net consumer of capital over the selected period.
4. **Total Trades Recorded (📜)**: Total count of logged audit events.

---

## 🔍 Audit Ledger & Filtering

The transaction audit table provides full forensic transparency:

* **Search by Keyword**: Instantly filter by asset ticker (e.g. `RELIANCE`, `TCS`), company name, or transaction notes.
* **Filter by Transaction Type**: Isolate specific events such as `All Types`, `Buys`, `Sells`, `Dividends`, or `Deposits`.
* **Family Member & Broker Badges**: Each transaction row prominently displays:
  - **Owning Entity Badge**: e.g. `👤 Ketan Vaghela`, `💍 Parul Vaghela`, or `🏛️ Shamalbhai HUF`.
  - **Account / Broker Badge**: e.g. `acc-zerodha`, `acc-groww`, or `acc-icici`.
  - **Signed Cashflow Amount**: Inflows are formatted in green with `+`, outflows in rose with `-`, all maintaining zero-floating-point integer paise accuracy.

---

## 👨‍👩‍👧‍👦 Scoping Cashflows by Family Entity

Using the **Family Filter Bar** at the top of the screen:
* **`👨‍👩‍👧‍👦 Combined Family`**: Aggregates all household cash inflows, outflows, and net invested capital across all members.
* **`👤 Ketan Vaghela (Self)`**: Isolates Ketan's freelance income allocations and direct equity trades on Zerodha Kite.
* **`💍 Parul Vaghela (Spouse)`**: Scopes to Parul's mutual fund SIP debits and salary investments on Groww.
* **`🏛️ Shamalbhai HUF`**: Isolates HUF trades to review capital gains realization and Section 112A tax shield progress.

---

## ➕ Recording a Transaction Manually

To log an unlisted trade, dividend credit, or cash adjustment:
1. Click the **Record Transaction** button in the header actions bar.
2. Select the **Transaction Type** (*Buy*, *Sell*, *Dividend*, *Deposit*, *Withdrawal*, *Fee*).
3. Select the **Owning Family Member** (e.g. `Ketan Vaghela`).
4. Select the **Demat / Folio Account** (e.g. `Zerodha Kite: Ketan Main`).
5. Choose an existing asset from your portfolio or enter a custom asset ticker and name.
6. Input the **Quantity**, **Price per Unit (₹)**, and any **Brokerage / STT Fees (₹)**.
7. Enter the **Execution Date & Time** and optional context notes.
8. Click **Save Transaction**. The ledger and cashflow KPIs update instantly.

---

## 🔄 Automated Ingestion via Broker Statements & CAS

Rather than logging trades manually, WealthNest provides two automated import methods:
1. **Zerodha Console Tradebook CSV (`tradebook.csv`)**:
   - Ingests hundreds of historical buy/sell executions with precise exchange timestamps and trade IDs via the **Import CAS** modal on `/portfolio`.
2. **Groww Orders CSV (`Orders.csv`)**:
   - Ingests direct equity and mutual fund orders downloaded directly from Groww.

See [Chapter 3: Portfolio Management & Live Feeds](./portfolio-management.md) for full instructions on automated statement ingestion.

---

## 🛡️ Support Mode Protection

When an administrator is viewing your account in **Support Impersonation Mode ("View as User")**:
- The **Record Transaction** button and row deletion icons are disabled.
- The ledger remains in a strictly read-only audit state, ensuring zero unintended state mutations during technical troubleshooting.
