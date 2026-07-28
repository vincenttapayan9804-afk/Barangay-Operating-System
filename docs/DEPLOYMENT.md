# Deployment Guide

## Architecture Overview

The production deployment is Docker Compose stack of eleven containers, defined in
`backend/supabase/docker-compose.yml`: **waf** (Coraza/OWASP CRS, the public entry point —
Security Phase 4), **frontend** (nginx, SPA + reverse proxy), **kong** (API gateway),
**auth** (GoTrue), **rest** (PostgREST), **realtime** (Supabase Realtime),
**edge-runtime** (Deno Edge Functions), **db** (Postgres), **supavisor** (connection
pooler), **meilisearch** (full-text search), **webauthn** (passkey sidecar), and **backup**
(continuous pgBackRest backup).

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
                     │  waf (port 8080)     │
                     │  + HTTPS (8443)      │
                     │  Coraza/OWASP CRS    │
                     └──────────┬──────────┘
                                │
                     ┌──────────┴──────────┐
                     │  nginx (internal)    │
                     │  SPA + API proxy     │
                     └──────────┬──────────┘
                                │ /rest/v1, /auth/v1, /realtime/v1, /functions/v1
                     ┌──────────┴──────────┐
                     │   kong (port 8000)   │
                     └──┬───┬────┬─────┬────┘
                        │   │    │     │
                       rest auth realtime edge-runtime
                        │   │    │     │
                        └───┴────┴─────┴──→ db (Postgres, port 5432)
                                              │
                                        supavisor (pooled port 6543)

LAN Users: http://192.168.x.x:8080 (through waf → nginx, zero latency)
Remote:    https://app.yourdomain.com (via Cloudflare Tunnel → waf, HTTPS)
```

See `docs/ARCHITECTURE.md`'s own diagram for the full container-to-container picture, including `meilisearch`, `webauthn`, and `backup`, none of which are reached directly by the browser. There is no PocketBase-style admin UI in this stack — table data is managed through the app itself (`/platform-admin` for tenant onboarding) or, for one-off operator tasks, directly via `psql` against `db`.

`waf` (`backend/waf/`) took over the 8080/8443 ports `frontend` used to publish directly —
it's a self-hosted second WAF layer (Coraza engine + OWASP Core Rule Set) that screens
every request before it reaches nginx or Kong, complementing rather than replacing
Cloudflare's own free-tier WAF (see `docs/THREAT_MODEL.md`). It reuses the same
`backend/certs/` volume (self-signed placeholder, or mkcert — see below) that `frontend`
used to mount, since it now terminates the deployment's real TLS instead.

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

#### 2a. Generate secrets

**Recommended (Security Phase 5 — Infisical):** stand up self-hosted Infisical once and
render `backend/supabase/.env` from it instead of hand-editing a file. See "Secrets
Management (Infisical)" below for the one-time setup, then:

```bash
INFISICAL_DOMAIN=http://localhost:8060/api \
INFISICAL_CLIENT_ID=... \
INFISICAL_CLIENT_SECRET=... \
INFISICAL_PROJECT_ID=... \
INFISICAL_ENV=prod \
  node backend/scripts/render-secrets-from-infisical.mjs
