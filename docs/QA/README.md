# WealthNest Quality Assurance (QA) Documentation

This directory contains formal, executable Quality Assurance (QA) test suites, verification protocols, and regression test cases for WealthNest.

---

## 📑 Test Suite Index

| Document | Scope & Phase | Description | Status |
| :--- | :--- | :--- | :---: |
| [Phase 1: Database & Auth Verification](./phase-1-database-auth-verification.md) | Phase 1 | Database schema migrations, Supabase Studio visual GUI, user registration trigger, email verification, and Row-Level Security (RLS) multi-tenant isolation. | ✅ Verified |
| [Phase 2: Portfolio & India-First Verification](./phase-2-portfolio-india-first-verification.md) | Phase 2 | India-First architecture (`₹ INR`, Lakh/Crore formatting, Indian financial instruments), pure domain valuation engine, asset class distribution, and holdings management. | ✅ Verified |
| [Phase 3: Transactions & Cashflow Verification](./phase-3-transactions-cashflow-verification.md) | Phase 3 | Cashflow audit ledger, capital inflows/outflows, trade logging, dividend payouts, STT/charges, and real-time net cashflow calculations. | ✅ Verified |

---

## 🌐 QA Environment & Service Matrix

Before executing manual or automated test cases, ensure all local containers are healthy:

| Service | Target URL / Port | Credentials / Protocol | Role |
| :--- | :--- | :--- | :--- |
| **Web Application** | [http://wealthnest.local](http://wealthnest.local)<br>*(or [http://localhost](http://localhost))* | Port `80` (Nginx Proxy) | Primary user interface & testing target |
| **Supabase Studio** | [http://localhost:54323](http://localhost:54323) | Free visual GUI *(phpMyAdmin alternative)* | PostgreSQL table inspector (`profiles`, `assets`, `holdings`, `transactions`) |
| **PostgreSQL Port** | `127.0.0.1:54322` | **User**: `postgres`<br>**Pass**: `postgres` | Direct database connection (DBeaver / TablePlus) |
| **Inbucket (Email)** | [http://localhost:54324](http://localhost:54324) | Web inbox | Mock confirmation & magic link emails |
| **Kong API Gateway** | [http://localhost:54321](http://localhost:54321) | REST / Auth API | Backend authentication and database queries |

---

## ⚡ Automated Verification Commands

Run these automated verification commands in your terminal to ensure zero regressions across the Clean Architecture monorepo:

```bash
# 1. Type-check across all workspaces (@wealthnest/domain, application, shared, web)
docker exec wealthnest-web-dev npm run type-check

# 2. Run all unit test suites (23 test cases)
docker exec wealthnest-web-dev npm test

# 3. Production bundle compilation verification
docker exec wealthnest-web-dev npm run build
```

---

## 👤 Recommended QA Test Personas

| Persona | Email | Initial Holdings | Purpose |
| :--- | :--- | :--- | :--- |
| **Demo Visitor** | *(Unauthenticated)* | 8 Pre-seeded Indian Assets | Test in-memory domain math, filters, and modals without database login |
| **Indian Retail Investor** | `investor@wealthnest.local` | Equities, PPF, FDs, SGBs | Test real PostgreSQL database persistence, RLS, and Lakh/Crore formatting |
