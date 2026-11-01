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

# 1. Start Supabase backend services (PostgreSQL, Auth, Studio, Storage, Kong)
echo ""
echo "[1/2] Starting Supabase PostgreSQL & Backend Services..."
# Release Windows portproxy bindings on 54321 and 30000 if present
if command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -Command '
    netsh interface portproxy delete v4tov4 listenport=54321 listenaddress=0.0.0.0 | Out-Null
    netsh interface portproxy delete v4tov4 listenport=30000 listenaddress=0.0.0.0 | Out-Null
  ' 2>/dev/null || true
elif [ -x "/mnt/c/windows/System32/WindowsPowerShell/v1.0/powershell.exe" ]; then
  /mnt/c/windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command '
    netsh interface portproxy delete v4tov4 listenport=54321 listenaddress=0.0.0.0 | Out-Null
    netsh interface portproxy delete v4tov4 listenport=30000 listenaddress=0.0.0.0 | Out-Null
  ' 2>/dev/null || true
fi

if ! $SUPABASE_CMD status >/dev/null 2>&1; then
  # Clean up any interrupted or dead containers first to avoid port 54321 collisions
  $SUPABASE_CMD stop --no-backup >/dev/null 2>&1 || true
  if command -v docker >/dev/null 2>&1; then
    docker rm -f $(docker ps -aq --filter "name=supabase_") >/dev/null 2>&1 || true
  fi
  $SUPABASE_CMD start || echo "ℹ️  Supabase start finished with warnings (continuing to web containers)..."
else
  echo "ℹ️  Supabase backend services are already running."
fi

# 2. Start Web Application and Nginx Reverse Proxy
echo ""
echo "[2/2] Starting WealthNest Web & Proxy Containers..."
docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" down --remove-orphans >/dev/null 2>&1 || true
docker rm -f wealthnest-proxy wealthnest-web-dev 2>/dev/null || true
docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d --build --remove-orphans

echo ""
echo "===================================================="
echo " WealthNest is LIVE!"
echo "===================================================="
echo " - Web Application  : http://localhost:30000"
echo " - Supabase Studio  : http://localhost:54323"
echo " - Supabase API     : http://localhost:54321"
echo " - PostgreSQL DB    : localhost:54322 (user: postgres, pass: postgres)"
echo "===================================================="