```

**Manual fallback** (no Infisical instance available yet):

```bash
cd backend/supabase
cp .env.example .env
openssl rand -base64 48   # run twice — for POSTGRES_PASSWORD and JWT_SECRET
openssl rand -base64 48   # for SECRET_KEY_BASE (Realtime + Supavisor)
openssl rand -hex 16      # for VAULT_ENC_KEY (must be exactly 32 hex chars, Supavisor)
```

Paste each into `.env`. Then generate the API keys that must agree with `JWT_SECRET`:

```bash
node ../scripts/generate-supabase-keys.mjs .env
# prints ANON_KEY=... and SERVICE_ROLE_KEY=... — paste both into .env
```

#### 2b. Start the stack

```bash
cd backend/supabase
docker compose up -d --build
```

This builds and starts all eleven services (see Architecture Overview above). `db` and
`backup` are built from `db.Dockerfile` (extends the official `supabase/postgres` image
with the `pgbackrest` binary — see Step 5); everything else pulls a published image.
First boot applies every file in `migrations/` in order automatically, via the
`supabase/postgres` image's own bundled entrypoint script (no custom wrapper needed).

#### 2c. Verify

```bash
docker compose ps          # every service should show "healthy" within ~60s
```

| URL | What to check |
|-----|---------------|
| http://localhost:8080 | App login page loads |
| http://localhost:8000/auth/v1/health | `{"date":...,"description":"GoTrue is a user registration and authentication API","name":"GoTrue","version":"..."}` |
| http://localhost:8000/rest/v1/ | An empty PostgREST root response (not an error) |

#### 2d. Bootstrap the first platform admin

There is no admin UI to click through for this — GoTrue's admin API only accepts the
`service_role` key, which never reaches a browser:

```bash
cd backend
SUPABASE_URL=http://localhost:8000 \
SERVICE_ROLE_KEY=<the key from .env> \
PLATFORM_ADMIN_EMAIL=you@example.com \
PLATFORM_ADMIN_PASSWORD='a strong password' \
node scripts/bootstrap-platform-admin.mjs
```

This does **not** enroll MFA — `app.mfa_satisfied()` (Row-Level Security) gates every
policy for `role=admin` behind aal2, so the very first login shows zero rows anywhere
until you complete TOTP enrollment (Settings → the passkey/MFA screen prompts for this on
first admin login). That's expected, not a bug.

---

## Secrets Management (Infisical)

Security Phase 5 replaces the old "copy `.env.example` to `.env` and hand-fill every
value" workflow with self-hosted [Infisical](https://infisical.com/), so real secrets
(JWT signing secret, DB password, service-role key, and any of Cloudinary/CompreFace's
keys once those are configured) live in one managed store instead of scattered plaintext
files across every server that runs this stack.

### One-time setup

1. **Stand up Infisical** (a separate compose project from the app stack — see
   `backend/infisical/docker-compose.yml`'s own header comment for why):

   ```bash
   cd backend/infisical
   cp .env.example .env
   # Fill in ENCRYPTION_KEY, AUTH_SECRET, POSTGRES_PASSWORD — see that file's own
   # comment for why these three specifically can't themselves be stored in
   # Infisical, and store them in a password manager or your host's own secret store.
   docker compose up -d
   ```

2. **Create a project** at `http://localhost:8060` (or wherever you exposed it — see the
   compose file's own comment on why it's loopback-only by default) and add an
   environment (e.g. `prod`).

3. **Import every secret name** from `backend/supabase/.env.example` into that project —
   the file's own comments document what each one is and how to generate it. This is a
   one-time manual step; there's no automated importer, since these are exactly the
   values a human should set deliberately once, not migrate blindly.

4. **Create a machine identity** (Universal Auth) scoped to that project, for
   `render-secrets-from-infisical.mjs` to authenticate as. Give it read-only access to
   secrets — it never needs to write.

### Rendering `.env` for a deployment

```bash
INFISICAL_DOMAIN=http://localhost:8060/api \
INFISICAL_CLIENT_ID=<machine identity client ID> \
INFISICAL_CLIENT_SECRET=<machine identity client secret> \
INFISICAL_PROJECT_ID=<project ID> \
INFISICAL_ENV=prod \
  node backend/scripts/render-secrets-from-infisical.mjs
```

This writes `backend/supabase/.env` from Infisical (never printing a secret value to the
terminal) and prints the next step (`docker compose up -d --build`, same as before). The
`.env` file itself is unchanged in shape and still gitignored — Phase 5 changes *how it
gets populated*, not how `docker-compose.yml` consumes it.

### Rotation policy

Rotate `POSTGRES_PASSWORD` and `JWT_SECRET` at minimum every 90 days, or immediately if
either is suspected compromised:

1. Update the value in Infisical's UI (or `infisical secrets set`).
2. Re-run `render-secrets-from-infisical.mjs` to produce a fresh `.env`.
3. If `JWT_SECRET` changed, also re-run `generate-supabase-keys.mjs` (a new `JWT_SECRET`
   invalidates the old `ANON_KEY`/`SERVICE_ROLE_KEY`, and every existing user session).
