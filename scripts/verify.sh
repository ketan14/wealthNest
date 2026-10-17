#!/usr/bin/env bash
set -euo pipefail

echo "=================================================="
echo "  WealthNest Monorepo Verification (Phase 0)     "
echo "=================================================="

# 1. Lint check
echo "==> [1/5] Running code formatting & lint check..."
npm run lint

# 2. Type check
echo "==> [2/5] Running TypeScript type check..."
npm run type-check

# 3. Run unit tests
echo "==> [3/5] Running Vitest test suites..."
npm run test

# 4. Production build
echo "==> [4/5] Running production build..."
npm run build

# 5. Docker compose validation
echo "==> [5/5] Validating Docker Compose configuration..."
docker compose -p wealthnest -f infra/docker/docker-compose.yml config > /dev/null

echo "=================================================="
echo "  All WealthNest verification checks PASSED!      "
echo "=================================================="
