# Chapter 2: Multi-Entity Family & Demat Portfolios

In India, personal wealth is rarely held in a single individual's name. Real-world wealth management spans spouses, children's future education funds, retired parents, and tax-efficient structures like Hindu Undivided Families (HUF).

WealthNest is purpose-built to model this reality through **Multi-Entity Legal Structures** and **Multi-Broker Demat Accounts**.

---

## 👨‍👩‍👧‍👦 Family Structure & Legal Entities

Each family member or legal entity is registered as a distinct PAN-holding unit:

| Member / Entity | Relationship | Primary Role | Connected Accounts Example |
| :--- | :--- | :--- | :--- |
| **Ketan Vaghela** | `Self` | Primary Investor / Freelance Contractor | Zerodha Kite Demat (`acc-zerodha`) |
| **Parul Vaghela** | `Spouse` | Working Professional (Bank Clerk) | Groww Direct Demat (`acc-groww`) |
| **Krisha Vaghela** | `Child` | Minor Daughter (Long-term compounding) | CAMS Mutual Fund Folio (`acc-cams`) |
| **Shamalbhai Vaghela HUF** | `HUF` | HUF Legal Entity (Tax Shield) | ICICI Direct HUF Demat (`acc-icici`) |
| **Ramilaben Vaghela** | `Parent` | Senior Citizen Mother | Bank of Baroda Senior Citizen FD & SGBs |

---

## 🏛️ The HUF Section 112A Tax Shield Explained

Under Indian Income Tax law, a **Hindu Undivided Family (HUF)** is recognized as a separate legal and tax-assessed entity with its own distinct Permanent Account Number (PAN).

### The Budget 2024 Capital Gains Advantage:
1. Under **Section 112A**, Long-Term Capital Gains (LTCG) on listed equity shares and equity mutual funds are taxed at **12.5%** on gains exceeding **₹1,25,000 per financial year**.
2. An investor holding all family equity under their personal PAN exhausts their single ₹1,25,000 exemption limit quickly.
3. By legally holding a portion of the family's equity portfolio under the **HUF entity**, the family receives a **second independent ₹1,25,000 annual LTCG exemption**.

$$
\text{Direct Annual Tax Saving} = ₹1,25,000 \times 12.5\% = ₹15,625.00 \text{ per year}
$$

> [!TIP]
> WealthNest automatically tracks your combined family capital gains and displays the active **HUF Tax Harvest Benefit** banner on `/portfolio` and `/analytics`, reminding you to harvest gains before March 31st each financial year.

---

## 🏦 Connecting Multiple Demat & Broker Accounts

In WealthNest, holdings and transactions are linked to specific broker accounts:

* **Direct Stock Demats**: Zerodha Kite, Groww, Upstox, ICICI Direct, HDFC Sky, Angel One.
* **Mutual Fund Folios**: CAMS, KFintech, AMC Direct Portfolios.
* **Government Debt & Savings**: Public Provident Fund (PPF), Bank Fixed Deposits (FDs), Sovereign Gold Bonds (SGBs).

Each account belongs to a specific family member, allowing you to filter your portfolio either by **Family Member** or by **Specific Broker Account**.

---

## 🔘 Using the Family Filter Bar

At the top of the **Portfolio**, **Analytics**, **Transactions**, **Goals**, and **Liabilities** screens, the **Family Filter Bar** provides instantaneous scoping:

1. **`👨‍👩‍👧‍👦 Combined Family`**: Aggregates all household holdings, total net worth, consolidated cashflows, and family milestone runway.
2. **`👤 Ketan (Self)`**: Displays only holdings and trades belonging to Ketan's Demat.
3. **`💍 Parul (Spouse)`**: Displays Parul's mutual fund SIPs, salary inflows, and liabilities.
4. **`🏛️ Shamalbhai HUF`**: Isolates HUF equity holdings to plan Section 112A tax harvesting.
5. **`👶 Krisha (Child)`**: Focuses purely on Krisha's long-term education funds and mutual fund compounding.
6. **`👵 Ramilaben (Mother)`**: Displays Senior Citizen Fixed Deposits and Sovereign Gold Bonds.

---

## ⚙️ Managing Entities & Accounts in Settings

To add or modify family members and Demats:
1. Navigate to **Settings (`/settings`)**.
2. Click on the **Family & Demats** tab.
3. Click **Manage Entities & Accounts**:
   * **Family Entities Tab**: Add new family members, specify relationship (`Spouse`, `Child`, `HUF`, `Parent`), assign a distinct color badge, and mask their PAN for reference.
   * **Demat & Folio Accounts Tab**: Register broker accounts, specify depository (`CDSL`, `NSDL`), and assign account ownership.
