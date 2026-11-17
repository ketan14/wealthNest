# Architecture Decision Record: Approved Core Technology Strategy & Platform Decisions

**Project:** WealthNest (Family Financial Management Platform)  
**Status:** Approved Baseline  
**Date:** 2026-11-17  
**Context:** Institutional-Grade Personal & Family Wealth Operating System with India-First Taxation, Multi-User Household Privacy, and Multi-Platform Target Shells.

---

## 1. ADR-0001: Web Frontend & Language Selection
- **Status:** `IMPLEMENTED`
- **Context:** WealthNest requires a reactive, type-safe, high-performance UI capable of handling dense financial ledgers, interactive SVG charts, modal-driven workflows, and real-time state management.
- **Decision:** Use **React 18** with **TypeScript (Strict Mode)** and **Vite 6** (`@wealthnest/web`).
- **Rationale:** React's component model and hooks ecosystem provide seamless state management for complex financial forms and modals. TypeScript enforces strict numeric and structural contracts, preventing runtime crashes. Vite provides sub-second HMR and optimized static rollup builds.
- **Consequences:** Eliminates runtime type errors across complex financial interfaces; enables fast local development; produces a 100% static client bundle deployable to any edge CDN or wrapped in native web shells.
- **Repository Evidence:** [`apps/web/package.json`](file:///home/ketan/projects/Krisha/wealthNest/apps/web/package.json), [`apps/web/vite.config.ts`](file:///home/ketan/projects/Krisha/wealthNest/apps/web/vite.config.ts).

---

## 2. ADR-0002: Backend-as-a-Service & Database Engine
- **Status:** `IMPLEMENTED`
- **Context:** A multi-tenant family wealth platform requires enterprise-grade relational integrity, foreign key cascades, transactional rollbacks, cryptographic hash verification, and robust identity management without the overhead of maintaining custom auth and database servers.
- **Decision:** Use **Supabase** backed by **PostgreSQL 15+**.
- **Rationale:** PostgreSQL provides battle-tested ACID compliance, integer `bigint` precision for paise math, partial unique indexes for single-owner constraints, and rich procedural capabilities (`PL/pgSQL`). Supabase provides integrated identity (GoTrue), secure object storage, edge runtime (Deno), and automated connection management.
- **Consequences:** Eliminates custom backend boilerplate while retaining standard PostgreSQL SQL migrations; database logic is 100% portable and standard.
- **Repository Evidence:** [`supabase/config.toml`](file:///home/ketan/projects/Krisha/wealthNest/supabase/config.toml), [`supabase/migrations/`](file:///home/ketan/projects/Krisha/wealthNest/supabase/migrations).

---

## 3. ADR-0003: Household-Centric Multi-User Financial Architecture
- **Status:** `IMPLEMENTED`
- **Context:** Traditional personal finance applications bind all financial ledgers directly to a single `auth.users.id`. WealthNest requires a collaborative family workspace where multiple family members can manage collective wealth while preserving individual privacy.
- **Decision:** Establish **`households`** as the fundamental tenant and data isolation boundary. Financial tables (`assets`, `holdings`, `liabilities`, `transactions`, `goals`, `family_documents`) link strictly to `household_id UUID NOT NULL`. Legacy direct `user_id` ownership columns on financial entities are eliminated.
- **Rationale:** Decouples user login credentials (`auth.users`) from household financial ownership (`family_members`). Enables users to participate in multiple households (e.g. marital vs parental) without record collisions or double-counting.
- **Consequences:** All database queries and RLS policies must evaluate active household membership via `is_active_household_member(household_id)`.
- **Repository Evidence:** Migrations [`20260101000020_household_identity_and_governance.sql`](file:///home/ketan/projects/Krisha/wealthNest/supabase/migrations/20260101000020_household_identity_and_governance.sql), [`20260101000022_household_financial_ownership_and_privacy.sql`](file:///home/ketan/projects/Krisha/wealthNest/supabase/migrations/20260101000022_household_financial_ownership_and_privacy.sql).

---

## 4. ADR-0004: Optional Family Member Login Accounts & Managed Profiles
- **Status:** `IMPLEMENTED`
- **Context:** Indian family financial structures frequently involve family members who cannot or do not wish to operate digital accounts (e.g., minors, elderly parents, Hindu Undivided Family / HUF entities).
- **Decision:** Support **`family_members`** profiles with nullable **`linked_user_id`**.
- **Rationale:** A household primary owner or administrator can create and manage financial records for unlinked family members (`linked_user_id IS NULL`). If an unlinked family member later wishes to access the platform, an invitation with a cryptographically hashed token (`household_invitations`) allows them to link an authenticated login account cleanly via `accept_household_invitation(token)`.
- **Consequences:** The application accommodates 100% of family members without forcing artificial email/auth creation for dependents.
- **Repository Evidence:** [`supabase/migrations/20260101000021_household_invitations.sql`](file:///home/ketan/projects/Krisha/wealthNest/supabase/migrations/20260101000021_household_invitations.sql), [`apps/web/src/lib/supabase/family.adapter.ts`](file:///home/ketan/projects/Krisha/wealthNest/apps/web/src/lib/supabase/family.adapter.ts).

---

## 5. ADR-0005: Governance Roles (Single Owner with Multiple Administrators)
- **Status:** `IMPLEMENTED`
- **Context:** Clear authority boundaries are essential to prevent hostile takeover, administrative gridlock, or orphaned household workspaces.
- **Decision:** Implement 4 discrete household governance roles:
  1. **`primary_owner`**: Exactly **one** active owner per household (enforced by partial unique index `(household_id) WHERE household_role = 'primary_owner' AND status = 'active'`). Controls billing, deletion, admin appointments, and ownership transfer.
  2. **`admin`**: Appointed by `primary_owner`. Can manage household-shared financial records and unlinked profiles. Cannot appoint admins, transfer ownership, or delete the household.
  3. **`member`**: Standard adult member. Manages their own linked profile and personal records.
  4. **`viewer`**: Read-only auditor.
- **Rationale:** Enforces clean separation between administrative governance and everyday data entry.
- **Consequences:** Ownership transfer requires an atomic stored procedure (`transfer_household_primary_owner`) ensuring zero downtime and preventing 0 or >1 owner states.
- **Repository Evidence:** [`supabase/migrations/20260101000020_household_identity_and_governance.sql`](file:///home/ketan/projects/Krisha/wealthNest/supabase/migrations/20260101000020_household_identity_and_governance.sql), [`supabase/tests/02_admin_rbac_and_audit_immutability.sql`](file:///home/ketan/projects/Krisha/wealthNest/supabase/tests/02_admin_rbac_and_audit_immutability.sql).

---

## 6. ADR-0006: Independent Financial Ownership & Joint Share Allocations
- **Status:** `IMPLEMENTED`
- **Context:** In family wealth, legal financial ownership rarely belongs to the person who typed the record into the computer. Furthermore, real estate, demat folios, and home loans are frequently co-owned in unequal proportions.
- **Decision:** Decouple record creation from legal financial ownership:
  - Financial entities link to one or more `family_members` via **`holding_owners`** and **`liability_parties`**.
  - Ownership shares (`ownership_share numeric(5,2)`) must sum to exactly **`100.00%`**, validated by database constraint triggers.
  - Net worth and tax calculations use integer paise math (`allocateBigIntByShares`) using the largest-remainder method, guaranteeing zero paise drift.
- **Rationale:** Ensures legal accuracy for tax reporting (e.g. LTCG Section 112A) and prevents net worth inflation.
- **Consequences:** A record creator cannot claim sole ownership of an asset unless assigned 100% in `holding_owners`.
- **Repository Evidence:** [`packages/domain/src/household/joint-ownership.ts`](file:///home/ketan/projects/Krisha/wealthNest/packages/domain/src/household/joint-ownership.ts), [`supabase/migrations/20260101000022_household_financial_ownership_and_privacy.sql`](file:///home/ketan/projects/Krisha/wealthNest/supabase/migrations/20260101000022_household_financial_ownership_and_privacy.sql).

---

## 7. ADR-0007: Three-Tier Record Privacy (Admin Cannot Bypass Private Records)
- **Status:** `IMPLEMENTED`
- **Context:** Adult family members will refuse to use a shared family platform if household administrators or parents can freely inspect their private salary accounts, discretionary investments, or personal liabilities.
- **Decision:** Enforce three privacy scopes on every financial table via PostgreSQL Row Level Security:
  - **`household_shared`**: Visible to all active members of the household.
  - **`owner_only`**: Strictly visible to the profile owner (and explicit profile delegates). **Hidden from household admins and primary owners** if owned by a different linked member.
  - **`restricted`**: Visible only to the owner and explicitly granted users via `restricted_record_grants`.
- **Rationale:** Privacy is enforced at the database kernel level, not bypassed by administrative status.
- **Consequences:** Aggregated household net worth queries viewed by admins mathematically exclude private records belonging to other members, preventing privacy leakage through sum differentials.
- **Repository Evidence:** [`docs/architecture/household-permission-matrix.md`](file:///home/ketan/projects/Krisha/wealthNest/docs/architecture/household-permission-matrix.md), [`supabase/migrations/20260101000023_household_rls_storage_and_rpcs.sql`](file:///home/ketan/projects/Krisha/wealthNest/supabase/migrations/20260101000023_household_rls_storage_and_rpcs.sql).

---

## 8. ADR-0008: Android Application Target — Capacitor Shell
- **Status:** `APPROVED / NOT IMPLEMENTED` (Target Architecture)
- **Context:** WealthNest requires an Android mobile client with high UI fidelity, hardware security, biometric app lock, and rapid iteration without maintaining a separate mobile codebase.
- **Decision:** Adopt **Capacitor** with package identifier **`in.wealthnest.app`**, wrapping the existing React + TypeScript + Vite web application (`apps/web`).
- **Explicit Architecture Ruling:** **Reject React Native and reject full native Kotlin rewrite.** Retain Capacitor as a dedicated mobile shell.
- **Rationale:** Reuses ~95% of existing responsive React UI, 100% of domain business logic, TanStack queries, and PDF parsing engines. Provides production-grade native plugins for Android Keystore (`EncryptedSharedPreferences`), BiometricPrompt, Chrome Custom Tabs PKCE OAuth, and Android App Links (`assetlinks.json`).
- **Consequences:** Fast time-to-market; single business logic codebase; eliminates the overhead of compiling Rust/NDK toolchains for Android mobile builds.
- **Repository Evidence:** [`docs/mobile/android-architecture-assessment.md`](file:///home/ketan/projects/Krisha/wealthNest/docs/mobile/android-architecture-assessment.md), [`docs/next-phase-development-plan.md`](file:///home/ketan/projects/Krisha/wealthNest/docs/next-phase-development-plan.md).

---

## 9. ADR-0009: Desktop Application Target — Tauri 2
- **Status:** `PARTIALLY IMPLEMENTED`
- **Context:** Power users, family office managers, and desktop workstation users require a high-performance native desktop application with local file system access and system tray integration.
- **Decision:** Use **Tauri 2** (Rust native layer) solely for Desktop packaging (Windows `.exe/.msi`, macOS `.dmg/.app`, Linux `.deb`).
- **Explicit Architecture Ruling:** **Retain `src-tauri/` strictly for desktop.** Do not conflate Tauri desktop with the Capacitor Android shell. Do not migrate desktop functionality into Capacitor.
- **Rationale:** Tauri 2 provides tiny binary sizes (<15MB), minimal RAM overhead (~30-50MB vs Electron's 300MB+), and native Rust security controls.
- **Consequences:** Web and desktop share the exact same React UI; Rust commands are restricted to native OS capabilities (dialogs, local file system, native window controls).
- **Repository Evidence:** [`src-tauri/Cargo.toml`](file:///home/ketan/projects/Krisha/wealthNest/src-tauri/Cargo.toml), [`src-tauri/tauri.conf.json`](file:///home/ketan/projects/Krisha/wealthNest/src-tauri/tauri.conf.json).

---

## 10. ADR-0010: Shared TypeScript Architecture & Domain Boundaries
- **Status:** `PARTIALLY IMPLEMENTED` (npm workspaces established)
- **Context:** Financial calculations (LTCG Section 112A, loan amortization, net worth roll-ups, CAS imports) must never diverge between Web, Mobile, and Desktop targets.
- **Decision:** Maintain pure financial logic in platform-agnostic TypeScript packages:
  - **`@wealthnest/shared`**: Common Result types, date utilities, and cross-cutting primitives (`IMPLEMENTED`).
  - **`@wealthnest/domain`**: Pure financial calculations, Money value objects (paise `bigint`), joint allocation algorithms, and domain entities (`IMPLEMENTED`).
  - **`@wealthnest/application`**: Port contracts and framework-agnostic use cases (`IMPLEMENTED`).
  - **`@wealthnest/ui`** & **`@wealthnest/validation`**: Reusable component primitives and validation schemas (`PROPOSED` for future extraction).
- **Rationale:** Clean Architecture / Hexagonal architecture ensures business logic can be tested in 100ms with zero DOM or database dependencies.
- **Consequences:** UI shells simply invoke domain calculations and application use cases through dependency inversion.
- **Repository Evidence:** [`packages/domain/`](file:///home/ketan/projects/Krisha/wealthNest/packages/domain), [`packages/application/`](file:///home/ketan/projects/Krisha/wealthNest/packages/application), [`packages/shared/`](file:///home/ketan/projects/Krisha/wealthNest/packages/shared).
