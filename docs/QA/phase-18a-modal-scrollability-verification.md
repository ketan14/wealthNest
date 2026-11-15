# Phase 18A: Responsive Modals, Bottom Sheets & CAS Preview Scrollability Verification

**Test Target Architecture**: All **23** modal dialogs, overlay pickers, and mobile bottom sheets standardized onto [`ResponsiveModalShell.tsx`](file:///home/ketan/projects/Krisha/wealthNest/apps/web/src/components/ui/ResponsiveModalShell.tsx), plus the 4 child steps of [`ImportCasModal.tsx`](file:///home/ketan/projects/Krisha/wealthNest/apps/web/src/components/portfolio/ImportCasModal.tsx).  
**Primary Automation Suite**: [`ResponsiveModalScrollability.test.tsx`](file:///home/ketan/projects/Krisha/wealthNest/apps/web/src/__tests__/ResponsiveModalScrollability.test.tsx) (`8` tests)

---

## 1. Test Viewport Matrix

Test every modal checklist group below across **3 required viewport profiles** in Chrome DevTools Device Toolbar (or real Android / desktop screens):

| Viewport Profile | Dimensions | Simulates | Critical Failure Mode Caught |
| :--- | :---: | :--- | :--- |
| **Mobile Portrait** | `360 × 780` & `390 × 844` | Standard Android / iPhone viewport | Off-screen `Confirm & Import`, badge wrapping collisions, crushed multi-column tables |
| **Mobile Short / Soft-Keyboard** | `360 × 480` | Landscape phone or virtual keyboard open | Fixed footers pushed behind keyboard or clipped beyond `100vh`; `min-h-0` missing on scroll flex parent |
| **Desktop** | `1280 × 800` | Web & Tauri desktop window | Centered dialog regressions, multi-column grid spacing, keyboard shortcuts |

---

## 2. Global Pass Criteria (Apply to Every Popup / Modal)

1. **Dynamic Height Clamp**: The modal panel never exceeds `90dvh` (`82dvh` for Command Palette), with **zero** clipped edges or cut-off buttons at top or bottom.
2. **Pinned Header & Action Footer**: Modal titles, close (`X`) icons, and bottom primary CTA buttons (`Confirm & Import (...)`, `Save ...`, `Close`, `Done`, etc.) remain **fixed and immediately clickable** at all scroll positions.
3. **Independent Body Scrolling**: Scrolling long forms, large tables, or JSON payloads moves **only** the middle modal body (`overflow-y-auto overscroll-contain`), without scrolling the background page (`body`).
4. **No Horizontal Page Overflow**: Entire app page stays locked at viewport width; wide preview tables scroll horizontally **inside** their own table container (`min-w-[600px] overflow-auto`).
5. **Responsive Controls & Safe Areas**: Header badges/titles wrap cleanly (`flex-wrap`), bottom sheets / low-clearance dialogs clear the bottom gesture bar, and HTML forms submit properly when clicking footer buttons or pressing `Enter`.

---

## 3. Automated Regression Gate (Run Before Manual QA)

```bash
./node_modules/.bin/tsc -b
npm test --workspace=@wealthnest/web -- src/__tests__/ResponsiveModalScrollability.test.tsx --run
npm test -- --run
npm run build --workspace=@wealthnest/web
```

What is verified automatically:
- `ResponsiveModalShell`: `max-h-[90dvh]`, `overflow-hidden`, `shrink-0` header/footer, `flex-1 min-h-0 overflow-y-auto overscroll-contain` middle scroll area, `formProps` submission across scrollable body + pinned footer, `variant="sheet"` safe-area padding (`pb-[env(safe-area-inset-bottom)]`), and `portal` rendering.
- `ImportCasModal` (55-row Zerodha CSV stress test): `[data-testid="cas-preview-scroll-body"]` scrolls independently outside `[data-testid="cas-preview-actions-footer"]` (`shrink-0`), horizontal table `min-w-[600px]` wrapper uses `overflow-auto`, and a single `Confirm & Import (55 Equities, 0 Mutual Funds)` button stays pinned and completes import through `CasSummaryStep`.
- Contract smoke checks on `ConfirmActionModal`, `ManageFamilyModal`, `GlobalQuickAddModal`, and `AddHoldingModal`.

---

## 4. Priority 0 Manual QA: CAS Import Wizard (50+ Dynamic Holdings)

**Route**: `/portfolio` ➔ Click **Import CAS** button.

### Step 4.1 — Upload Step ([`CasUploadStep.tsx`](file:///home/ketan/projects/Krisha/wealthNest/apps/web/src/components/portfolio/CasUploadStep.tsx))
1. Open the modal at `360 × 780` and `360 × 480`.
2. **Check Header**: Verify title `Import Investments from NSDL / CDSL / CAMS CAS` and pill badge `Phase 2.1 & CAMS` wrap cleanly without colliding with the `X` close icon.
3. **Check Source Grid**: Verify the 3 source buttons (**CAS PDF**, **Zerodha Kite (CSV)**, **Groww (CSV)**) stack vertically (`grid-cols-1`) on `< 640px` and sit in 3 columns on desktop.
4. **Check Sticky Footer**: Scroll down inside the upload body (including the quick fixture buttons at the bottom) and confirm **Cancel** and **Parse Statement** stay anchored at the bottom of the dialog.

### Step 4.2 — Preview Step with 50+ Holdings ([`CasPreviewStep.tsx`](file:///home/ketan/projects/Krisha/wealthNest/apps/web/src/components/portfolio/CasPreviewStep.tsx) & [`CasPreviewTables.tsx`](file:///home/ketan/projects/Krisha/wealthNest/apps/web/src/components/portfolio/CasPreviewTables.tsx))
1. Upload a CDSL/NSDL CAS PDF containing **50+ equities** (or upload a 55+ row Zerodha/Groww CSV, and also verify **"Load Sample CDSL CAS"** & **"Load Sample CAMS / KFintech CAS"**).
2. At `360 × 780` and `360 × 480`:
   - Confirm **`Confirm & Import (...)`** is **immediately visible and clickable** at the bottom of the modal without needing to fight inner table scroll.
   - Verify mobile button stacking order inside the pinned footer: **`Confirm & Import (...)`** renders first (`w-full`) on `< 640px`, with **`Back to Upload`** and **`Cancel`** neatly below it; on Desktop (`1280 × 800`), buttons align inline horizontally.
   - Scroll the outer preview body down to inspect metadata (`Provider`, `Statement Date`, `Reported Value`), **Assign To Legal Entity / Member** & **Assign Demat / Broker Account** dropdowns, and tab buttons (**Direct Equities & ETFs**, **Mutual Funds**, **Historical Transactions**).
   - Inside **Direct Equities & ETFs (50+)**: confirm the selection ribbon (**Found X stocks**, **Selected: ₹...**, **Select All**, **Deselect All**) wraps cleanly without overlapping text, scroll vertically through row 1 to row 50+, and swipe horizontally inside the table to verify **Qty**, **Price**, and **Value** columns stay legible (`min-w-[600px]`).
   - Switch to **Mutual Funds** and **Historical Transactions** tabs and confirm horizontal + vertical scrolling and intact pinned footer across every tab.
3. Uncheck 1 row in **Direct Equities & ETFs** and verify the pinned **`Confirm & Import (...)`** counter decrements dynamically.
4. Click **`Confirm & Import (...)`**.

### Step 4.3 — Summary Step ([`CasSummaryStep.tsx`](file:///home/ketan/projects/Krisha/wealthNest/apps/web/src/components/portfolio/CasSummaryStep.tsx))
1. On completion (`CAS Import Completed Successfully!`), test at `360 × 480`.
2. Confirm summary metric cards scroll smoothly if needed and **`View Updated Portfolio`** stays pinned at the bottom of the dialog.

---

## 5. Group A Manual QA: Navigation Sheets & High-Risk Overlays (4 Modals)

| Modal / Component | Where to Open | Viewport & Scroll Verification Steps | Expected Pinned Control |
| :--- | :--- | :--- | :--- |
| **"More Modules" Sheet** (`BottomNavigationBar.tsx`) | Mobile `< 768px` only ➔ Bottom nav **More** tab | Open on `360 × 780` & `360 × 480`. Scroll list of navigation destinations (`Real Estate`, `Analytics`, `Goals`, `Documents`, `Settings`, `Admin` if applicable). Confirm bottom padding clears Android gesture bar. | Slide-up handle & header; safe bottom clearance |
| **Command Palette** (`CommandPaletteModal.tsx`) | Any authenticated page ➔ `Ctrl+K` / `⌘K` or top Search trigger | Open on `360 × 780`, `360 × 480`, and `1280 × 800`. Type a query filtering routes/holdings; confirm palette clamps within `82dvh` and results list scrolls without pushing search box off-screen. | Pinned search input at top (`shrink-0`) |
| **Confirm Action Modal** (`ConfirmActionModal.tsx`) | `/portfolio`, `/transactions`, `/liabilities`, `/goals`, `/documents` ➔ Click any Delete button | Open on `360 × 780` & `360 × 480`. Verify overlay fills `100dvh` cleanly, message scrolls if viewport is short, and buttons preserve `>= 44px` tap targets. | **Confirm** / **Cancel** row pinned at bottom |
| **Audit Payload Modal** (`AdminAuditLogsPage.tsx`) | `/admin/audit-logs` ➔ Click **Payload** on any audit row | Open on `360 × 780` & `360 × 480`. Inspect long JSON metadata payload; verify 1-col metadata on mobile, 2-col on desktop, and inner JSON `<pre>` + modal scroll within `90dvh`. | **Close** button pinned at bottom |

---

## 6. Group B Manual QA: Multi-Tab & Dynamic List Dialogs (3 Modals)

| Modal / Component | Where to Open | Viewport & Scroll Verification Steps | Expected Pinned Control |
| :--- | :--- | :--- | :--- |
| **Manage Family Entities & Accounts** (`ManageFamilyModal.tsx` & `ManageFamilyAccountsTab.tsx`) | Family bar ➔ **Manage Entities** (on `/portfolio`, `/real-estate`, `/liabilities`, `/transactions`, `/analytics`, `/goals`, `/documents`, `/settings`) | Test on `360 × 780` & `360 × 480`. Scroll entity cards, confirm PAN/Primary/broker pills wrap without horizontal overflow, expand the add-entity form, verify fields + color swatches scroll cleanly, then switch to **Demat / Broker Accounts** tab and toggle visibility/add account. | Tab bar pinned below header; **Close** pinned at bottom |
| **Global Quick Add Sheet** (`GlobalQuickAddModal.tsx`) | Mobile `< 768px` bottom nav center **+** button | Open on `360 × 780` & `360 × 480`. Verify bottom-sheet alignment (`items-end`) on mobile vs centered dialog on desktop, swipe-friendly scroll over action cards, and bottom safe-area inset. | **Cancel** pinned in bottom footer |
| **Terms & Privacy Modal** (`TermsPrivacyModal.tsx`) | `/signup` ➔ Click **Terms of Service** or **Privacy Policy** | Open on `360 × 780` & `360 × 480`. Scroll all legal sections cleanly without moving background `/signup` form. | Header `Dismiss` button + single **Close** button pinned in footer |

---

## 7. Group C Manual QA: Standardized Data-Entry & Admin Forms (15 Modals)

For every form below, open at **`360 × 780`** and **`360 × 480`**, scroll from top field to bottom field, toggle any conditional radio/select fields (which expand dynamic inputs), and confirm:
1. All form inputs remain reachable by scrolling without overlapping the header or footer.
2. Submitting the form works via clicking the pinned footer button (never detached outside `<form>`).

| Domain | Modal Component | How to Open (Route & Trigger) | Dynamic Inputs to Exercise | Pinned Footer CTA |
| :--- | :--- | :--- | :--- | :--- |
| **Portfolio** | `AddHoldingModal.tsx` | `/portfolio` ➔ **Add Holding** | Switch **Investment Class** between `Equities & Stocks` and `Mutual Funds` (expands Folio/AMC/Scheme fields) | **Save Position** |
| **Portfolio** | `EditHoldingModal.tsx` | `/portfolio` ➔ Edit icon on any holding row | Modify quantity / valuation fields across `360 × 480` | **Save Updated Valuation** |
| **Transactions** | `RecordTransactionModal.tsx` | `/transactions` ➔ **Record Transaction** | Switch transaction type (**Expense**, **Income**, **Buy**, **Sell**, **Dividend**, **Transfer**) & pick linked account | **Save Transaction** |
| **Liabilities** | `AddLiabilityModal.tsx` | `/liabilities` ➔ **Add Loan / Liability** (or **Edit loan details**) | Switch loan category, set Family Member & Co-Borrower selects, verify 2-col grids stack cleanly on mobile | **Create Loan** / **Save Changes** |
| **Liabilities** | `UpdateBalanceModal.tsx` | `/liabilities` ➔ **Bal** on a loan row | Expand Balance History list (`max-h-36` nested scroll) while verifying outer modal + pinned CTA never clip | **Record Balance** |
| **Liabilities** | `UpdateValuationModal.tsx` | `/liabilities` ➔ Property equity appraisal action on collateral-linked loan | Scroll market value input & valuation date at `360 × 480` | **Update Valuation** |
| **Liabilities** | `RecordEmiPaymentModal.tsx` | `/liabilities` ➔ **Pay EMI** on a loan row | Enter payment amount/date/notes and check EMI split preview box | **Record Payment** |
| **Real Estate** | `PropertyMetricsModal.tsx` | `/real-estate` ➔ **Configure** on a property card | Scroll purchase price, monthly rent, area sq.ft., and city fields at `360 × 480` | **Save Metrics** |
| **Goals** | `AddGoalModal.tsx` | `/goals` ➔ **Create Financial Goal** | Toggle beneficiary family member dropdown, inflation %, target amount & target year at `360 × 480` | **Save Financial Goal** |
| **Vault** | `UploadDocumentModal.tsx` | `/documents` ➔ **Upload Document** | Pick PDF/image file, category tag, family member & linked asset at `360 × 480` | **Save to Vault** |
| **Auth** | `BackendConnectionModal.tsx` | `/login` or `/signup` ➔ **Configure** in backend status bar | Switch mode / edit Supabase URL + Anon Key; test validation error banner + Save flow | **Save & Connect** |
| **Auth** | `ForgotPasswordModal.tsx` | `/login` ➔ **Forgot password?** link | Submit email recovery request on `360 × 480` | **Send Reset Link** |
| **Admin** | `AdminUserProvisionModal.tsx` | `/admin/users` ➔ **Create User** or **Invite Investor** | Toggle **Direct Create (with Password)** vs **Invite via Email**; verify generated-credentials view hides submit footer cleanly and shows **Done** button | **Create Account** / **Send Invitation** ➔ **Done** |
| **Admin** | `AdminUserStatusModal.tsx` | `/admin/users` or `/admin/users/:userId` ➔ **Suspend Access** / **Reactivate Account** (or role/status action) | Select status/role + enter audit reason textarea on `360 × 480` | **Confirm Status Change** |
| **Admin** | `ViewAsUserModal.tsx` | `/admin/users/:userId` ➔ **View Application as User** | Enter support justification reason (`>= 10` chars) and verify warning callout scrolls on `360 × 480` | **Start Support Session** |

---

## 8. QA Signoff Matrix (Complete After Manual Testing)

| Area Verified | Viewport(s) Tested | Result | Tester / Notes |
| :--- | :--- | :---: | :--- |
| Automated Regression Suite (`ResponsiveModalScrollability.test.tsx`) | JSDOM | ✅ PASS | 8/8 structural & 55-row CAS preview tests passing |
| Priority 0: `ImportCasModal` (50+ Equities + MF + Transactions) | Mobile + Keyboard + Desktop | ⏳ Pending QA | Verify real CDSL/NSDL PDF + CSV `Confirm & Import (...)` tap |
| Group A Overlays (4 modals/sheets) | Mobile + Keyboard + Desktop | ⏳ Pending QA | Verify Command Palette, More Modules, Confirm, Audit Logs |
| Group B Dialogs (3 modals) | Mobile + Keyboard + Desktop | ⏳ Pending QA | Verify Manage Family tabs/add form, Quick Add, Terms & Privacy |
| Group C Forms (15 modals) | Mobile + Keyboard + Desktop | ⏳ Pending QA | Verify all forms scroll and submit via pinned footer CTA |
