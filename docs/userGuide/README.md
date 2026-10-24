# WealthNest User Guide & Documentation

Welcome to the **WealthNest User Guide** — an institutional-grade, privacy-first personal wealth and multi-entity asset management system engineered specifically for Indian investors and households.

---

## 📚 Guide Table of Contents

| Chapter | Topic | Description |
| :--- | :--- | :--- |
| **01. [Getting Started](./getting-started.md)** | Setup & Tour | Quickstart guide, local environment URLs, Interactive Demo Mode vs Registered User, and privacy architecture. |
| **02. [Family & Demats](./family-and-demats.md)** | Legal Entities & Brokers | Organizing household wealth across Self, Spouse, HUF, Children, and Parents; connecting Demats; and unlocking the **HUF Section 112A Tax Shield**. |
| **03. [Portfolio Management](./portfolio-management.md)** | Assets & Live Feeds | Direct Equities, Mutual Funds, SGBs, Fixed Income, Automated CAS PDF Statement Ingestion, and Real-Time NSE/BSE CMP & AMFI NAV Feeds. |
| **04. [Financial Goals](./financial-goals.md)** | Milestones & Reverse SIP | Inflation-adjusted milestone corpus planning (e.g. Higher Education, FIRE), linking family beneficiaries, required monthly SIP calculator, and emergency runway buffer. |
| **05. [Loans & Liabilities](./loans-and-liabilities.md)** | Debt & True Net Worth | Tracking home and auto loans, managing primary and joint co-borrowers, EMI schedules, collateral linking, and net worth reconciliation. |
| **06. [Analytics & Tax](./analytics-and-tax.md)** | Returns & Budget 2024 Tax | Performance math (XIRR, CAGR), Nifty 50 TRI benchmark comparison, Union Budget 2024 Capital Gains Tax (LTCG 12.5% over ₹1.25L, STCG 20%), and Tax-Loss Harvesting radar. |

---

## 🇮🇳 The India-First Philosophy

WealthNest is built from the ground up to respect Indian financial conventions and regulations:
* **Indian Numbering Format**: Values are presented in `₹ Lakhs` (`₹ L`) and `₹ Crores` (`₹ Cr`) with `en-IN` precision.
* **Zero Floating-Point Drift**: All currency storage and math is handled in integer paise (`BigInt` / integer cents), preventing rounding drift.
* **Multi-Entity Tax Shield**: Full support for Hindu Undivided Family (HUF) entities and separate PANs to harvest individual ₹1,25,000 annual LTCG exemptions under Section 112A.
* **100% Client-Side CAS Privacy**: Consolidated Account Statements (CAS) from CDSL and NSDL are parsed entirely in your browser memory — your PAN, passwords, and holdings are never uploaded to any external server.

---

## 💡 Quick Tips for New Users

> [!TIP]
> **Use the Family Filter Bar**: At the top of nearly every screen (`/portfolio`, `/analytics`, `/transactions`, `/goals`, `/liabilities`), use the **Family Filter Bar** pills (`👨‍👩‍👧‍👦 Combined Family`, `👤 Ketan`, `💍 Parul`, `🏛️ HUF`, `👶 Krisha`, `👵 Mother`) to instantly switch between your aggregate household net worth and individual legal entity views.

> [!NOTE]
> **Real-Time Market Feeds**: During Indian market hours (09:15 to 15:30 IST on weekdays), the green `NSE/BSE: OPEN` indicator lights up in your Portfolio dashboard. Toggle `Auto-Poll: ON` for automated live stock price ticks every 25 seconds.