4. `docker compose up -d --build` to restart affected containers with the new values.

Rotating `JWT_SECRET` is disruptive (every logged-in session is invalidated at once) —
schedule it as planned maintenance, not silently.

### What Infisical does not remove

Infisical's own bootstrap secrets (`ENCRYPTION_KEY`, `AUTH_SECRET`,
`backend/infisical/.env`'s `POSTGRES_PASSWORD`) are the one remaining root of trust — a
secrets manager cannot also manage the credentials that unlock itself. Treat that one
file with the same care a password manager's own master password gets: on the host
machine only, backed up securely, never committed.

---

### Step 3: Environment Configuration

Create `frontend/.env.production` (gitignored, stays on the server):

```env
VITE_API_URL=https://records.barangay.gov.ph
VITE_LOCAL_API_URL=http://192.168.1.100:8080
VITE_SUPABASE_ANON_KEY=<the ANON_KEY from backend/supabase/.env>
```

Replace `192.168.1.100` with the server's actual static LAN IP.

For image uploads (asset photos), set `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/
`CLOUDINARY_API_SECRET` in `backend/supabase/.env` instead (Security Phase 3 moved this
server-side — see `backend/supabase/functions/.env.example`); there is nothing Cloudinary-related
to set in the frontend's own env file anymore.

> **Important:** `VITE_API_URL` is the tunnel URL (HTTPS) so remote users get a secure connection. `VITE_LOCAL_API_URL` is the LAN IP so local users avoid tunnel latency. The app's smart URL resolver automatically selects the right one — see `docs/ARCHITECTURE.md` "Smart URL Resolution." Both point at this same nginx (the SPA host), not directly at Kong — nginx proxies `/rest/v1`, `/auth/v1`, `/realtime/v1`, `/functions/v1` through to Kong itself (see `frontend/nginx.conf`), so the frontend only ever needs one origin.

`VITE_SUPABASE_ANON_KEY` is the long-lived anon JWT from `backend/supabase/.env` (generated in Step 2a) — safe to ship to the browser by design (it's the "logged out" role every RLS policy is written against), unlike `SERVICE_ROLE_KEY`, which must never leave the server.

> **Note:** `.env.production` and `backend/supabase/.env` are gitignored and never pushed to GitHub.

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

The Postgres equivalent of the old SQLite setup is **pgBackRest** (replaces
`backend/litestream.yml`), already wired into `backend/supabase/docker-compose.yml` as
two pieces working together: continuous WAL archiving (the `db` service's own
`archive_command`, started the instant Postgres boots) and periodic full/incremental base
backups (the `backup` service, `backend/supabase/backup/backup-cron.sh`). Together they
give the same guarantee Litestream gave SQLite — a lost or corrupted volume costs seconds
of data, not the interval between snapshots — plus point-in-time recovery, which a
single-file WAL stream never supported.

#### 5a. Configure the backup bucket

Any S3-compatible bucket works (Cloudflare R2, Oracle Object Storage, AWS S3, ...) — the
same one you may have used for Litestream is fine, with a different path prefix.

1. Create a bucket (e.g. `barangay-db-backup`) with your storage provider
2. Create an access key scoped to that bucket (R2: **R2 → Manage API Tokens → Object
   Read & Write**; Oracle: **Object Storage → Customer Secret Keys**)
3. Set these in `backend/supabase/.env` (see `.env.example`):

   ```env
   PGBACKREST_STANZA=barangay
   BACKUP_S3_BUCKET=barangay-db-backup
   BACKUP_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   BACKUP_S3_REGION=auto
   BACKUP_S3_ACCESS_KEY_ID=your-access-key-id
   BACKUP_S3_SECRET_ACCESS_KEY=your-secret-access-key
   ```

4. `docker compose up -d --build` (from `backend/supabase`) — `db` starts continuously
   archiving completed WAL segments to the bucket the moment each one fills; `backup`
   waits for `db` to be reachable, runs `pgbackrest stanza-create` once, then loops
   forever doing a full backup every Sunday (UTC) and an incremental backup every other
   day
5. Verify:
   ```bash
   docker compose logs backup      # should show "full backup" or "incremental backup" activity, no errors
   docker compose exec db pgbackrest --stanza=barangay info   # shows the current backup set and its retention
   ```
   The configured bucket should also show WAL segments appearing under
   `<repo1-path>/archive/` continuously, independent of the daily backup cycle.

#### 5b. Restoring from a backup (disaster recovery — test this before you need it)

```bash
docker compose stop db
docker compose run --rm backup pgbackrest --stanza=barangay --delta restore
docker compose start db
```

`--delta` restores only the files that differ from what's already on the volume — faster
than a full restore when the volume isn't a total loss. Point-in-time recovery (restore
to a specific timestamp rather than the latest backup) is `pgbackrest --stanza=barangay
--type=time "--target=2026-01-15 09:00:00" restore` — see the [pgBackRest
docs](https://pgbackrest.org/user-guide.html#pitr) for the full set of recovery targets.

Run this against a scratch volume first to confirm the procedure actually works — an
untested backup is not a backup.

#### 5c. Verify retention

`pgbackrest.conf`'s `repo1-retention-full=4` keeps the last 4 full backups (with this
schedule, about a month) before pruning older ones along with the WAL segments they
depended on. Adjust it if your bucket costs or compliance requirements call for a
different window — see the pgBackRest docs' `retention` options.

### Step 6: Monitoring & Error Tracking

Both of these are optional and free at this scale — the app runs fine without them, but you
won't know something's wrong until a barangay tells you.

#### 6a. Frontend error tracking (Sentry)

1. Create a free account at [sentry.io](https://sentry.io) (5,000 events/month free) and a new
   React project
2. Copy the project's DSN
3. Set `VITE_SENTRY_DSN` in `frontend/.env.production` (and pass it as a build arg if building via
   `docker compose` — already wired into `backend/supabase/docker-compose.yml`'s `frontend`
   service)
4. Rebuild — errors now report to Sentry automatically (`frontend/src/lib/sentry.ts`); leave it
   unset to run without error tracking, nothing else changes

#### 6b. Uptime monitoring

Point a free uptime checker at the health endpoint so you find out about downtime before a
barangay office calls you:

1. Create a free monitor at [UptimeRobot](https://uptimerobot.com) or
   [Better Stack](https://betterstack.com) (both have free tiers)
2. Target URL: `https://records.yourdomain.com/auth/v1/health` (or your LAN/tunnel URL) — GoTrue's
   own health endpoint, reached through Kong; a 401 (missing apikey) still counts as "up" to most
   uptime checkers since they only check for *a* response, but if yours insists on a 2xx, point it
   at `/rest/v1/` instead (PostgREST's root, which answers without an apikey)
3. Check interval: 5 minutes is plenty
4. Point alerts at an email or phone number someone actually checks

### Step 7: Watching scale signals

This platform serves multiple barangays from one shared Postgres database (see
`docs/ARCHITECTURE.md` "Multi-Tenancy"). Postgres scales far better under concurrent
writers than SQLite ever did — this is one of the migration's real, direct benefits, not
just a lateral move — but the risk as more barangays onboard still isn't "does isolation
still work" (that's covered by CI's tenant-isolation job), it's "does the box, and the
pooler in front of it, still keep up." Watch these signals instead of guessing when to
act.

#### 7a. Run the scale-signal monitor periodically

`backend/scripts/check-scale-signals.mjs` checks three things against the database
directly and exits non-zero if any breaches its threshold:

```bash
cd backend
DATABASE_URL=postgres://postgres:your-password@records.yourdomain.com:54322/postgres \
node scripts/check-scale-signals.mjs
```

| Signal | What it means | Default threshold |
|---|---|---|
| Write-statement p95 (pg_stat_statements, normal-distribution approximation) | Proxy for lock contention — rises sharply once concurrent writers start queuing | 500ms |
| Database size growth rate (`pg_database_size()`) | So storage/backup sizing isn't a surprise as tenants add records | 500 MB/day |
| Active connections (`pg_stat_activity`) | Load signal independent of any one service | 150 |

Run it from cron every 15-30 minutes (`... || mail -s "BarangayOS scale alert" you@example.com`),
or manually right after onboarding a new wave of barangays. The `DATABASE_URL` role needs read
access to `pg_stat_statements`/`pg_stat_activity` — the `postgres` superuser role from `.env`
works; consider a dedicated read-only monitoring role (`grant pg_read_all_stats to ...`) instead
of sharing the superuser password with a cron job if this runs somewhere less trusted than the
host itself. Run `select pg_stat_statements_reset();` right after each check for a comparable
per-run write-latency figure — otherwise the reported average keeps blending in older statements.

#### 7b. Load test before each onboarding wave

`backend/scripts/load-test.mjs` seeds a throwaway tenant with `CONCURRENCY` staff users and has
them all hammer writes/reads against it for `DURATION_SECONDS`, reporting latency percentiles —
this simulates the real risk (many staff across many barangays writing at once against the same
shared database), not a single tenant's load. It talks directly to `auth`/`rest` on their own
ports (same Kong-bypassing approach as `scripts/healthcheck.sh` — apikey enforcement is a Kong
concern, not something either service checks itself):

```bash
cd backend
AUTH_URL=http://localhost:9999 REST_URL=http://localhost:3001 \
SERVICE_ROLE_KEY=... \
CONCURRENCY=20 DURATION_SECONDS=30 \
node scripts/load-test.mjs
```

> This is also how a real cross-tenant bug was caught while building the original PocketBase-era
> version of this feature: a database-wide unique index on `household_number` (predating
> multi-tenancy) meant two barangays could never both use the same household number — invisible in
> normal testing, but any load test with more than one active tenant hits it immediately. Fixed
> (now as a Postgres partial/composite unique index scoped to `(barangay_id, household_number)`,
> see `backend/supabase/migrations/0005_households.sql`) before this migration began, and worth
> remembering as a class of bug: any future unique constraint on a tenant-owned table needs
> `barangay_id` in it, not just the field itself.

#### 7c. When a signal trips — decision table

| Signal breached | Likely cause | Action |
|---|---|---|
| Write p95 climbing with tenant count, DB size flat | Lock/IO contention | Check `supavisor`'s pool size and mode first (`POOLER_DEFAULT_POOL_SIZE`/`POOLER_MAX_CLIENT_CONN` in `.env`) — a saturated pool looks identical to real contention; vertically scale the VM next; if that doesn't help, it's time to plan sharding (grouping barangays across multiple Postgres instances) — a bigger change, don't do it speculatively |
| DB growth rate breach | Real data volume growth | Check pgBackRest retention/cost (Step 5c), and storage headroom on the host |
| Connection count breach | More concurrent users than expected, or a connection leak | Check `supavisor`'s own metrics before assuming load — a leak in one service holding connections open looks like organic growth otherwise; vertically scale first if it's genuine; if sustained, reconsider read caching for expensive dashboard aggregate queries |
| Everything fine on Oracle Free Tier's 4 OCPU/24GB | — | No action — you have real headroom left |
| Oracle Free Tier limits actually reached | Genuine growth past free-tier capacity | Move to a paid VPS (Hetzner is the cheapest reliable option, ~€4-6/mo) — this is the point where paying finally has a concrete justification, not before |

---

### Step 8: Passkey sign-in (WebAuthn)

Optional. Lets staff sign in with a fingerprint, face scan, or security key instead of a
password. Neither PocketBase nor GoTrue has native WebAuthn support, so the same sidecar
service as before (`backend/webauthn-service/`) handles the actual attestation/assertion
cryptography using the [`@simplewebauthn/server`](https://simplewebauthn.dev/) library —
it now mints a real session via GoTrue's admin API instead of PocketBase's superuser
impersonate API. It's wired into `backend/supabase/docker-compose.yml` and proxied at
`/api/webauthn/` by nginx — it just needs a few environment variables set:

1. Add to `backend/supabase/.env` (`ANON_KEY`/`SERVICE_ROLE_KEY` are already set from Step
   2a — the webauthn service authenticates as `service_role`, reaching everything else
   through Kong, so there's no separate "dedicated superuser account" step to do here
   unlike the old PocketBase setup):
   ```bash
   WEBAUTHN_RP_ID=records.yourdomain.com      # your real domain, no scheme/port
   WEBAUTHN_RP_NAME=CLUSTR Barangay OS
   WEBAUTHN_ORIGINS=https://records.yourdomain.com
   ```
   `WEBAUTHN_RP_ID` must be a valid domain (or `localhost` for local dev/testing) — passkeys are
   bound to it and won't work if it's wrong or changes later. `WEBAUTHN_ORIGINS` must exactly
   match the origin(s) the app is actually served from (scheme + host + port); comma-separate if
   there's more than one (e.g. a LAN address alongside the tunnel domain).
2. `docker compose up -d --build webauthn` (or just redeploy — it's part of the normal
   `docker compose up -d --build` flow like every other service).
3. Staff can now add a passkey from Settings → Passkeys, and sign in with "Sign in with a
   passkey" on the login screen. Nothing changes for accounts that don't register one — password
   (+ MFA for admins) keeps working exactly as before.

### Multi-factor authentication (MFA)

Admin-role accounts always require a second factor at login — no configuration needed, this
ships on by default (`app.mfa_satisfied()`, see `docs/ARCHITECTURE.md` "Multi-factor
authentication"). Unlike the old PocketBase setup, the second factor is a **TOTP code from an
authenticator app** (Google Authenticator, Authy, 1Password, etc.), not an emailed one-time code
— nothing to configure server-side (no SMTP dependency for MFA itself); each account enrolls its
own authenticator on first login that requires it, scanning a QR code shown by the login flow.

Staff-role MFA is opt-in per barangay (not on by default — it adds real friction to routine daily
logins, so it's a choice each tenant makes rather than a blanket requirement). A platform operator
turns it on for a specific barangay from `/platform-admin` → find the barangay → **Staff MFA**
toggle. Once enabled, every staff login in that barangay requires the same TOTP enrollment/
verification as admins.

### Biometric Step-Up Authentication (CompreFace)

Optional, but a real fail-closed control once enabled (see "What happens if you don't set this
up" below) — a self-hosted [CompreFace](https://github.com/exadel-inc/CompreFace) instance backs
a face-verification step-up that `backend/supabase/functions/login-gate` requires after 3 failed
sign-in attempts on an account, regardless of role (admin/staff/viewer) or whether the *next*
password given is correct.

1. Stand up CompreFace, a separate compose project from `backend/supabase/` (same reasoning as
   Infisical above — it has its own bootstrapping order):
   ```bash
   docker network create compreface_net   # shared with backend/supabase's edge-runtime
   cd backend/compreface
   cp .env.example .env   # fill in POSTGRES_PASSWORD, ADMIN_SECRET
   docker compose up -d
   ```
2. Visit `http://<this host>:8010` (loopback-only by default — reach it via SSH tunnel/VPN for a
   remote host, same as Infisical's admin UI), create an account, an Application, and a
   **Recognition** service inside it.
3. Copy that Recognition service's own API key (not the account/admin login) into
   `backend/supabase/.env`:
   ```bash
   COMPREFACE_URL=http://compreface-api:8080
   COMPREFACE_API_KEY=<the Recognition service's API key>
   COMPREFACE_SIMILARITY_THRESHOLD=0.92
   ```
4. `docker compose up -d --build edge-runtime` (it now joins `compreface_net` alongside its usual
   network — see `backend/supabase/docker-compose.yml`'s `networks:` block).
5. Every account should enroll a face template from Settings → Face Verification *before* it's
   ever needed — onboarding, not an afterthought. An account with no enrolled template that later
   hits the 3-failed-attempt threshold fails closed (soft-locked, HTTP 423) instead of silently
   skipping the check; an admin clears the lock from Settings' "Locked Accounts" panel.

**What happens if you don't set this up:** `COMPREFACE_API_KEY` is left blank by default —
`enroll-face` fails closed (503) for every enrollment attempt, so no account ever has a face
template on file. `login-gate` still counts failed attempts authoritatively either way, so every
account that hits the 3-failed-attempt threshold ends up soft-locked (HTTP 423, "none enrolled")
rather than silently skipping the check — an admin has to clear it from Settings' "Locked Accounts"
panel each time. In other words, leaving this unconfigured turns "3 failed attempts" into a full
lockout for every account, not a bypassed check — deploy CompreFace before real users hit that
threshold, not after.

### Email notifications (document status, hearing scheduled)

Residents with an email on file (`residents.email_address`) get an automatic email when their
document request becomes ready for release or is released, and involved parties get one when a
blotter case is moved to "hearing" status (if their contact field on the case looks like an email
address). Configured via the `SMTP_PASSWORD`/`SMTP_FROM_ADDRESS`/`SMTP_FROM_NAME` variables in
`backend/supabase/.env` (separate from GoTrue's own `SMTP_*` vars used for password-recovery
emails — same mail provider works for both, they're just read by different services) — fails
silently (never blocks the underlying status change) if unset or the resident has no email on
file.

Delivery goes through the `notify-document-status`/`notify-hearing-scheduled` Edge Functions
(`backend/supabase/functions/`), called explicitly by the frontend right after a status update
succeeds — the same "not a database trigger" shape the old PocketBase route used, since Postgres
triggers have no built-in way to send outbound HTTP/SMTP the way Edge Functions do without extra
extensions. Nothing to configure beyond the SMTP vars above — the functions are already part of
the `edge-runtime` container's mounted `functions/` volume.

### Full-text search (Meilisearch)

Fuzzy, typo-tolerant search across residents, document requests, and blotter records — the
dashboard search bar (top of every page) upgrades automatically once this is running; it falls
back to the previous exact/prefix per-table query with zero configuration if it isn't.

**Works out of the box** with `docker compose up -d` — the `meilisearch` container starts
alongside the rest of the stack and runs in "development" mode (no key required) unless you set
`MEILI_MASTER_KEY`. For production, generate one and set `MEILI_ENV=production` alongside it in
`backend/supabase/.env`:

```bash
MEILI_MASTER_KEY=$(openssl rand -hex 32)
MEILI_ENV=production
```

Then, once (per deployment, not per boot — Edge Functions have no equivalent of PocketBase's
"runs on every boot" hook code):

```bash
cd backend
MEILI_URL=http://localhost:7700 MEILI_MASTER_KEY=<the key above> node scripts/setup-search-indexes.mjs
```

**The frontend never talks to Meilisearch directly and never sees a Meilisearch key.** Every
search query and every index write is proxied through the `search-index`/`search-query` Edge
Functions (`backend/supabase/functions/search-index/`, `search-query/`), which force `barangay_id`
from the signed-in session — never from anything the client sends — so tenant isolation for
search can't be bypassed by a modified frontend the way an unenforced client-side filter could be.
Per-role visibility matches the rest of the app too (a `viewer` account can search residents and
blotter records but not the document queue, same as what that role can already see in the UI).
`meilisearch` has no host port published — it's reachable only from `edge-runtime` over the
internal Docker network.

Indexes populate automatically as staff create/edit records — there's no bulk backfill step for a
fresh deployment, since new tenants start with no data anyway. If you're restoring from a backup
or otherwise need to reindex existing records, the simplest path is: restarting `meilisearch`/
`edge-runtime` won't do it (indexing only happens on writes) — re-saving each record once (e.g. a
no-op edit + save) re-triggers indexing, or clear the affected Meilisearch indexes and write a
one-off script against the API modules in `frontend/src/api/searchSync.ts` for a proper bulk
backfill if you're carrying over a large existing dataset.

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

> **How it works:** The `waf` container's image includes a self-signed placeholder certificate so it always starts with HTTPS enabled (port 8443) — `waf`, not `frontend`, terminates TLS since Security Phase 4. For proper PWA install without browser warnings, generate device-trusted certs using `mkcert` — the real certs silently override the placeholder via a Docker volume mount.

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

### Step 2: Place the certs

`backend/supabase/docker-compose.yml`'s `waf` service already mounts `../certs` (i.e.
`backend/certs/`) to `/etc/caddy/certs` — no compose edit needed. Just make sure
`generate-certs.ps1` wrote its output to `backend/certs/`.

### Step 3: Rebuild and restart

```powershell
cd backend/supabase
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
                        │   waf (docker)        │
                        │   :80  (HTTP)        │
                        │   :443 (HTTPS, mkcert)│
                        │   Coraza/OWASP CRS    │
                        └──────────┬──────────┘
                                   │
                        ┌──────────┴──────────┐
                        │   nginx (internal)    │
                        └──────────┬──────────┘
                                   │ /rest/v1, /auth/v1, /realtime/v1, /functions/v1
                        ┌──────────┴──────────┐
                        │   kong (port 8000)   │
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
docker compose logs frontend
docker compose logs db
docker compose logs auth
docker compose logs rest
docker compose logs kong

# Follow logs in real-time
docker compose logs -f
```

### Restart containers

```bash
docker compose restart frontend  # Restart nginx only
docker compose restart auth      # Restart GoTrue only
docker compose restart           # Restart all
```

### Rebuild and restart

```bash
docker compose up -d --build
```

### Check container status

```bash
docker compose ps    # every service should show "healthy" — see each one's healthcheck in docker-compose.yml
```

### Login shows "Something went wrong"

- Open DevTools → Network tab → check which URL the POST request goes to
- If it's the tunnel URL but you're on LAN, the local IP in `.env.production` might be wrong
- Run `ipconfig` (Windows) or `ip a` (Linux) on the server, check the IPv4 address, and update `VITE_LOCAL_API_URL`
- Check `docker compose logs auth` for the actual GoTrue error (invalid credentials, MFA required, disabled signup, etc.)

### Tunnel returns 503

- Check cloudflared is running: `Get-Service cloudflared` (Windows) or `systemctl status cloudflared` (Linux)
- Check the tunnel status in the Cloudflare dashboard
- Verify `config.yml` has the correct tunnel UUID and hostname, pointing to `localhost:8080`
- Make sure Docker containers are running: `docker compose ps`

### Build succeeds but changes don't appear

- Hard-refresh the browser (Ctrl+Shift+R) to bypass cache
- Verify the new container image was built: `docker compose up -d --build`
- Check that nginx is serving the updated `dist/` files

### A service won't come up healthy

- `docker compose logs <service>` — `auth`/`rest`/`realtime` all fail fast and log a clear reason
  if they can't reach `db`, or if `JWT_SECRET`/`ANON_KEY`/`SERVICE_ROLE_KEY` don't agree (they're
  all derived from the same `JWT_SECRET` via `generate-supabase-keys.mjs` — regenerating one
  without the others is the most common cause of a confusing 401 everywhere)
- `docker compose logs db` — if migrations failed partway on first boot, the `db_data` volume may
  be in a half-migrated state; for a throwaway/dev volume, `docker compose down -v` and re-run
  Step 2 is the fastest fix (never do this against a volume holding real tenant data — back it up
  first, see Step 5)
- `edge-runtime` failing to load a specific function: check `docker compose logs edge-runtime` —
  it logs the function name and the underlying Deno error

---

## Quick Reference

### Build and deploy

```bash
cd backend/supabase && docker compose up -d --build
```

`frontend/.env.production`'s `VITE_SUPABASE_ANON_KEY`/`VITE_API_URL` and
`backend/supabase/.env`'s secrets (Step 2a) must already be in place — there is no
separate encryption-key step the way PocketBase's `PB_ENCRYPTION_KEY` was; `JWT_SECRET`
is this stack's equivalent root secret and only needs setting once, at first boot.

### Deploy via Git push (self-hosted runner)

```bash
git add .
git commit -m "feat: add my changes"
git push origin main
```

### Check server health

```bash
curl http://localhost:9999/health                       # GoTrue, direct (bypasses Kong's apikey requirement)
curl -H "apikey: $ANON_KEY" http://localhost:8000/rest/v1/  # PostgREST, through Kong
```

### Generate LAN HTTPS certificates

```powershell
.\scripts\generate-certs.ps1
```

`backend/supabase/docker-compose.yml`'s `frontend` service already mounts
`backend/certs/` — just rebuild after generating certs:

```bash
cd backend/supabase && docker compose up -d --build
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
