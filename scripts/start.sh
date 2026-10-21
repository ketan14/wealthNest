#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/infra/docker/docker-compose.yml"
PROJECT_NAME="wealthnest"

echo "===================================================="
echo " Starting WealthNest Full Stack"
echo "===================================================="

cd "$PROJECT_ROOT"

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

# 1. Start Supabase backend services (PostgreSQL, Auth, Studio, Storage, Kong)
echo ""
echo "[1/2] Starting Supabase PostgreSQL & Backend Services..."
$SUPABASE_CMD start

# 2. Start Web Application and Nginx Reverse Proxy
echo ""
echo "[2/2] Starting WealthNest Web & Proxy Containers..."
docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d --build

echo ""
echo "===================================================="
echo " WealthNest is LIVE!"
echo "===================================================="
echo " - Web Application  : http://localhost:30000 (or http://localhost:5174)"
echo " - Supabase Studio  : http://localhost:54323"
echo " - Supabase API     : http://localhost:54321"
echo " - PostgreSQL DB    : localhost:54322 (user: postgres, pass: postgres)"
echo "===================================================="
