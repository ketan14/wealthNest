# WealthNest End-User Frequently Asked Questions (FAQ)

**Document:** User FAQ & Common Queries  
**Audience:** WealthNest End Users, Household Owners, Family Members  
**Version:** 1.0.0  

---

### 1. General & Household Organization

#### Q1.1: Do all family members need separate email addresses and login accounts?
**No.** WealthNest is intentionally built around managed family profiles. As the Household Owner or Administrator, you can create family profiles for your spouse, children, parents, or HUF without entering an email address. You can record assets, mutual funds, gold, and loans under their profiles immediately. If a family member later wants to log in themselves, you can invite them using their email address.

#### Q1.2: What is the difference between a "Household" and a "Family Member Profile"?
- A **Household** is a shared financial workspace. It represents the family unit and holds all common financial ledgers, settings, and documents.
- A **Family Member Profile** represents an individual person or legal entity (such as an HUF) within that household. Assets and liabilities are owned by family member profiles, not directly by login accounts.

#### Q1.3: Can I belong to more than one household?
**Yes.** For example, an adult user can be a member of their marital household (managing finances with their spouse) and simultaneously a member or viewer in their parents' household. You can switch between active households at any time using the **Household Switcher** dropdown in the top navigation bar. Your financial figures are kept completely separate between households.

#### Q1.4: Can two family members jointly own an asset or property?
**Yes.** When adding or editing any holding (such as a mutual fund or stock) or real estate property, you can add multiple co-owners and assign their exact ownership percentages (for example, 50% / 50% or 70% / 30%). WealthNest guarantees that the sum of shares must equal exactly 100.00%, and divides net worth down to the exact paisa with zero rounding drift.

---

### 2. Privacy & Access Control

#### Q2.1: Can household administrators or the primary owner see my private investments?
**No.** If you mark an asset, liability, or document as **`Owner Only`**, it is visible **strictly to you** (and any other co-owners of that specific record). Even the Household Primary Owner and Administrators cannot see it or edit it. Furthermore, private records are excluded when an administrator views aggregated family net worth, preventing privacy leakage through total calculations.

#### Q2.2: What are the three privacy levels?
- **Household Shared:** Visible to all active members of the household (Owner, Admins, Members, Viewers). Ideal for the family home, shared emergency funds, or joint investments.
- **Owner Only:** Visible strictly to the financial owner(s) of that record. Hidden from all other household members.
- **Restricted:** Visible to the owner plus specific household members you explicitly select. Useful for sharing an investment with a spouse while keeping it confidential from parents or children.

#### Q2.3: What is the difference between a "Household Admin" and a "Household Primary Owner"?
Every household has **exactly one Primary Owner** who holds complete governance authority (transferring ownership, appointing administrators, or deleting the household). An **Administrator** can manage household-shared records and invite members, but cannot appoint other administrators, cannot transfer ownership, and cannot bypass private records.

#### Q2.4: What can a user with the "Viewer" role do?
A user with the **Viewer** role has read-only access. They can inspect household-shared net worth, asset allocations, goals, and shared family documents, but cannot add, edit, or delete any records.

---

### 3. Financial Ledgers, Loans & Valuations

#### Q3.1: How often should I update property valuations?
We recommend updating property valuations whenever you receive an official municipal assessment, property tax receipt, or reliable local market benchmark (e.g. annually or bi-annually). WealthNest records each valuation with a specific date and notes, preserving your historical net worth progression over time.

#### Q3.2: Why does an EMI payment not reduce the loan balance by the full payment amount?
A loan payment (EMI) consists of two parts: **Principal Repayment** and **Interest Payment**. Only the principal portion reduces your outstanding debt; the interest is the borrowing cost charged by the lender. WealthNest automatically bifurcates each EMI payment so your balance sheet remains mathematically accurate.

#### Q3.3: How should I record money transferred between my own bank accounts?
When moving money between your own accounts (for example, transferring ₹50,000 from your SBI Savings account to your Zerodha Demat trading account), select **Transfer** as the transaction type. Internal transfers move funds between balance sheets but have **zero net impact** on family cash flow, preventing your living expenses or income from being artificially inflated.

#### Q3.4: What happens if I make a lump-sum prepayment on my home loan?
You can use the **Loan Prepayment Simulator** on the Loans & Liabilities page. Enter your planned prepayment amount and date to instantly see how many months your loan tenure will be reduced, and how many thousands or lakhs of rupees you will save in cumulative interest charges!

---

### 4. Data Safety & Troubleshooting

#### Q4.1: How do I hide my financial numbers when using WealthNest in public?
Click the **Eye icon** in the top navigation bar (or press `Ctrl+K` and search for "privacy"). This activates **Privacy Mode**, instantly masking all monetary balances with `••••••` across all pages, charts, and tables.

#### Q4.2: What file formats are supported for the Document Vault?
WealthNest supports **PDF**, **PNG**, **JPG**, and **JPEG** files up to a maximum size of **20 Megabytes (MiB)** per file. All uploaded files are stored in a private vault bucket and are only accessible through secure, time-limited download links.

#### Q4.3: What should I do if my mutual fund CAS statement fails to import?
1. Ensure the file is an official Consolidated Account Statement (CAS) in **PDF format** generated from CAMS (`camsonline.com`) or KFintech.
2. Verify that you have entered the correct PDF password (typically your PAN in uppercase or your registered email address).
3. If the statement is an Excel or CSV file, use the manual **+ Add Holding** option instead.

#### Q4.4: How can I back up my financial data?
Navigate to **Settings** > **Data Portability**. Click **Export JSON Backup** or **Export CSV (Excel)** to download a complete, offline snapshot of all your household holdings, liabilities, properties, and transactions to your computer.
