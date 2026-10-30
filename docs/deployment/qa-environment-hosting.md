# WealthNest — QA Environment Hosting & Zero-Cost Cloud Setup Guide

**Document Purpose:** Step-by-step implementation plan for deploying a production-parity Quality Assurance (QA) testing environment for WealthNest (Web frontend + Supabase backend) with **₹0 / $0 monthly cost guarantee**.  
**Path:** `docs/deployment/qa-environment-hosting.md`  
**Execution Status:** Ready for Review (Do not execute deployment until explicitly approved).

---

## 1. Executive Summary & Zero-Cost Architecture Guarantee

WealthNest's architecture is uniquely suited for completely free cloud hosting during QA and UAT (User Acceptance Testing) because:
1. **Zero Custom Backend Server:** WealthNest has no persistent Node.js or Python backend server to run. The frontend is a static Vite SPA communicating directly with Supabase PostgREST, GoTrue Auth, and PostgreSQL RPCs.
2. **Client-Side Processing:** CAS PDF decryption and Zerodha/Groww CSV statement parsing run **100% in browser RAM** (`pdfjs-dist`). No cloud storage buckets or file processing compute instances are needed.
3. **Simulated Market Feeds:** Market data and live CMP simulation run in client-side memory without external paid API subscriptions.

### Recommended QA Cloud Stack (100% Free Tier)

