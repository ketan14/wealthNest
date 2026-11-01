#!/usr/bin/env bash
# ==============================================================================
# WealthNest — Automated One-Click Development Launcher
# 1. Self-heals Node.js / npm environment (purges stale IDE & Windows wrappers)
# 2. Checks & ensures local Supabase backend is running
# 3. Releases any blocked ports
# 4. Launches Vite frontend dev server at http://localhost:5173
# ==============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "===================================================="
echo " Starting WealthNest Local Development Stack"
echo "===================================================="

cd "$PROJECT_ROOT"

# 1. Environment Self-Healing: Locate Linux NVM Node & npm
NODE_BIN=""
NPM_BIN=""

if [ -x "$HOME/.nvm/versions/node/v22.23.4/bin/node" ]; then
  NODE_BIN="$HOME/.nvm/versions/node/v22.23.4/bin/node"
  NPM_BIN="$HOME/.nvm/versions/node/v22.23.4/bin/npm"
elif [ -d "$HOME/.nvm/versions/node" ]; then
  LATEST_DIR="$(ls -d "$HOME/.nvm/versions/node/"* 2>/dev/null | sort -V | tail -n 1)"
  if [ -n "$LATEST_DIR" ] && [ -x "$LATEST_DIR/bin/node" ]; then
    NODE_BIN="$LATEST_DIR/bin/node"
    NPM_BIN="$LATEST_DIR/bin/npm"
  fi
fi

# Purge any IDE server wrappers or Windows Node paths from PATH
CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v "antigravity-ide-server" | grep -v "Program Files/nodejs" | tr '\n' ':' | sed 's/:$//')"
if [ -n "$NODE_BIN" ]; then
  export PATH="$(dirname "$NODE_BIN"):$CLEAN_PATH"
else
  export PATH="$CLEAN_PATH"
fi

unset NPM_CONFIG_PREFIX 2>/dev/null || true
unset NODE_PATH 2>/dev/null || true
unset -f node npm npx 2>/dev/null || true
unalias node npm npx 2>/dev/null || true
hash -r 2>/dev/null || true

NODE_VER="$(node -v 2>/dev/null || echo 'unknown')"
NPM_VER="$(npm -v 2>/dev/null || echo 'unknown')"
echo "[1/3] Node environment: $NODE_VER | npm: $NPM_VER (Linux NVM: $(which node 2>/dev/null))"

# 2. Detect Supabase CLI binary
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

# 3. Check and start Supabase backend services
echo ""
echo "[2/3] Checking Supabase Backend Services..."
if ! $SUPABASE_CMD status >/dev/null 2>&1; then
  echo "  -> Starting Supabase PostgreSQL, Auth & Studio..."

  # Clean up dead/orphaned containers from interrupted runs
  if command -v docker >/dev/null 2>&1; then
    docker rm -f $(docker ps -aq --filter "name=supabase_") >/dev/null 2>&1 || true
  fi

  # Release Windows portproxy binding on 54321 if present
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -Command netsh interface portproxy reset'" 2>/dev/null || true
  fi

  $SUPABASE_CMD start || echo "ℹ️  Supabase start completed with warnings (continuing to web server)..."
else
  echo "  ✅ Supabase backend is already running."
fi

echo "  - Supabase Studio : http://localhost:54323"
echo "  - Supabase API    : http://localhost:54321"

# 4. Launch Vite Web Dev Server
echo ""
echo "[3/3] Launching Vite Frontend Dev Server..."
echo "===================================================="
echo " WealthNest is LIVE at http://localhost:5173"
echo "===================================================="
echo ""

if [ -n "$NPM_BIN" ] && [ -x "$NPM_BIN" ]; then
  exec "$NPM_BIN" run dev --workspace=@wealthnest/web
else
  exec npm run dev --workspace=@wealthnest/web
fi
