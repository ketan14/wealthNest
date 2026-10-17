# ADR 0001: Monorepo Architecture with npm Workspaces

## Status
Accepted

## Context
WealthNest requires an architectural foundation for an institutional-grade personal wealth and asset operating system.
Key technical considerations:
1. Strict isolation of pure financial domain calculations from UI frameworks and persistence SDKs.
2. Long-term compatibility with both cloud-hosted Supabase PostgreSQL and offline desktop runtime (Tauri 2 + local SQLite).
3. Fast, frictionless developer onboarding within WSL2 and Docker.
4. Minimal toolchain overhead without unnecessary abstraction layers.

## Decision
We chose a **modular monolith** in a single Git repository organized with native **npm workspaces**:
1. **npm workspaces**: Native to Node.js LTS, requiring no extra third-party orchestration tools (such as Nx, Turborepo, or Lerna) during Phase 0.
2. **Package structure**:
   - `apps/web`: React + Vite frontend.
   - `packages/domain`: Pure financial logic and calculations.
   - `packages/application`: Use cases and repository contracts.
   - `packages/shared`: Cross-cutting types and utilities.

## Consequences
### Positive
- Zero external build tool lock-in; works with any standard Node.js LTS environment.
- Reproducible `package-lock.json` lockfile for fast CI and Docker builds.
- Clear compiler-enforced boundaries using TypeScript Project References (`tsconfig.base.json`).
- Straightforward migration path to Turborepo or Nx if build caching across dozens of packages ever becomes necessary.

### Negative / Trade-offs
- Manual execution ordering for builds across workspaces (solved via `scripts/verify.sh` and `"build": "npm run build --workspaces --if-present"`).