| Component | Provider & Tier | Quota & Capacity | Monthly Cost | Zero-Billing Safeguard |
| :--- | :--- | :--- | :---: | :--- |
| **Database & Auth** | **Supabase Cloud (Free Tier)** | 500 MB PostgreSQL DB, 50,000 MAU, 5 GB egress, 200 pooler connections | **₹0 / $0** | **Spend Cap set to ON** (Hard quota limit; no overage charges can ever occur). |
| **Web Frontend SPA** | **Cloudflare Pages (Free Tier)** | **Unlimited static bandwidth**, global CDN (Mumbai, Delhi, Chennai, Bengaluru, Hyderabad PoPs), SSL included | **₹0 / $0** | Static assets only; no SSR compute invocation. |
| **Android APK Client** | **GitHub Actions CI Artifact** | Universal `.apk` signed by repo build pipeline ([`build-installers.yml`](file:///home/ketan/projects/Krisha/wealthNest/.github/workflows/build-installers.yml)) | **₹0 / $0** | Free for public repos (2,000 free minutes/mo for private). |
| **Automated Keep-Alive** | **GitHub Actions Scheduled Cron** | Weekly 5-second HTTP ping to prevent Supabase 7-day auto-pause | **₹0 / $0** | ~1 minute of GitHub Actions runner time per month. |

---

## 2. Pre-Deployment Checklist

Before proceeding with deployment, ensure the following are available:
- [ ] A free **Supabase account** ([https://supabase.com](https://supabase.com)).
- [ ] A free **Cloudflare account** ([https://dash.cloudflare.com](https://dash.cloudflare.com)) or **Vercel account** ([https://vercel.com](https://vercel.com)).
- [ ] GitHub repository access (`git push` permissions).
- [ ] Local Supabase CLI installed (`supabase` / `npx supabase`).

---

## 3. Step-by-Step Implementation Plan

### Step 1: Provision Free-Tier Supabase QA Project

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **"New project"**.
3. Fill in the project configuration:
   - **Name:** `wealthnest-qa`
   - **Database Password:** Generate and securely save a strong password.
   - **Region:** Select **South Asia (Mumbai) - `ap-south-1`** for the lowest latency in India (<30ms).
   - **Pricing Plan:** Select **Free Tier ($0/month)**.
4. **CRITICAL STEP — Enforce Zero Billing:**
   - Go to **Project Settings** ➔ **Billing & Usage** ➔ **Spend Management**.
   - Verify that **Spend Cap is ON**.  
     *(With Spend Cap ON, Supabase strictly refuses overages and guarantees that your credit card is never charged).*
5. Note down your project credentials from **Project Settings** ➔ **API**:
   - **Project URL:** `https://<your-project-ref>.supabase.co`
   - **Public Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

### Step 2: Configure Supabase Auth & Security Settings

1. In Supabase Dashboard, navigate to **Authentication** ➔ **URL Configuration**:
   - **Site URL:** Set to your planned Cloudflare Pages domain, e.g.:
     ```text
     https://wealthnest-qa.pages.dev
     ```
   - **Redirect URLs:** Add:
     ```text
     https://wealthnest-qa.pages.dev/**
     http://localhost:5173/**
     http://localhost:30000/**
     ```
2. Navigate to **Authentication** ➔ **Providers** ➔ **Email**:
   - For fast QA testing without needing a third-party SMTP server (SendGrid/AWS SES):
     - Toggle **"Confirm email"** to **OFF** (users can immediately log in upon registration).
     - Or toggle to **ON** if you want to test email confirmation workflows via a free Resend / Brevo API key.

---

### Step 3: Link Project & Push Database Migrations

Run these commands from your local development workstation inside the project root:

```bash
# 1. Login to Supabase CLI (opens browser authentication)
npx supabase login

# 2. Link your local repository to the remote QA project
npx supabase link --project-ref <your-project-ref>

# 3. Push all 11 production migrations to remote QA PostgreSQL
npx supabase db push
```

#### What this applies:
This applies all 11 version-controlled migrations from `supabase/migrations/`:
1. `20260101000000_initial_scaffold.sql` (Initial extensions)
2. `20260101000001_core_schema.sql` (Profiles, Assets, Holdings, Transactions, RLS)
3. `20260101000002_cas_import_schema.sql` (CAS and statement import ledger)
4. `20260101000003_add_mutual_fund_asset_class.sql` (Mutual fund asset type classification)
5. `20260101000004_separate_equities_and_mutual_funds.sql` (Dedicated views for equity & MF)
6. `20260101000005_loans_and_liabilities.sql` (EMI amortization schedules & liabilities)
7. `20260101000006_financial_goals.sql` (Financial goals, target dates & reverse SIP)
8. `20260101000007_family_entities_and_accounts.sql` (Multi-entity PAN family members & demats)
9. `20260101000008_family_goals_and_liabilities.sql` (Entity association for goals & loans)
10. `20260101000009_admin_portal_and_access_control.sql` (RBAC, platform admins, audit logs)
11. `20260101000010_admin_support_sessions.sql` (Time-bound read-only support impersonation)

---

### Step 4: Seed QA Test Data (Anonymized Household Persona)

To verify the app immediately with real-world Indian wealth scenarios while preserving privacy, seed the QA database using [`supabase/seed_qa.sql`](file:///home/ketan/projects/Krisha/wealthNest/supabase/seed_qa.sql) with randomized dummy personas.

Execute this command to register the QA helper functions in your remote database:

```bash
# Push QA helper functions to the remote database
npx supabase db remote execute --file supabase/seed_qa.sql
```

Then in Supabase Dashboard ➔ **SQL Editor**, run the appropriate seed command for your logged-in test user:

```sql
-- 1. Seed Primary QA Household (Family, Demats, Holdings, 15+ Trades, SIPs, Dividends, Goals, Loans):
SELECT public.seed_qa_primary_household(auth.uid());

-- 2. Grant Platform Super Admin Role (Enables /admin Portal & Support Impersonation testing):
SELECT public.seed_qa_grant_admin(auth.uid());

-- 3. (Optional) For a Second Registered Test Account, Seed an Isolated Tenant (Tests Cross-User RLS):
SELECT public.seed_qa_secondary_user(auth.uid());
```

#### What is Seeded:
- **Family Entities (5):** Arjun Sharma (Self), Pooja Sharma (Spouse), Harishbhai Sharma HUF (HUF), Ananya Sharma (Child), Kavitaben Sharma (Mother).
- **Portfolio Accounts (5):** Zerodha Primary, Groww MF Direct, HDFC Securities HUF, SBI Staff Salary & Savings, RBI Retail Direct SGB.
- **Holdings & Assets (6):** HDFC Bank, Reliance, TCS, Parag Parikh Flexi Cap, Sovereign Gold Bond 28-29, 7.5% Senior Citizen FD.
- **Trade History (15+):** Initial purchases, 6-month automated SIP run for Ananya, Section 112A LTCG tax-harvest trade, quarterly TCS & HDFC dividends, and FD interest payouts.
- **Goals & Compounding (2):** Ananya Higher Education (₹50 Lakhs in 2038) + Retirement Nest (₹5 Crores in 2046).
- **Liabilities & Amortization (1):** HDFC Home Loan (₹45 Lakhs @ 8.4%) with 3 historical EMI payment records including a Diwali prepayment.
- **Admin Access:** Enables `/admin` portal, system status dashboard, and 15-minute read-only support session testing.
- **Multi-Tenant Security:** A secondary independent persona (Sanjay Verma / Verma Household) to verify that RLS guarantees complete isolation between users.

---

### Step 5: Deploy Frontend to Cloudflare Pages (Recommended)

Cloudflare Pages provides **unlimited free bandwidth** and global SSL on Indian edge PoPs.

#### Method A: Direct Git Integration (Auto-Deploy on Push)
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) ➔ **Workers & Pages** ➔ **Create application** ➔ **Pages** ➔ **Connect to Git**.
2. Select your repository: `wealthnest`.
3. Configure build settings:
   - **Project Name:** `wealthnest-qa`
   - **Production branch:** `main` (or a dedicated `qa` branch)
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `apps/web/dist`
   - **Root directory:** Leave empty `/` (Vite builds the monorepo from root)
4. Add **Environment Variables** (Production & Preview):
   - `VITE_SUPABASE_URL`: `https://<your-project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `<your-supabase-anon-key>`
5. Click **"Save and Deploy"**.
6. Cloudflare will compile and publish your QA app at `https://wealthnest-qa.pages.dev` in ~90 seconds.

#### Method B: Manual CLI Deploy (Instant Zero-Git Upload)
If you prefer not to connect Cloudflare to GitHub:
```bash
# 1. Build web production bundle with QA environment variables
VITE_SUPABASE_URL="https://<your-project-ref>.supabase.co" \
VITE_SUPABASE_ANON_KEY="<your-supabase-anon-key>" \
npm run build --workspace=@wealthnest/web

# 2. Deploy directly via Wrangler
npx wrangler pages deploy apps/web/dist --project-name=wealthnest-qa
```

---

### Step 6: Verify Mobile QA (Android APK Integration)

You do **NOT** need to build a new Android APK specifically for QA! 

WealthNest includes dynamic server switching via [`ServerConnectionSettings.tsx`](file:///home/ketan/projects/Krisha/wealthNest/apps/web/src/components/settings/ServerConnectionSettings.tsx):
1. Install your universal Android APK ([`wealthnest-offline-signed.apk`](file:///home/ketan/projects/Krisha/wealthNest/.github/workflows/build-installers.yml)) on any Android phone or emulator.
2. Launch the app and go to **Settings** ➔ **Server Connection**.
3. Change the active environment:
   - Select **"Custom Cloud / QA"**.
   - **Supabase Cloud URL:** Enter `https://<your-project-ref>.supabase.co`.
   - **Supabase Anon Key:** Enter `<your-supabase-anon-key>`.
4. Tap **"Save & Connect"**.
5. The mobile app immediately re-initializes its Supabase client proxy to your QA cloud database with full offline fallback!

---

### Step 7: Automate 7-Day Inactivity Keep-Alive (Zero Cost)

Supabase Free Tier automatically pauses databases that have not received an API request in 7 consecutive days. 

To ensure the QA environment remains perpetually active without manual intervention, add a lightweight GitHub Actions cron workflow:

**Workflow File:** `.github/workflows/keep-qa-alive.yml`
```yaml
name: WealthNest QA — Keep-Alive Ping

on:
  schedule:
    # Runs every Monday and Thursday at 06:00 UTC (11:30 AM IST)
    - cron: '0 6 * * 1,4'
  workflow_dispatch:

jobs:
  ping-supabase-qa:
    name: Ping Supabase QA Endpoint
    runs-on: ubuntu-latest
    steps:
      - name: Ping PostgREST Health Check
        env:
          SUPABASE_QA_URL: ${{ secrets.VITE_SUPABASE_URL }}
          SUPABASE_QA_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        run: |
          if [ -z "$SUPABASE_QA_URL" ]; then
            echo "Skipping ping: VITE_SUPABASE_URL secret not set."
            exit 0
          fi
          HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "apikey: $SUPABASE_QA_KEY" \
            -H "Authorization: Bearer $SUPABASE_QA_KEY" \
            "$SUPABASE_QA_URL/rest/v1/assets?select=id&limit=1")
          echo "Supabase QA Health Check HTTP Status: $HTTP_STATUS"
          if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 400 ]; then
            echo "✅ Supabase QA database is warm and active."
          else
            echo "⚠️ Unexpected response: $HTTP_STATUS"
          fi
```

*This requires zero maintenance, uses less than 1 minute of GitHub Actions runner time per month, and costs ₹0.*

---

## 4. QA Functional Verification Matrix

Run the following test scenarios on the deployed QA environment:

| ID | Test Scenario | Expected Outcome | Invariant Checked |
| :--- | :--- | :--- | :--- |
| **QA-01** | **User Registration & Login** | Creates profile in `public.profiles`, redirects to dashboard. | PostgREST RLS + GoTrue Auth |
| **QA-02** | **Family Entity Switching** | Switch between Arjun (Self), Pooja (Spouse), Harishbhai (HUF), Ananya (Child). | PAN-level portfolio isolation |
| **QA-03** | **Zero Floating-Point Drift** | Verify ₹1,25,000 LTCG exemption calculation and asset valuation. | Integer paise BigInt persistence |
| **QA-04** | **CAS PDF Import** | Drag & drop CAS PDF statement into browser. | 100% Client-side decryption; no server file upload |
| **QA-05** | **Zerodha / Groww CSV Import** | Import broker tradebook CSV. | Instant idempotent holding & transaction upsert |
| **QA-06** | **Goal & Reverse SIP Calculation** | Create goal for Ananya Higher Education (₹50 Lakhs in 12 years). | Pure domain math (CAGR/PMT) |
| **QA-07** | **Liability Amortization** | Add home loan with prepayments. | Amortization schedule matches bank schedule |
| **QA-08** | **Mobile Touch Targets (>=44px)** | Test on Android phone / mobile browser. | WCAG 2.5.5 Touch Target Ergonomics |
| **QA-09** | **Support Impersonation & Audit Log** | Admin initiates 15-minute read-only support session. | Session token expires; logged in `admin_audit_logs` |

---

## 5. Teardown & Rollback Instructions

When QA testing concludes or if you want to reset the environment:

1. **To Wipe All QA Test Data (Fresh Start):**
   ```bash
   npx supabase db reset --linked
   ```
2. **To Pause the Project (Preserve Schema & Data at ₹0):**
   - Go to **Project Settings** ➔ **General** ➔ **Pause project**.
3. **To Completely Destroy the Project:**
   - Go to **Project Settings** ➔ **General** ➔ **Delete project**.
   - Delete Cloudflare Pages project from Cloudflare dashboard.

---

## 6. Summary Checklist for User Review

Review this plan and let me know when you would like to proceed with any of the following:
1. [x] Generate the standardized `supabase/seed_qa.sql` script with preconfigured anonymized QA test data.
2. [ ] Add `.github/workflows/keep-qa-alive.yml` to the repository.
3. [ ] Execute the remote Supabase link and Cloudflare deployment steps.
