# ==============================================================================
# WealthNest - Automated Windows-to-WSL2 LAN Port Forwarding
# Must be executed in Windows PowerShell as Administrator.
# ==============================================================================

# Ensure running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERROR] This script must be run as Administrator." -ForegroundColor Red
    Write-Host "[INFO] Please right-click PowerShell -> 'Run as Administrator', then execute this script." -ForegroundColor Yellow
    Exit 1
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " WealthNest - Automated LAN Port Forwarding Setup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Automatically detect WSL2 IP
$wslRaw = (wsl hostname -I)
$wslIp = $wslRaw.Trim().Split(" ")[0]

if (-not $wslIp -or $wslIp -notmatch '^\d+\.\d+\.\d+\.\d+$') {
    Write-Host "[ERROR] Could not automatically detect WSL2 IP. Is WSL2 running?" -ForegroundColor Red
    Exit 1
}

Write-Host "[OK] Detected Live WSL2 IP : $wslIp" -ForegroundColor Green

# 2. Ports to forward
$ports = @(30000, 5174, 54321)

Write-Host "`n--- Configuring Windows Port Forwarding (netsh) ---" -ForegroundColor Yellow
foreach ($port in $ports) {
    # Remove existing stale rule if any
    netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 | Out-Null
    
    # Add fresh rule pointing to current WSL2 IP
    netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$wslIp
    Write-Host "  * Port $port forwarded -> ${wslIp}:${port}" -ForegroundColor Green
}

# 3. Ensure Firewall Rules exist
Write-Host "`n--- Checking Windows Firewall Rules ---" -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "WealthNest Web Proxy (LAN)" -Direction Inbound -LocalPort 30000 -Protocol TCP -Action Allow -Profile Private -ErrorAction SilentlyContinue | Out-Null
New-NetFirewallRule -DisplayName "WealthNest Web Dev (LAN)" -Direction Inbound -LocalPort 5174 -Protocol TCP -Action Allow -Profile Private -ErrorAction SilentlyContinue | Out-Null
New-NetFirewallRule -DisplayName "WealthNest Supabase API (LAN)" -Direction Inbound -LocalPort 54321 -Protocol TCP -Action Allow -Profile Private -ErrorAction SilentlyContinue | Out-Null
Write-Host "  * Inbound firewall rules verified for ports 30000, 5174, 54321." -ForegroundColor Green

# 4. Display local Wi-Fi IP
$wifiIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "*Wi-Fi*","*Ethernet*" -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "169.254*" -and $_.IPAddress -notlike "127.0.0.1" } | Select-Object -First 1).IPAddress

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "[OK] LAN Port Forwarding is ACTIVE!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
if ($wifiIp) {
    Write-Host "[*] Mobile Web URL : http://${wifiIp}:30000" -ForegroundColor Yellow
    Write-Host "[*] Supabase API   : http://${wifiIp}:54321" -ForegroundColor Yellow
} else {
    Write-Host "[*] Mobile Web URL : http://<Your-Windows-IP>:30000" -ForegroundColor Yellow
}
Write-Host "==================================================" -ForegroundColor Cyan
