# Chapter 6: Analytics, Performance & Budget 2024 Tax

The **Analytics Dashboard (`/analytics`)** combines mathematical portfolio modeling with Indian tax optimization. It calculates exact money-weighted returns (XIRR), compares performance against domestic benchmarks, and tracks your **Union Budget 2024 Capital Gains Tax** liabilities.

---

## 📈 Institutional Performance Mathematics

### 1. Extended Internal Rate of Return (XIRR)
* Most retail investors mistakenly rely on simple percentage gains, which ignore the timing of monthly SIP installments and lump-sum investments.
* WealthNest solves for exact **XIRR** using the **Newton-Raphson numerical algorithm**:

$$
\sum_{i=1}^{n} \frac{C_i}{(1 + \text{XIRR})^{\frac{d_i - d_1}{365}}} = 0
$$

Where $C_i$ is each cashflow (negative for SIP investments, positive for current valuation and dividends) on date $d_i$.

### 2. Benchmark Comparisons & Alpha
WealthNest benchmarks your family portfolio against standard Indian indices:
* **Nifty 50 TRI (Total Returns Index)**: Represents the top 50 bluechip Indian companies including reinvested dividends.
* **Sensex TRI**: Top 30 companies on the Bombay Stock Exchange (BSE).
* **Sovereign Gold Bonds (SGB)**: Gold price appreciation + 2.5% annual sovereign interest.
* **SBI 1-Year Fixed Deposit**: Conservative risk-free return baseline (~6.80% p.a.).

**Alpha ($\alpha$)** measures your outperformance:
$$
\text{Alpha} = \text{Portfolio XIRR} - \text{Nifty 50 TRI Return}
$$
A positive alpha (e.g. `+3.42% Alpha`) indicates your asset allocation and stock selection beat the passive index.

---

## 🏛️ Union Budget 2024 Capital Gains Tax Rules

On July 23, 2024, the Government of India introduced comprehensive changes to the taxation of listed equities and mutual funds:

| Capital Gains Category | Holding Period | Budget 2024 Tax Rate | Annual Exemption Threshold |
| :--- | :--- | :---: | :--- |
| **Long-Term Capital Gains (LTCG)** | $> 12 \text{ Months}$ | **12.5%** | **₹1,25,000 per PAN entity per FY** |
| **Short-Term Capital Gains (STCG)** | $\le 12 \text{ Months}$ | **20.0%** | None (taxed from first Rupee) |
| **Debt Mutual Funds** | All holding periods | Slab Rate | Taxed at individual income slab rate |
| **Sovereign Gold Bonds (SGB)** | Held to 8-Year Maturity | **0% (Tax-Free)** | 100% Capital Gains Exemption under Section 47 |

---

## 🌾 Multi-Entity Tax Harvesting with HUF

Because tax exemptions are granted per PAN card under **Section 112A**:
* **Individual PAN (Ketan Vaghela)**: First ₹1,25,000 of LTCG is tax-exempt.
* **HUF PAN (Shamalbhai Vaghela HUF)**: Separate ₹1,25,000 of LTCG is tax-exempt.

### Maximizing Your Family Exemption:
If the family realizes ₹2,50,000 in equity gains in a financial year:
* **Under a single PAN**: Taxable gain is $₹2,50,000 - ₹1,25,000 = ₹1,25,000$. Tax owed = $₹1,25,000 \times 12.5\% = ₹15,625$.
* **Splitting between Self & HUF**: Both entities utilize their full ₹1.25 Lakh exemption. **Total Tax Owed = ₹0.00**.

> [!TIP]
> **Annual March 31 Tax Harvesting**:
> Sell appreciated shares to book up to ₹1,25,000 in gains under each PAN before March 31st and immediately repurchase them. This resets your cost basis upwards with zero tax liability!

---

## 📉 Tax-Loss Harvesting Engine

If certain stocks or mutual funds are currently trading below your purchase price (unrealized loss), the **Tax-Loss Harvesting Radar** on `/analytics` alerts you:
1. Selling loss-making positions allows you to **offset gains**:
   * Short-Term Capital Losses can offset both STCG and LTCG.
   * Long-Term Capital Losses can offset LTCG.
2. Unabsorbed capital losses can be carried forward for **8 consecutive assessment years** under Section 74 of the Income Tax Act.

---

## 🎯 Asset Allocation Drift & Rebalancing Radar

Over time, rising stock markets cause equity weights to exceed target allocations (e.g. expanding from 60% to 75% of your net worth), increasing risk.

The **Rebalancing Radar** analyzes:
* **Current Allocation vs Target Allocation**: Highlights overweighted and underweighted asset classes.
* **Rebalancing Recommendations**: Suggests directing fresh monthly SIPs towards underweighted asset classes (e.g. Fixed Income or Gold) to restore balance without triggering taxable sales.
