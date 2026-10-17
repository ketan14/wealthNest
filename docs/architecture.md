# WealthNest System Architecture & Monorepo Design

## 1. Overview
WealthNest is structured as a modular monolith monorepo powered by standard **npm workspaces**. The architecture strictly separates business rules from presentation and infrastructure concerns, adhering to Clean Architecture / Hexagonal Architecture principles.

```
+-------------------------------------------------------------------+
|                            apps/web                               |
|        (React 18 + Vite + Tailwind CSS + TanStack Query)          |
+---------------------------------+---------------------------------+
                                  | depends on
                                  v
+-------------------------------------------------------------------+
|                      packages/application                         |
|         (Use cases, DTOs, service & repository ports)             |
+---------------------------------+---------------------------------+
                                  | depends on
                                  v
+-------------------------------------------------------------------+
|                        packages/domain                            |
|       (Pure financial models, Money Value Object, calculations)   |
+---------------------------------+---------------------------------+
                                  | depends on
                                  v
+-------------------------------------------------------------------+
|                         packages/shared                           |
|        (Generic Result<T, E>, branded types, format utils)        |
+-------------------------------------------------------------------+
```

## 2. Package Boundaries & Responsibilities

### `apps/web`
- **Role**: Presentation and user interaction layer.
- **Technologies**: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, Lucide icons.
- **Constraints**:
  - May consume `@wealthnest/application`, `@wealthnest/domain`, and `@wealthnest/shared`.
  - Must not directly manipulate domain logic or perform manual currency calculations without domain value objects.

### `packages/domain`
- **Role**: Core business rules and financial domain logic.
- **Contents**:
  - Pure value objects (`Money` represented in integer cents to avoid IEEE 754 floating-point inaccuracies).
  - ISO-4217 Currency types and validation.
  - Domain entity interfaces (`UserProfile`, `AssetHolding`).
- **Strict Constraints**:
  - ZERO external runtime dependencies (only `@wealthnest/shared`).
  - No React code, no Vite code, no HTTP client, no database SDKs, and no Supabase types.

### `packages/application`
- **Role**: Orchestrates use cases and defines port interfaces (contracts).
- **Contents**:
  - Inbound use cases (e.g., `GetSystemStatusUseCase`).
  - Outbound port contracts (`UserRepositoryPort`, `AssetRepositoryPort`, `AuthPort`).
- **Strict Constraints**:
  - Framework-agnostic TypeScript.
  - Must not import React, DOM APIs, or database drivers.

### `packages/shared`
- **Role**: Cross-cutting foundational utilities and types.
- **Contents**:
  - Functional `Result<T, E>` pattern (`ok`, `err`, `isOk`, `isErr`).
  - Type-safe nominal branding (`Brand<K, T>`).
  - Pure date and text formatting utilities.

---

## 3. Dependency Rules & Circular Dependency Prevention
1. **Unidirectional flow**: Dependencies flow strictly downward: `apps/web` -> `packages/application` -> `packages/domain` -> `packages/shared`.
2. **No circular imports**: No package may import from a layer above it or sideways without explicit shared abstraction.
3. **Explicit package exports**: All workspace packages define standard `exports` maps in `package.json` pointing to compiled TypeScript declaration and ESM bundles. Relative traversal imports across package roots (e.g., `../../packages/...`) are strictly forbidden.

---

## 4. Future Compatibility & Adapter Boundary

### Initial Phase: Supabase PostgreSQL & Supabase Auth
- Outbound ports (`UserRepositoryPort`, etc.) will be fulfilled by Supabase adapters in a dedicated infrastructure layer or app-level adapter.
- Supabase-generated schema types will be mapped to domain models at the adapter boundary, preventing vendor lock-in.

### Future Phase: Tauri 2 + SQLite (Offline-First Synchronization)
- When Tauri 2 desktop support is introduced:
  1. `apps/web` can be bundled into the Tauri webview without architectural modification.
  2. A local SQLite adapter will implement the identical `UserRepositoryPort` / `AssetRepositoryPort` contracts.
  3. A synchronization use case will synchronize changes between SQLite and Supabase PostgreSQL.
  4. Core domain models in `packages/domain` will remain 100% untouched.
