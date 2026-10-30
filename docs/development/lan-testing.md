# WealthNest — LAN Development & Mobile Wi-Fi Setup Guide (WSL2 + Windows + Docker)

This guide documents how to run WealthNest locally on a Windows host using **WSL2 + Docker** and access both the web frontend and the local Supabase backend from:
- Android mobile devices on the same Wi-Fi.
- iOS mobile devices on the same Wi-Fi.
- Other laptops or PCs on your local network.
- The Tauri mobile / desktop application.

---

## 1. Quick Architecture Overview

```text
[ Windows Host ]
  ├── Wi-Fi IPv4: 192.168.1.105 (example)
  ├── Windows Port Forwarding (netsh portproxy)
  │     ├── :30000 ──► Forwarded to WSL2 IP:30000 (Nginx Web Proxy)
  │     ├── :5174  ──► Forwarded to WSL2 IP:5174 (Vite Dev Server)
  │     └── :54321 ──► Forwarded to WSL2 IP:54321 (Supabase API)
  │
  └── [ WSL2 VM (Ubuntu) ]
        ├── Internal WSL2 IP: 172.x.x.x
        ├── Docker Compose: wealthnest-proxy (:30000) -> wealthnest-web-dev (:5174)
        └── Supabase CLI: Kong API Gateway (:54321)
```

---

## 2. Starting Local WealthNest Services

From inside your WSL2 terminal in the project root:

```bash
# 1. Start Supabase PostgreSQL, Auth, and Storage
supabase start

# 2. Verify Supabase services are healthy
supabase status

# 3. Start WealthNest web containers
./scripts/start.sh
# or: npm run docker:dev:d
```

Verify service ports:
- **Web Application**: `http://localhost:5174` (or `http://localhost:30000` via Nginx)
- **Supabase API**: `http://127.0.0.1:54321`
- **Supabase Studio (internal only)**: `http://localhost:54323`

---

## 3. Finding Your IP Addresses

### A. Find Windows Wi-Fi IPv4 Address
Open **Windows PowerShell** (or Command Prompt) on your Windows host:
```powershell
ipconfig
```
Look for **Wireless LAN adapter Wi-Fi** or **Ethernet adapter**:
```text
IPv4 Address. . . . . . . . . . . : 192.168.1.105
Subnet Mask . . . . . . . . . . . : 255.255.255.0
Default Gateway . . . . . . . . . : 192.168.1.1
```
*(In this example, your Windows Wi-Fi IP is `192.168.1.105`)*.

### B. Find WSL2 Internal IPv4 Address
From inside your **WSL2 terminal**:
```bash
hostname -I | awk '{print $1}'
```
*(Example output: `172.28.240.181`)*.

> [!NOTE]
> WSL2 assigns a new internal virtual IP each time Windows restarts. If your connection stops working after rebooting Windows, simply check `hostname -I` and update the portproxy rule below.

---

## 4. Configuring Windows Port Forwarding (Portproxy)

Windows does not forward LAN traffic into WSL2 virtual machines by default. Run **PowerShell as Administrator** on Windows:

```powershell
# Set your WSL2 IP from "hostname -I"
$wslIp = "172.28.240.181"

# 1. Forward Web Frontend primary Nginx port 30000
netsh interface portproxy add v4tov4 listenport=30000 listenaddress=0.0.0.0 connectport=30000 connectaddress=$wslIp

# 2. Forward Web Frontend fallback Vite port 5174
netsh interface portproxy add v4tov4 listenport=5174 listenaddress=0.0.0.0 connectport=5174 connectaddress=$wslIp

# 3. Forward Supabase API port 54321
netsh interface portproxy add v4tov4 listenport=54321 listenaddress=0.0.0.0 connectport=54321 connectaddress=$wslIp

# 4. Verify active port forwarding rules
netsh interface portproxy show v4tov4
```

### Removing or Updating Rules (If WSL2 IP Changes)
```powershell
netsh interface portproxy delete v4tov4 listenport=5174 listenaddress=0.0.0.0
netsh interface portproxy delete v4tov4 listenport=54321 listenaddress=0.0.0.0
```

---

## 5. Configuring Windows Defender Firewall

Allow inbound connections for the frontend (`5174`) and Supabase API (`54321`) on the **Private network profile only**:

```powershell
# Run in Administrator PowerShell:
New-NetFirewallRule -DisplayName "WealthNest Web Proxy (LAN)" -Direction Inbound -LocalPort 30000 -Protocol TCP -Action Allow -Profile Private
New-NetFirewallRule -DisplayName "WealthNest Web Dev (LAN)" -Direction Inbound -LocalPort 5174 -Protocol TCP -Action Allow -Profile Private
New-NetFirewallRule -DisplayName "WealthNest Supabase API (LAN)" -Direction Inbound -LocalPort 54321 -Protocol TCP -Action Allow -Profile Private
```

> [!IMPORTANT]
> Never open port `54322` (raw PostgreSQL) or port `54323` (Supabase Studio) to the Wi-Fi network. Only expose the API gateway (`54321`) and frontend (`5174`).

---

## 6. Testing & Connecting from Mobile Devices

1. Connect your Android or iOS phone to the **same Wi-Fi network** as your Windows PC.
2. Open Chrome or Safari on your phone and browse to:
   ```text
   http://192.168.1.105:5174
   ```
3. Navigate to **Settings** $\rightarrow$ **Server Connection**:
   - Connection Mode: select **LAN Development (Wi-Fi)**.
   - Server IPv4 Address: enter your Windows IP (e.g., `192.168.1.105`).
   - Supabase API Port: `54321`.
   - Tap **Test Connection** $\rightarrow$ verifies `http://192.168.1.105:54321/auth/v1/health` with live latency probe.
   - Tap **Save & Reconnect** $\rightarrow$ the app connects immediately without reloading or rebuilding.

---

## 7. Dynamic IP Changes (No Rebuilding Needed!)

If your Wi-Fi router assigns your PC a new IP (e.g., `192.168.1.110`):
1. In Windows PowerShell: run `ipconfig` to see the new IP.
2. On your phone: open **Settings** $\rightarrow$ **Server Connection**, change the IP to `192.168.1.110`, tap **Save & Reconnect**.
3. All portfolio transactions, CAS imports, and auth requests immediately route to the new IP.

---

## 8. Troubleshooting Checklist

| Issue | Likely Cause | Solution |
| :--- | :--- | :--- |
| **`Connection refused` on mobile** | Windows Firewall blocking port or portproxy missing | Verify `netsh interface portproxy show v4tov4` and ensure Windows Firewall rule is active for port 5174 & 54321. |
| **`Request timeout`** | Devices on different Wi-Fi networks | Ensure your phone is not on mobile data and is connected to the same Wi-Fi SSID (disable "AP / Client Isolation" in router if enabled). |
| **`Blocked request. Host ... is not allowed`** | Vite 6 allowedHosts restriction | Fixed in `vite.config.ts` via `allowedHosts: true`. |
| **`Supabase API unreachable`** | Supabase is not running | Run `supabase status` inside WSL2 to ensure Docker containers are up. |
| **`Connection failed after Windows reboot`** | WSL2 internal IP changed | Run `hostname -I` in WSL2 and update the Windows portproxy connectaddress. |
| **Switching back to Local Machine** | Want to use localhost | Open Settings $\rightarrow$ Server Connection $\rightarrow$ click **Reset to Defaults** or select **Local Development**. |

