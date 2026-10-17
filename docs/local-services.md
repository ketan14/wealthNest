# WealthNest Local Development Services & URLs

This document provides a quick reference for all local development services, database managers, ports, and credentials for WealthNest.

---

## Service Directory

| Service | Local URL / Port | Credentials / Notes | What to do |
| :--- | :--- | :--- | :--- |
| **WealthNest Web App** | [http://wealthnest.local](http://wealthnest.local)<br>*(or [http://localhost](http://localhost))* | Port `80` (Proxied via Nginx) | Primary user interface. Test user registration, asset allocation, and live seeded taxonomy. |
| **Vite Dev Server (Direct)** | [http://localhost:5173](http://localhost:5173) | Internal port `5173` | Direct Vite development server fallback with live Hot Module Replacement (HMR). |
| **Supabase Studio (DB Manager)** | [http://localhost:54323](http://localhost:54323) | Free visual web GUI<br>*(phpMyAdmin alternative)* | Click **Table Editor** on the left to browse and edit all database tables (`asset_classes`, `profiles`, `assets`, `holdings`, `transactions`). |
| **PostgreSQL Database** | `127.0.0.1:54322`<br>*(Database: `postgres`)* | **User**: `postgres`<br>**Password**: `postgres` | Direct database connection. Connect via **DBeaver**, **TablePlus**, **DataGrip**, or VS Code database extensions. |
| **Inbucket (Email Mock)** | [http://localhost:54324](http://localhost:54324) | Web inbox | View mock confirmation emails and password reset links without sending real emails. |
| **Supabase API Gateway (Kong)** | [http://localhost:54321](http://localhost:54321) | REST / Auth gateway | Handles client authentication requests and database REST queries (`/auth/v1`, `/rest/v1`). |

---

## Terminal Command Cheat Sheet

### Which Terminal to Use?

| Command | Run in WSL2 Ubuntu (`ketan@...$`) | Run inside Docker Container (`/app $`) |
| :--- | :---: | :---: |
| `supabase start` / `stop` / `status` | **YES** | ❌ (No Docker daemon inside) |
| `npm run docker:dev:d` / `docker:down` | **YES** | ❌ (Cannot manage host containers) |
| `git status` / `git push` | **YES** | ❌ |
| `npm run type-check` | **YES** | **YES** |
| `npm test` | **YES** | **YES** |
| `npm run build` | **YES** | **YES** |

---

## Quick Lifecycle Commands

### 1. Web Application & Nginx Proxy (Docker Compose)
Run from **WSL2 Ubuntu**:
```bash
# Start Web and Proxy containers in detached mode
npm run docker:dev:d

# View real-time container logs
npm run docker:logs

# Stop Web and Proxy containers (preserves all data)
npm run docker:down
```

### 2. Local Supabase Database Stack
Run from **WSL2 Ubuntu**:
```bash
# Start all 8 Supabase containers & apply migrations
supabase start

# Check container health and display all service URLs
supabase status

# Reset database & re-run all migrations from scratch
supabase db reset

# Stop all Supabase database containers
supabase stop
```

---

## Connecting External Database Tools (DBeaver / TablePlus)

To inspect PostgreSQL directly using a desktop client:

- **Host**: `127.0.0.1`
- **Port**: `54322`
- **Database**: `postgres`
- **Username**: `postgres`
- **Password**: `postgres`
- **SSL**: Disabled (or `prefer`)
