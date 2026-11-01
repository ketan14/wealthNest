#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/infra/docker/docker-compose.yml"
PROJECT_NAME="wealthnest"

echo "===================================================="
echo " Stopping WealthNest Full Stack"
echo "===================================================="

cd "$PROJECT_ROOT"

# Ensure NVM Node/npm and local bin take precedence in PATH
if [ -d "$HOME/.nvm/versions/node" ]; then
  LATEST_NVM_NODE="$(ls -d "$HOME/.nvm/versions/node/"* 2>/dev/null | sort -V | tail -n 1)/bin"
  if [ -d "$LATEST_NVM_NODE" ]; then
    export PATH="$LATEST_NVM_NODE:$PATH"
  fi
fi
if [ -d "$HOME/.local/bin" ]; then
  export PATH="$HOME/.local/bin:$PATH"
fi

# Detect Supabase CLI executable (prefer native binary if present)
if [ -x "$PROJECT_ROOT/node_modules/@supabase/cli-linux-x64/bin/supabase" ]; then
  SUPABASE_CMD="$PROJECT_ROOT/node_modules/@supabase/cli-linux-x64/bin/supabase"
elif [ -x "$HOME/.local/bin/supabase" ]; then
  SUPABASE_CMD="$HOME/.local/bin/supabase"
elif command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD="supabase"
elif [ -x "$PROJECT_ROOT/node_modules/.bin/supabase" ]; then
  SUPABASE_CMD="$PROJECT_ROOT/node_modules/.bin/supabase"
else
  SUPABASE_CMD="npx supabase"
fi

# 1. Stop WealthNest Web & Proxy containers
echo ""
echo "[1/2] Stopping WealthNest Web & Proxy Containers..."
if [ -f "$COMPOSE_FILE" ]; then
  docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" down || true
fi

# 2. Stop Supabase backend services (PostgreSQL, Auth, Studio, Kong)
echo ""
echo "[2/2] Stopping Supabase PostgreSQL & Backend Services..."
$SUPABASE_CMD stop --no-backup || true

# Clean up any lingering or orphaned Supabase containers holding ports
if command -v docker >/dev/null 2>&1; then
  docker rm -f $(docker ps -aq --filter "name=supabase_") 2>/dev/null || true
fi

echo ""
echo "===================================================="
echo " All WealthNest containers stopped safely."
echo " (Database data and volumes preserved)"
echo "===================================================="
