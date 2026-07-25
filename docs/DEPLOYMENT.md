# Deployment Guide

## Architecture Overview

The production deployment uses Docker with two containers:

```
                         ┌──────────────────────────────┐
                         │       Cloudflare Network      │
                         │  CDN - WAF - DDoS Protection  │
                         └──────┬───────────────────────┘
                                │
                     ┌──────────┴──────────┐
                     │  cloudflared tunnel  │
                     └──────────┬──────────┘
                                │
                     ┌──────────┴──────────┐
                     │  nginx (port 8080)   │
                     │  + HTTPS (8443)      │
                     │  SPA + API proxy     │
                     └──────────────────────┘
                                │ /api/*
                     ┌──────────┴──────────┐
                     │ PocketBase (port 8090)│
                     │   pb_data/ (volume)   │
                     └─────────────────────┘

LAN Users: http://192.168.x.x:8080 (through nginx, zero latency)
Remote:    https://app.yourdomain.com (via Cloudflare Tunnel → nginx, HTTPS)
Direct:    http://192.168.x.x:8090 (PocketBase admin UI, LAN only)
```

The nginx container serves the SPA and proxies `/api/*` and `/_/*` to PocketBase. The Cloudflare Tunnel exposes `localhost:8080` (nginx) to the internet. PocketBase port 8090 remains accessible on the LAN for direct admin access.

## Prerequisites

### Accounts

