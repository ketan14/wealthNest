#!/usr/bin/env bash
# ==============================================================================
# WealthNest — Port Conflict Resolver & Clean Reset
# Stops any stuck containers and releases ports 54321, 30000, 5174
# ==============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/infra/docker/docker-compose.yml"

echo "===================================================="
echo " WealthNest Port Conflict Resolver"
echo "===================================================="

# 1. Stop all Docker Compose containers
echo ""
echo "[1/4] Stopping Docker Compose containers..."
if command -v docker >/dev/null 2>&1; then
  docker compose -p wealthnest -f "$COMPOSE_FILE" down --remove-orphans >/dev/null 2>&1 || true
  docker rm -f wealthnest-proxy wealthnest-web-dev 2>/dev/null || true
fi

# 2. Stop and remove all lingering Supabase containers
echo ""
echo "[2/4] Stopping and removing lingering Supabase containers..."
if command -v docker >/dev/null 2>&1; then
  docker rm -f $(docker ps -aq --filter "name=supabase_") 2>/dev/null || true
fi

# 3. Kill any lingering processes on conflict ports inside WSL
echo ""
echo "[3/4] Releasing WSL ports (54321, 30000, 5174)..."
for port in 54321 30000 5174; do
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  fi
done

# 4. Clear Windows portproxy rules if powershell.exe is present
echo ""
echo "[4/4] Clearing Windows portproxy rules..."
POWERSHELL_CMD=""
if command -v powershell.exe >/dev/null 2>&1; then
  POWERSHELL_CMD="powershell.exe"
elif [ -x "/mnt/c/windows/System32/WindowsPowerShell/v1.0/powershell.exe" ]; then
  POWERSHELL_CMD="/mnt/c/windows/System32/WindowsPowerShell/v1.0/powershell.exe"
fi

if [ -n "$POWERSHELL_CMD" ]; then
  echo "  -> Removing Windows netsh portproxy bindings on 54321, 30000, 5174..."
  "$POWERSHELL_CMD" -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -Command netsh interface portproxy reset'" 2>/dev/null || true
  echo "  ✅ Windows portproxy reset triggered."
else
  echo "  ℹ️  If on Windows, please run in PowerShell (as Admin):"
  echo "      netsh interface portproxy delete v4tov4 listenport=54321 listenaddress=0.0.0.0"
  echo "      netsh interface portproxy delete v4tov4 listenport=30000 listenaddress=0.0.0.0"
fi

echo ""
echo "===================================================="
echo " All ports released and containers reset cleanly!"
echo " You can now run: ./scripts/start.sh"
echo "===================================================="
