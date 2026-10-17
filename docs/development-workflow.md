# WealthNest Development Workflow

## Prerequisites
- Node.js >= 20.0.0 (LTS)
- npm >= 10.0.0
- Docker Desktop with WSL2 integration enabled
- Git

## 1. Quick Start (Local WSL)

```bash
# 1. Install dependencies across all workspaces
npm install

# 2. Run TypeScript checks across packages
npm run type-check

# 3. Run all unit test suites
npm test

# 4. Start local development server
npm run dev
```
The app will be available at `http://localhost:5173`.

---

## 2. Quick Start (Docker Compose Environment)

WealthNest comes with a dedicated Docker Compose configuration that runs the Vite frontend with hot reload and an Nginx reverse proxy serving `http://wealthnest.local`.

```bash
# Start containers in background
npm run docker:dev:d
# Or using the helper script:
./scripts/docker-dev.sh up-d

# View live container logs
npm run docker:logs
# Or:
./scripts/docker-dev.sh logs

# Stop containers safely (preserves all data and volumes)
npm run docker:down
# Or:
./scripts/docker-dev.sh down
```

---

## 3. Adding New Modules & Models

### Adding a Domain Model
1. Place the pure model in `packages/domain/src/models/<model-name>.ts`.
2. Use `Money` from `packages/domain/src/money/money.ts` for financial fields.
3. Export the model from `packages/domain/src/index.ts`.
4. Add unit tests in `packages/domain/src/__tests__/<model-name>.test.ts`.

### Adding an Application Use Case
1. Define any required outbound repository ports in `packages/application/src/ports/<port-name>.port.ts`.
2. Implement the use case in `packages/application/src/use-cases/<use-case-name>.ts`.
3. Export from `packages/application/src/index.ts`.

### Adding a Web Route / Page
1. Create a component in `apps/web/src/pages/<PageName>.tsx`.
2. Register the route in `apps/web/src/App.tsx`.
3. Add the navigation link in `apps/web/src/components/layout/Sidebar.tsx`.
