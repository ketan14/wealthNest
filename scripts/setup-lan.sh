#!/usr/bin/env bash
# ==============================================================================
# WealthNest — WSL2 to Windows LAN Portproxy Trigger
# Triggers the Windows PowerShell setup script with elevated privileges
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PS_SCRIPT="$SCRIPT_DIR/setup-lan-portproxy.ps1"

if ! command -v powershell.exe >/dev/null 2>&1; then
  echo "❌ Error: powershell.exe was not found. Are you running inside WSL2 on Windows?"
  exit 1
fi

WIN_PATH="$(wslpath -w "$PS_SCRIPT")"
echo "Invoking Windows PowerShell setup script: $WIN_PATH"

# Run PowerShell as Administrator to configure netsh portproxy
powershell.exe -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-ExecutionPolicy Bypass -NoExit -File \"$WIN_PATH\"'"
echo "✅ Windows Administrator prompt launched to configure LAN port forwarding."