| Service | Purpose | Cost |
|---------|---------|------|
| [Cloudflare](https://www.cloudflare.com/) | DNS, Tunnel (cloudflared), WAF, CDN | Free tier |
| [GitHub](https://github.com/) | Code hosting, CI/CD | Free tier |

### Server

- A machine that stays on 24/7 (Windows or Linux)
- Router assigns a **static LAN IP** (DHCP reservation recommended)
- **Docker Desktop** (Windows) or **Docker Engine** (Linux) installed

#### Which machine, on a $0 budget

The platform now serves multiple barangays from one shared backend, so its uptime is
everyone's uptime — that pushes the "server" above from "any PC in the office" toward
something with real cloud reliability, without necessarily paying for it:

| Option | Cost | Uptime | Notes |
|--------|------|--------|-------|
| **Oracle Cloud "Always Free" (Ampere A1)** — recommended | $0, permanently | Real cloud SLA | Up to 4 OCPU / 24GB RAM free forever (not a 12-month trial like AWS/GCP). Requires a card for identity verification (no charge). Treat the same as any other Docker host below — install Docker, `git pull`, `docker compose up -d --build`. |
| Self-hosted PC + Cloudflare Tunnel (documented below) | $0 | Only as good as your own power/internet | Fine to start with or run alongside Oracle as a second replica later; not a substitute for real uptime once you're carrying multiple barangays' data. |
| Paid VPS (Hetzner, DigitalOcean, Vultr) | ~$5-6/mo | Real cloud SLA | Only worth paying for once Oracle's free-tier limits are actually hit — don't pre-pay for headroom you don't need yet. |

Whichever host you pick, the rest of this guide (Docker Compose stack, Cloudflare Tunnel,
backups) is identical — none of it assumes a specific provider.

### Software to Install

| Software | Purpose |
|----------|---------|
| [Docker](https://docs.docker.com/get-docker/) | Container runtime |
| [Node.js](https://nodejs.org) 20+ | Building the frontend |
| [Git](https://git-scm.com) | Pulling code updates |
| [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) | Cloudflare Tunnel client |

## Deployment Options

BarangayOS supports three deployment approaches:

| Approach | Best for | Public access |
|----------|----------|---------------|
| **Cloudflare Tunnel** (recommended) | Barangay offices with intermittent internet | HTTPS via tunnel |
| **Direct HTTPS** | Servers with a public IP | HTTPS via reverse proxy |
| **LAN-only** | Internal network, no internet needed | Local network only |

---

## Option A: Cloudflare Tunnel (Recommended)

### Step 1: Cloudflare Tunnel Setup

#### 1a. Add your domain to Cloudflare

1. Add your domain (e.g., `barangay.gov.ph`) to Cloudflare
2. Update the nameservers to point to Cloudflare's

#### 1b. Choose a subdomain

Pick a subdomain for the app, e.g., `records.barangay.gov.ph`.

#### 1c. Install cloudflared

**Windows:**

```powershell
# Download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
# Extract cloudflared.exe to C:\Program Files (x86)\cloudflared\
```

**Linux:**

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

#### 1d. Authenticate

```bash
cloudflared tunnel login
```

This opens a browser — log in to Cloudflare and authorize your domain.

#### 1e. Create the tunnel

```bash
cloudflared tunnel create barangayos
```

Save the **tunnel UUID** and **credentials file path** printed by this command.

#### 1f. Configure ingress

**Windows:** `C:\ProgramData\cloudflared\config.yml`
**Linux:** `~/.cloudflared/config.yml`

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /path/to/<TUNNEL_UUID>.json
ingress:
  - hostname: records.barangay.gov.ph
    service: http://localhost:8080
  - service: http_status:404
```

#### 1g. Route DNS

```bash
cloudflared tunnel route dns barangayos records.barangay.gov.ph
```

#### 1h. Install as a service

**Windows** (admin PowerShell):

```powershell
cloudflared.exe service install <TUNNEL_TOKEN>
Start-Service cloudflared
```

**Linux:**

```bash
sudo cloudflared service install <TUNNEL_TOKEN>
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

> The tunnel token is found in Cloudflare Dashboard → Zero Trust → Access → Tunnels.

#### 1i. Verify

Visit `https://records.barangay.gov.ph/` — you should see the app login page.

---

### Step 2: Docker Deployment

#### 2a. Build the frontend

```bash
cd frontend
npm run build
```

This produces static files in `frontend/dist/`.

#### 2b. Set the encryption key

PocketBase requires an encryption key for session management:

```bash
# Generate a key
openssl rand -hex 16
# Example output: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
```

**Windows (PowerShell):**

```powershell
$env:PB_ENCRYPTION_KEY = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
```

**Linux / macOS:**

```bash
export PB_ENCRYPTION_KEY="a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
```

#### 2c. Start the stack

```bash
cd backend
docker compose up -d --build
```

This starts:
- **nginx** on port `8080` — serves the SPA and proxies API requests
- **PocketBase** on port `8090` — REST API and admin UI

#### 2d. Verify

| URL | What to check |
|-----|---------------|
| http://localhost:8080 | App login page loads |
| http://localhost:8090/_/ | PocketBase admin login |

---

### Step 3: Environment Configuration

Create `frontend/.env.production` (gitignored, stays on the server):

```env
VITE_API_URL=https://records.barangay.gov.ph
VITE_LOCAL_API_URL=http://192.168.1.100:8080
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
```

Replace `192.168.1.100` with the server's actual static LAN IP.

> **Important:** `VITE_API_URL` is the tunnel URL (HTTPS) so remote users get a secure connection. `VITE_LOCAL_API_URL` is the LAN IP so local users avoid tunnel latency. The app's smart URL resolver automatically selects the right one.

### About PB_ENCRYPTION_KEY

This environment variable is read by the PocketBase container at runtime. Set it in the environment before running `docker compose up`.

You can also set it permanently:

**Windows:** System Properties → Environment Variables → New → `PB_ENCRYPTION_KEY`

**Linux:** Add `export PB_ENCRYPTION_KEY="your-key"` to `/etc/environment` or the systemd service file.

> **Note:** `.env.production` and the encryption key are gitignored and never pushed to GitHub.

---

### Step 4: Auto-Deploy via GitHub Actions

#### 4a. Create a GitHub repository

1. Go to [GitHub](https://github.com/new)
2. Create a repository (e.g., `barangayos`)

#### 4b. Push the code

```bash
cd D:\BARANGAYCC\barangay-system
git remote add origin https://github.com/YOUR_USER/barangayos.git
git push -u origin main
```

#### 4c. Install a self-hosted GitHub runner

The self-hosted runner listens for pushes and runs the deploy script automatically.

1. GitHub repo → **Settings** → **Actions** → **Runners** → **New self-hosted runner**
2. Select your OS and follow the setup commands

**Windows:**

```powershell
mkdir C:\actions-runner; cd C:\actions-runner
# Download the runner package from GitHub (use URL from the instructions above)
.\config.cmd --url https://github.com/YOUR_USER/barangayos --token YOUR_TOKEN
.\run.cmd --startuptype windows_service
```

**Linux:**

```bash
mkdir /opt/actions-runner && cd /opt/actions-runner
# Download the runner package from GitHub (use URL from the instructions above)
./config.sh --url https://github.com/YOUR_USER/barangayos --token YOUR_TOKEN
sudo ./svc.sh install
sudo ./svc.sh start
```

#### 4d. How CI/CD works

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and PR to `main`:

| Stage | What it does |
|-------|-------------|
| **Lint** | oxlint code quality check |
| **Type Check** | TypeScript compiler check (`tsc -b`) |
| **Unit Tests** | Vitest test suite |
| **Build** | Production build via `npm run build` |
| **Security** | `npm audit` for dependency vulnerabilities |
| **E2E Tests** | Playwright browser tests |

> The self-hosted runner is optional — you can deploy manually instead.

---

### Step 5: Database Backup

Two backup mechanisms are available. **Use Litestream as the primary mechanism** — it
streams every write continuously, so a lost or corrupted volume costs seconds of data,
not the minutes between periodic snapshots. The PocketBase Admin UI's built-in backup
(below) is a fine secondary/manual snapshot to keep enabled alongside it, but shouldn't
be your only line of defense.

#### 5a. Continuous backups (Litestream) — recommended

A `litestream` sidecar container is already wired into `backend/docker-compose.yml`; it
just needs credentials for any S3-compatible bucket (Cloudflare R2, Oracle Object
Storage, AWS S3, ...).

1. Create a bucket (e.g. `barangay-db-backup`) with your storage provider
2. Create an access key scoped to that bucket (R2: **R2 → Manage API Tokens → Object
   Read & Write**; Oracle: **Object Storage → Customer Secret Keys**)
3. Set these in `backend/.env` (see `backend/.env.example`):

   ```env
   LITESTREAM_BUCKET=barangay-db-backup
   LITESTREAM_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   LITESTREAM_REGION=auto
   LITESTREAM_ACCESS_KEY_ID=your-access-key-id
   LITESTREAM_SECRET_ACCESS_KEY=your-secret-access-key
   ```

4. `docker compose up -d --build` — the `litestream` container starts replicating
   `data.db` and `auxiliary.db` continuously (10s sync interval, 7-day retention)
5. Verify: `docker compose logs litestream` should show periodic `"replicating to..."`
   activity with no errors, and the configured bucket should start filling with
   `generations/` objects within a minute

**Restoring from a Litestream backup** (disaster recovery — test this before you need it):

```bash
docker compose stop pocketbase
docker run --rm -v barangay_pb_data:/pb/pb_data -v $(pwd)/litestream.yml:/etc/litestream.yml \
  --env-file .env litestream/litestream:0.3 restore -config /etc/litestream.yml -o /pb/pb_data/data.db /pb/pb_data/data.db
docker compose start pocketbase
```

Run this against a scratch volume first to confirm the procedure actually works — an
untested backup is not a backup.

#### 5b. Periodic snapshot backups (PocketBase Admin UI) — secondary

1. Visit `http://localhost:8090/_/` and log in as admin
2. Go to **Settings** → **Backups**
3. Enable **Automatic backups**
4. Set interval to **5 minutes** (or your preferred interval)

#### 5c. Configure Cloudflare R2 for the Admin UI backups (or any S3-compatible storage)

| Setting | Value |
|---------|-------|
| **Bucket** | `barangay-db-backup` |
| **Endpoint** | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| **Region** | `auto` |
| **Access Key ID** | Your R2 API token access key |
| **Secret Access Key** | Your R2 API token secret key |

**To get R2 credentials:**

1. Cloudflare Dashboard → R2 → Create Bucket (name: `barangay-db-backup`)
2. R2 → Account Details → Manage API Tokens
3. Create API Token → **Object Read & Write**
4. Scope to bucket `barangay-db-backup`
5. Copy the **Access Key ID** and **Secret Access Key**

> This can be the same bucket used for Litestream (5a) with a different path prefix, or
> a separate bucket — either is fine.

#### 5d. Verify

Wait for the first backup cycle (up to 5 minutes), then check the R2 bucket to confirm backup files appear.

### Step 6: Monitoring & Error Tracking

Both of these are optional and free at this scale — the app runs fine without them, but you
won't know something's wrong until a barangay tells you.

#### 6a. Frontend error tracking (Sentry)

1. Create a free account at [sentry.io](https://sentry.io) (5,000 events/month free) and a new
   React project
2. Copy the project's DSN
3. Set `VITE_SENTRY_DSN` in `frontend/.env.production` (and pass it as a build arg if building via
   `docker compose` — already wired into `backend/docker-compose.yml`)
4. Rebuild — errors now report to Sentry automatically (`frontend/src/lib/sentry.ts`); leave it
   unset to run without error tracking, nothing else changes

#### 6b. Uptime monitoring

Point a free uptime checker at the health endpoint so you find out about downtime before a
barangay office calls you:

1. Create a free monitor at [UptimeRobot](https://uptimerobot.com) or
   [Better Stack](https://betterstack.com) (both have free tiers)
2. Target URL: `https://records.yourdomain.com/api/health` (or your LAN/tunnel URL)
3. Check interval: 5 minutes is plenty
4. Point alerts at an email or phone number someone actually checks

---

## Option B: Direct HTTPS (Without Cloudflare Tunnel)

If your server has a public IP address and you prefer not to use Cloudflare:

1. Set up a reverse proxy (nginx, Caddy, or Traefik) with Let's Encrypt for HTTPS
2. Point your domain's DNS A record to the server's public IP
3. Configure the reverse proxy to forward traffic to `http://localhost:8080`
4. Set `VITE_API_URL` to your domain (HTTPS)

**Example nginx reverse proxy config:**

```nginx
server {
    listen 443 ssl;
    server_name records.barangay.gov.ph;

    ssl_certificate /etc/letsencrypt/live/records.barangay.gov.ph/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/records.barangay.gov.ph/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Option C: LAN-Only Deployment

For barangay offices that don't need internet access:

1. Follow Step 2 (Docker Deployment) only
2. Access the app via the server's LAN IP: `http://192.168.x.x:8080`
3. No Cloudflare account or tunnel needed
4. No domain name needed

---

## Option D: LAN + HTTPS (For PWA / Installable App)

If you want the PWA install button to appear on LAN devices, the site must be served over HTTPS. This option adds HTTPS on the LAN without needing a domain or internet connection.

> **How it works:** The Docker image includes a self-signed placeholder certificate so nginx always starts with HTTPS enabled (port 8443). For proper PWA install without browser warnings, generate device-trusted certs using `mkcert` — the real certs silently override the placeholder via a Docker volume mount.

### Step 1: Generate trusted certificates

On the **server machine**, run the cert generation script:

```powershell
.\scripts\generate-certs.ps1
```

This script will:
- Install (or verify) `mkcert` — a zero-config local certificate authority
- Install the mkcert root CA on the server (one-time)
- Detect your server's LAN IP automatically
- Generate certificates for your LAN IP (`backend/certs/`)

If automatic IP detection fails, pass it manually:

```powershell
.\scripts\generate-certs.ps1 -LanIp 192.168.1.100
```

### Step 2: Enable the cert volume mount

Edit `backend/docker-compose.yml` and **uncomment** the certs volume line:

```yaml
frontend:
  # ...
  ports:
    - "8080:80"
    - "8443:443"
  volumes: [ "./certs:/etc/nginx/certs" ]    # ← uncomment this
```

### Step 3: Rebuild and restart

```powershell
cd backend
docker compose up -d --build
```

### Step 4: Access via HTTPS

Open `https://<SERVER_LAN_IP>:8443` on any device.

- **Same device as server** → cert is already trusted (mkcert installed the root CA)
- **Other LAN devices** → visit the URL once and accept the certificate warning, OR install the mkcert root CA on each device:

  | Device | How to trust |
  |--------|-------------|
  | Windows | `mkcert -install` (then restart browser) |
  | macOS   | `mkcert -install` |
  | Android | Settings → Security → CA certificate → Install the `rootCA.pem` from the server |
  | iOS     | Share `rootCA.pem` via AirDrop, then Settings → Profile → Install |

  > The mkcert root CA file is at: `$env:LOCALAPPDATA\mkcert\rootCA.pem` (Windows) or `~/.local/share/mkcert/rootCA.pem` (macOS/Linux)

Once the cert is trusted, the PWA install button will appear in the sidebar.

### Architecture diagram

```
                            ┌──────────────────────────────┐
                            │         LAN Network          │
                            │  192.168.x.0/24              │
                            └──────┬───────────────────────┘
                                   │
                        ┌──────────┴──────────┐
                        │   nginx (docker)     │
                        │   :80  (HTTP)        │
                        │   :443 (HTTPS, mkcert)│
                        └──────────┬──────────┘
                                   │ /api/*
                        ┌──────────┴──────────┐
                        │ PocketBase (port 8090)│
                        └─────────────────────┘

  HTTP:   http://192.168.x.x:8080     (no PWA, no install)
  HTTPS:  https://192.168.x.x:8443    (PWA installable)
```

---

## Troubleshooting

### View container logs

```bash
# All containers
docker compose logs

# Specific service
docker compose logs nginx
docker compose logs pocketbase

# Follow logs in real-time
docker compose logs -f
```

### Restart containers

```bash
docker compose restart nginx    # Restart nginx only
docker compose restart pocketbase  # Restart PocketBase only
docker compose restart           # Restart all
```

### Rebuild and restart

```bash
docker compose up -d --build
```

### Check container status

```bash
docker compose ps
```

### Login shows "Something went wrong"

- Open DevTools → Network tab → check which URL the POST request goes to
- If it's the tunnel URL but you're on LAN, the local IP in `.env.production` might be wrong
- Run `ipconfig` (Windows) or `ip a` (Linux) on the server, check the IPv4 address, and update `VITE_LOCAL_API_URL`

### Tunnel returns 503

- Check cloudflared is running: `Get-Service cloudflared` (Windows) or `systemctl status cloudflared` (Linux)
- Check the tunnel status in the Cloudflare dashboard
- Verify `config.yml` has the correct tunnel UUID and hostname, pointing to `localhost:8080`
- Make sure Docker containers are running: `docker compose ps`

### Build succeeds but changes don't appear

- Hard-refresh the browser (Ctrl+Shift+R) to bypass cache
- Verify the new container image was built: `docker compose up -d --build`
- Check that nginx is serving the updated `dist/` files

### PocketBase crashes on startup

- Check the PocketBase logs: `docker compose logs pocketbase`
- The `pb_data/` directory may be corrupted. Stop the container, back up `pb_data/`, delete it, and restart (migrations will re-run)

---

## Quick Reference

### Build and deploy

```bash
cd frontend && npm run build
export PB_ENCRYPTION_KEY="your-32-char-hex-key"  # Linux
# $env:PB_ENCRYPTION_KEY = "your-key"            # Windows
cd backend && docker compose up -d --build
```

### Deploy via Git push (self-hosted runner)

```bash
git add .
git commit -m "feat: add my changes"
git push origin main
```

### Check server health

```bash
curl http://localhost:8080/api/health
curl https://records.barangay.gov.ph/api/health
```

### Generate LAN HTTPS certificates

```powershell
.\scripts\generate-certs.ps1
```

After generating certs, uncomment `volumes: [ "./certs:/etc/nginx/certs" ]` in `backend/docker-compose.yml` and rebuild:

```bash
cd backend && docker compose up -d --build
```

### Generate square PWA icons

If you replace `public/icon-logo.png` with a custom logo, regenerate the square icons:

```bash
cd frontend && node scripts/generate-icons.cjs
```

### View logs

```bash
docker compose logs -f
```

### Restart services

```bash
docker compose restart
```

---

## Pre-deployment Checklist

Before deploying, always verify:

```bash
cd frontend
npm run lint       # No lint errors
npx tsc -b         # No type errors
npm run test       # All tests pass
npm run build      # Build succeeds
```

All four should pass cleanly.
