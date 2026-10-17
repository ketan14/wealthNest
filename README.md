# WealthNest

**Institutional-grade personal wealth and asset operating system.**

> **Phase 0 Status**: Initial production-oriented monorepo architecture and Docker development environment. Financial calculations, authentication, and database migrations are reserved for subsequent phases.

---

## Repository Structure

```
wealthNest/
├── apps/
│   └── web/                     # React 18 + Vite + Tailwind + TanStack Query frontend
├── packages/
│   ├── domain/                  # Framework-agnostic Money value object & pure domain models
│   ├── application/             # Use cases, DTOs, and repository/auth port contracts
│   └── shared/                  # Generic Result<T, E> pattern, branded types & format utils
├── supabase/
│   ├── migrations/              # Version-controlled PostgreSQL migrations
│   └── tests/                   # pgTAP database tests
├── infra/
│   └── docker/                  # Dockerfile.dev, Dockerfile.prod, docker-compose.yml & Nginx proxy
├── docs/                        # Architecture, ADRs, workflow, and domain setup documentation
├── scripts/                     # Automated verification and Docker helper scripts
├── .env.example                 # Documented environment variables template
├── package.json                 # Monorepo root manifest with npm workspaces
└── tsconfig.base.json           # Shared strict TypeScript configuration
```

---

## Architectural Principles

1. **Modular Monolith**: Organized using native **npm workspaces** without unnecessary build orchestration overhead.
2. **Clean Architecture**:
   - `apps/web` -> `packages/application` -> `packages/domain` -> `packages/shared`.
   - Domain logic has **zero** runtime dependencies and zero knowledge of databases or UI frameworks.
3. **Financial Precision**: Money amounts are stored as integer cents via the immutable `Money` value object to eliminate IEEE 754 floating-point inaccuracies.
4. **Future Adapter Compatibility**: Outbound ports in `packages/application` cleanly abstract Supabase PostgreSQL today and offline SQLite (Tauri 2) in the future.

---

## Quick Start (WSL2 Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Verify Monorepo
```bash
# Runs type-check, tests, and build across all packages
npm run verify
```

### 3. Run Dev Server Directly
```bash
npm run dev
```
Access at `http://localhost:5173`.

---

## Docker Development Environment (`wealthnest.local`)

WealthNest includes a project-local Docker development environment that bundles:
1. `wealthnest-web-dev`: Vite development server with volume mounting and HMR polling.
2. `wealthnest-proxy`: Nginx reverse proxy serving `http://wealthnest.local` on port 80.

### Starting Docker Environment
```bash
npm run docker:dev:d
```

### Windows Host Resolution
To access the app at `http://wealthnest.local`, add the following line to `C:\Windows\System32\drivers\etc\hosts`:
```
127.0.0.1   wealthnest.local
```
*(See [docs/domain-resolution.md](docs/domain-resolution.md) for detailed step-by-step instructions and troubleshooting.)*

### Safe Container Commands
```bash
# View live container logs
npm run docker:logs

# Stop containers without deleting volumes
npm run docker:down

# Check status
./scripts/docker-dev.sh status
```

---

## Documentation Links
- [Local Services & URLs Reference](docs/local-services.md)
- [System Architecture](docs/architecture.md)
- [ADR 0001: Monorepo with npm workspaces](docs/adr/0001-monorepo-npm-workspaces.md)
- [Development Workflow](docs/development-workflow.md)
- [Domain Resolution Setup](docs/domain-resolution.md)
