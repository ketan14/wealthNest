# Chapter 4: Financial Goals & Reverse SIP Engine

A portfolio without defined financial milestones is just an aimless collection of tickers. The **Goals Dashboard (`/goals`)** helps Indian families structure their wealth around life milestones, computing inflation-adjusted target corpuses and required monthly SIPs.

---

## 🎯 Milestone Types & Real-World Examples

WealthNest supports multiple categories of life goals with dedicated timeline projections:

| Milestone Name | Goal Category | Beneficiary Member | Target Horizon | Real-World Context |
| :--- | :--- | :--- | :--- | :--- |
| **Krisha Higher Education** | `education` | **Krisha Vaghela** *(Child)* | 12 Years | Target corpus for engineering/MBA (BITS/Ivy League) adjusting for 8% education inflation. |
| **Ketan & Parul Retirement & FIRE** | `retirement` | **Ketan Vaghela** *(Self)* | 15 Years | Financial Independence / Retire Early corpus generating passive inflation-adjusted monthly income. |
| **Luxury Family Villa / Home** | `home` | **Combined Family** | 5 Years | Down-payment corpus for a family property in Gujarat/Mumbai. |
| **Parents' Pilgrimage & Healthcare** | `healthcare` | **Shamalbhai HUF / Ramilaben** | 3 Years | Senior citizen medical contingency buffer and pilgrimage travel fund. |

---

## 🧮 The Reverse SIP Calculation Engine

Instead of guessing how much you need to save each month, WealthNest uses the **Future Value Annuity Formula** to solve for your exact required monthly SIP:

$$
\text{Required Monthly SIP} = \frac{\text{Future Target Corpus} \times r}{(1 + r) \times \left[(1 + r)^n - 1\right]}
$$

Where:
* $r = \frac{\text{Expected Annual Return \%}}{12 \times 100}$ (Monthly Compounded Rate)
* $n = \text{Horizon in Years} \times 12$ (Total Monthly Compounding Periods)

### Incorporating Inflation:
If a child's higher education costs ₹35 Lakhs today and college is 12 years away with an education inflation rate of 8%:

$$
\text{Inflation-Adjusted Target} = ₹35,00,000 \times (1 + 0.08)^{12} \approx ₹88,13,000 \text{ (₹88.13 Lakhs)}
$$

WealthNest calculates both the raw target and the inflation-adjusted corpus, displaying the exact monthly SIP commitment required to stay on track.

---

## 🛡️ Emergency Fund Runway Buffer

At the top of the Goals screen, WealthNest computes your household **Emergency Fund Runway**:
* **Monthly Burn Rate**: Computes aggregate household living expenses + active monthly EMI commitments.
* **Liquid Reserves**: Sums Cash & Bank balances, liquid mutual funds, and short-term Fixed Deposits.
* **Runway Calculation**:
  $$
  \text{Runway (Months)} = \frac{\text{Total Liquid Reserves}}{\text{Monthly Burn Rate}}
  $$
* **Recommended Target**: 6 to 12 months of total expenses. The card provides a health status badge (`🟢 Healthy: 9.4 Months` or `🟡 Moderate`).

---

## 👨‍👩‍👧‍👦 Scoping Goals by Family Beneficiary

Using the **Family Filter Bar** on `/goals`:
* Select **`Krisha (Child)`**: Instantly filters the view to display only Krisha's education milestone, showing progress bar, allocated mutual fund SIPs, and remaining gap.
* Select **`Ketan (Self)`**: Shows the FIRE retirement milestone and personal wealth trajectory.
* Select **`Shamalbhai HUF`**: Shows senior citizen healthcare contingency and conservative debt milestones.

---

## ➕ Creating a New Milestone

1. Navigate to **Goals (`/goals`)** and click **Create Goal**.
2. Enter the **Milestone Title** (e.g. *Krisha Overseas Masters Degree*).
3. Select the **Goal Category** (*Education*, *Retirement*, *Home*, *Vehicle*, *Travel*, *Emergency*).
4. Select the **Beneficiary Member** (e.g. `Krisha Vaghela`).
5. Specify the **Target Amount (₹)** and **Target Completion Year**.
6. Enter expected investment return (e.g. `12%` for equity funds) and expected inflation (e.g. `7%`).
7. Click **Create Goal**. The milestone card immediately appears with progress tracking and SIP recommendations.
