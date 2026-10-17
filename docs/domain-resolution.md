# Local Domain Configuration: http://wealthnest.local

WealthNest is pre-configured to be served at `http://wealthnest.local` through a project-local Nginx reverse proxy running on port 80.

---

## 1. Windows Hostname Resolution Setup

To access `http://wealthnest.local` from your Windows browser (Chrome, Edge, Firefox, Brave), map the hostname to `127.0.0.1` in your Windows `hosts` file.

### Step-by-Step Instructions:
1. Open Windows Start menu and search for **Notepad** (or your preferred text editor).
2. Right-click on **Notepad** and select **"Run as administrator"**.
3. In Notepad, click **File -> Open...** and navigate to:
   ```
   C:\Windows\System32\drivers\etc\hosts
   ```
   *(Ensure file type selector in the bottom right is set to "All Files (*.*)")*
4. Add the following line at the bottom of the file:
   ```
   127.0.0.1   wealthnest.local
   ```
5. Save the file (**Ctrl + S**).

---

## 2. Verification

Once your Docker containers are running (`npm run docker:dev:d`):
1. Open your Windows browser and visit:
   [http://wealthnest.local](http://wealthnest.local)
2. Verify that the WealthNest dashboard shell loads with a green indicator:
   `wealthnest.local (WSL2 / Docker)`
3. Test Hot Module Replacement (HMR) by modifying a file in `apps/web/src/pages/HomePage.tsx`; your browser will update instantly without refreshing.

---

## 3. Architecture & Proxy Routing

```
[Windows Browser]
       │
       ▼ http://wealthnest.local:80
[Nginx Reverse Proxy Container: wealthnest-proxy]
       │
       ├── Forward HTTP ──▶ http://wealthnest-web-dev:5173
       └── Forward WebSocket ─▶ ws://wealthnest-web-dev:5173 (Vite HMR)
```

- **Container Name**: `wealthnest-proxy`
- **Port Mapping**: `80:80`
- **Reverse Proxy Target**: `http://web:5173` (internal Docker bridge network `wealthnest-net`)
- **Vite Configuration**:
  - `server.host`: `0.0.0.0`
  - `server.allowedHosts`: `['wealthnest.local', 'localhost', '127.0.0.1']`
  - `server.hmr.clientPort`: `80`

---

## 4. Troubleshooting

### Problem: Browser says "Server Not Found" or searches Google
- **Fix**: Flush Windows DNS cache. Open Windows PowerShell and run:
  ```powershell
  ipconfig /flushdns
  ```
  Ensure the entry in `C:\Windows\System32\drivers\etc\hosts` does not have a leading `#` comment.

### Problem: Port 80 conflict on Windows
- If another service on Windows (like IIS, Skype, or an existing proxy) binds port 80:
  1. Check what is listening on port 80 in PowerShell:
     ```powershell
     netstat -ano | findstr :80
     ```
  2. If needed, you can adjust the proxy port in `.env` (e.g. `8080:80`), in which case the URL will be `http://wealthnest.local:8080`.

### Problem: WebSocket / HMR Disconnected
- Verify that `infra/docker/nginx.conf` contains:
  ```nginx
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  ```
- This configuration is included by default.

---

## 5. Future HTTPS Consideration
HTTP is sufficient for local development. If local HTTPS is required in future phases:
- Install `mkcert` on Windows and WSL (`mkcert -install && mkcert wealthnest.local`).
- Mount the generated certificates into `infra/docker/certs/` and configure Nginx `listen 443 ssl`.
