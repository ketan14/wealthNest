#!/usr/bin/env bash
set -euo pipefail

# --------------------------------------------------
# WealthNest Docker Stack - Status Script
# --------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Auto-detect project root containing infra/docker/docker-compose.yml
if [ -f "$SCRIPT_DIR/../infra/docker/docker-compose.yml" ]; then
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
elif [ -f "$SCRIPT_DIR/infra/docker/docker-compose.yml" ]; then
    PROJECT_ROOT="$SCRIPT_DIR"
else
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
fi

COMPOSE_FILE="$PROJECT_ROOT/infra/docker/docker-compose.yml"
PROJECT_NAME="wealthnest"

# Ensure local bin is in PATH
if [ -d "$HOME/.local/bin" ]; then
  export PATH="$HOME/.local/bin:$PATH"
fi

# Detect Supabase CLI executable
if [ -x "$HOME/.local/bin/supabase" ]; then
  SUPABASE_CMD="$HOME/.local/bin/supabase"
elif command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD="supabase"
elif [ -x "$PROJECT_ROOT/node_modules/.bin/supabase" ]; then
  SUPABASE_CMD="$PROJECT_ROOT/node_modules/.bin/supabase"
else
  SUPABASE_CMD="npx supabase"
fi

echo "===================================================="
echo " WealthNest Docker Stack Status"
echo "===================================================="

cd "$PROJECT_ROOT"

# 1. Check WealthNest Web & Proxy Containers
echo ""
echo "--- [1] Web & Proxy Containers (Docker Compose) ---"
if [ -f "$COMPOSE_FILE" ]; then
    PS_OUTPUT=$(docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" ps -a 2>/dev/null || true)
    LINE_COUNT=$(echo "$PS_OUTPUT" | grep -v '^$' | wc -l)

    if [ "$LINE_COUNT" -le 1 ]; then
        echo "ℹ️  No Web/Proxy containers currently running."
    else
        echo "$PS_OUTPUT"
    fi
else
    echo "⚠️  Compose file not found at: $COMPOSE_FILE"
fi

# 2. Check Supabase Database & Backend Containers
echo ""
echo "--- [2] Supabase PostgreSQL & Backend Services ---"
if $SUPABASE_CMD status >/dev/null 2>&1; then
    $SUPABASE_CMD status
else
    echo "ℹ️  Supabase PostgreSQL services are currently stopped."
fi

echo ""
echo "===================================================="
# Summary guidance
TOTAL_RUNNING=$(docker ps --filter "name=wealthnest" -q | wc -l)
if [ "$TOTAL_RUNNING" -eq 0 ]; then
    echo "ℹ️  All WealthNest containers are currently stopped."
    echo "👉 Run './scripts/start.sh' to launch all containers."
else
    echo "✅ WealthNest services are active."
    echo "   - Web App        : http://localhost:30000 (or http://localhost:5174)"
    echo "   - Supabase Studio: http://localhost:54323"
    echo "👉 Run './scripts/stop.sh' to stop all containers."
fi
echo "===================================================="
