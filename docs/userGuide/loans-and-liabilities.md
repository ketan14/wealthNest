# Chapter 5: Loans, Liabilities & True Net Worth

Managing wealth requires tracking not only what you own, but also what you owe. The **Liabilities Dashboard (`/liabilities`)** reconciles mortgages, car loans, collateral liens, and monthly EMI commitments to calculate your **True Net Worth**.

---

## 💳 Supported Loan Types & Indian Debt Instruments

WealthNest supports common Indian retail and corporate liabilities:

| Loan Category | Typical Lender | Typical Terms | Real-World Example |
| :--- | :--- | :--- | :--- |
| **Home Mortgage** | SBI, HDFC Bank, ICICI Bank | 15–25 Years, Floating Rate | `SBI Green Home Loan` (₹48.5L Principal, 8.5% interest) |
| **Auto Loan** | HDFC Bank, Bank of Baroda | 5–7 Years, Fixed Rate | `HDFC EV Auto Loan` (₹8.2L Principal, 8.75% interest) |
| **Loan Against Securities (LAS)** | Zerodha Capital, Mirae Asset | Floating, Linked to Demat shares | Collateralized credit line against bluechip equities |
| **Personal & Consumer Loans** | Banks & NBFCs | 1–3 Years, Unsecured | Short-term bridge financing |

---

## 👥 Primary Borrowers & Joint Co-Borrowers

In India, home loans and vehicle loans frequently involve spouses or family members as **Joint Co-Borrowers** to increase borrowing eligibility and claim dual tax deductions under Section 24(b) and Section 80C.

### How WealthNest Models Joint Debt:
1. **Primary Borrower**: The individual whose bank account services the primary auto-debit (e.g. `Ketan Vaghela` for the Home Loan).
2. **Joint Co-Borrowers**: Co-applicants on the loan agreement (e.g. `Parul Vaghela` as joint applicant on the SBI Home Loan).
3. **Filtering Behavior**:
   * Viewing `Combined Family`: Reflects total household liability of all loans.
   * Viewing `Ketan (Self)`: Displays the home loan where Ketan is primary applicant.
   * Viewing `Parul (Spouse)`: Displays the auto loan (where Parul is primary applicant) **and** the home loan (where Parul is registered as joint co-borrower).

---

## 🏡 Collateral Linking & Loan-to-Value (LTV) Ratios

For secured liabilities (home mortgages and loans against shares), WealthNest links the debt to the underlying asset:

$$
\text{Loan-To-Value (LTV) Ratio} = \frac{\text{Current Outstanding Principal}}{\text{Current Market Value of Collateral}} \times 100\%
$$

* **Safe Threshold**: LTV $< 70\%$ (Health status badge: `🟢 Safe`).
* **Elevated Risk**: LTV $> 80\%$ (Health status badge: `🟡 Watchlist`).

Linking collateral ensures that as property values appreciate or equity prices rise, your effective leverage ratio automatically recalculates.

---

## ⚖️ Reconciling True Net Worth

Your Net Worth is not simply the total value of your stock portfolio. WealthNest computes your true financial position:

$$
\text{True Household Net Worth} = \sum \text{Assets} - \sum \text{Outstanding Liabilities}
$$

The top metrics card on `/liabilities` breaks down:
* **Gross Household Assets**: Total liquid + illiquid holdings across all registered Demats and accounts.
* **Total Outstanding Debt**: Total principal remaining across all family loans.
* **Monthly EMI Outflow**: Total monthly cash commitment across all loans, integrated directly into your emergency runway burn rate.
* **Debt-to-Asset Ratio**: Benchmark indicating financial solvency and borrowing capacity.

---

## ➕ Adding a New Liability

1. Navigate to **Liabilities (`/liabilities`)** and click **Add Loan / Liability**.
2. Enter the **Liability Name** (e.g. *SBI Green Home Loan*).
3. Select the **Liability Type** (*Home Mortgage*, *Auto Loan*, *Education Loan*, *Personal Loan*, *Loan Against Securities*).
4. Select the **Primary Borrower** from the family dropdown (e.g. `Ketan Vaghela`).
5. Toggle any **Joint Co-Borrowers** (e.g. click `Parul Vaghela` to highlight as joint applicant).
6. Enter **Lender Name**, **Original Principal (₹)**, and **Current Outstanding Balance (₹)**.
7. Input **Interest Rate %**, **Monthly EMI Amount (₹)**, and **Loan End Year**.
8. Click **Save Liability**. The loan card, EMI tracker, and net worth recalculate immediately.
