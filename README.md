<div align="center">
  <h1>BarangayOS</h1>
  <p align="center">
    <strong>A modern document and records management system for Philippine Barangay LGUs</strong>
  </p>
  <p align="center">
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-Proprietary-red.svg" alt="License: Proprietary"></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB" alt="React 19"></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-6-3178C6" alt="TypeScript 6"></a>
    <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-8-646CFF" alt="Vite 8"></a>
    <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-self--hosted-3ECF8E" alt="Self-hosted Supabase"></a>
    <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-15-336791" alt="PostgreSQL 15"></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4" alt="Tailwind CSS 4"></a>
    <br>
    <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-compose-2496ED" alt="Docker"></a>
    <a href="https://github.com/rodneydelacruz/barangayos/actions"><img src="https://img.shields.io/github/actions/workflow/status/rodneydelacruz/barangayos/ci.yml?branch=main&label=CI" alt="CI"></a>
    <a href="https://github.com/rodneydelacruz/barangayos/issues"><img src="https://img.shields.io/github/issues/rodneydelacruz/barangayos" alt="Issues"></a>
  </p>

</div>

---

## About

BarangayOS is a comprehensive, offline-capable web application purpose-built for **Philippine Barangay Local Government Units (LGUs)**. It replaces paper-based record keeping with a modern, digital system that works even when the internet is unreliable.

**The problem:** Most barangay offices still rely on paper records, standalone Excel files, or expensive proprietary software. Internet connectivity in many areas is intermittent. BarangayOS is a licensed, commercially supported platform that works offline and syncs when connectivity is available.

### Who is this for?

- **Barangay Secretaries & Staff** — Manage residents, documents, blotter cases, and daily operations
- **Barangay Captains & Councilors** — Access reports, approve documents, track finances
- **IT Administrators** — Deploy, configure, and maintain the system

## Features

### Records & Document Management

| Feature | Description |
|---------|-------------|
| **Resident Management** | Complete resident profiles with demographics, tags (voter, senior, PWD, 4Ps, deceased), and family associations |
| **Household Management** | Track families, household heads, and resident groupings |
| **Document Request & Release** | End-to-end document lifecycle — request, processing, and release tracking |
| **Blotter / Incident Records** | Complaint tracking with hearing, settlement, and escalation workflow |

### Governance & Operations

| Feature | Description |
|---------|-------------|
| **Barangay Assets** | Inventory management with condition and status tracking |
| **Calendar & Agenda** | Meeting scheduling, agenda items, session management, and resolution tracking |
| **Visitor Log** | Digital visitor check-in/out with timestamps |
| **Activity Logs** | Comprehensive audit trail of all system actions |

### Finance Module

| Feature | Description |
|---------|-------------|
| **Budget Appropriations** | Track appropriations by expense class (PS/MOOE/CO) |
| **Fund Sources** | Manage fund sources with statutory rules (20% DF, SK, etc.) |
| **Revenue Tracking** | Record and track revenue collections linked to income accounts |
| **Disbursements & Obligations** | Full obligation and disbursement workflow |
| **Finance Audit Trail** | Dedicated audit log for every financial transaction with user attribution |

### Platform Capabilities

| Feature | Description |
|---------|-------------|
| **Offline Mode** | IndexedDB write queue — queues data when connection drops, auto-flushes on reconnect |
| **Role-Based Access** | Admin, Staff, and Viewer roles with granular, server-enforced permissions |
| **Dark Mode** | Light/dark theme toggle with automatic system preference detection |
| **Cloudflare Tunnel** | Secure public access without opening firewall ports |
| **Database Backup** | Automatic backups to S3-compatible storage (Cloudflare R2) via admin UI |
| **PWA Installable** | Desktop/mobile app install with sidebar button; works on HTTPS (LAN with mkcert or Cloudflare Tunnel) |
| **Reports Dashboard** | Aggregated statistics and data visualization with interactive charts |
| **Smart URL Resolution** | Automatic API URL selection based on network environment |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | [React 19](https://react.dev/), [TypeScript 6](https://www.typescriptlang.org/), [Vite 8](https://vite.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [Lucide Icons](https://lucide.dev/) |
| **Backend** | Self-hosted [Supabase](https://supabase.com/) — PostgreSQL 15, GoTrue (auth), PostgREST (REST API), Realtime, Edge Functions, Kong (gateway) |
| **Auth** | Email/password via GoTrue with role-based authorization (admin/staff/viewer), enforced server-side by Postgres Row-Level Security; TOTP MFA and WebAuthn/passkey sign-in |
| **Data Tables** | [@tanstack/react-table](https://tanstack.com/table) |
| **Charts** | [Recharts](https://recharts.org/) |
| **Offline** | IndexedDB via [`idb`](https://github.com/jakearchibald/idb) library |
| **Testing** | [Vitest 3](https://vitest.dev/) (unit), [Playwright](https://playwright.dev/) (E2E) |
| **Linting** | [oxlint](https://oxc.rs/) with React + TypeScript plugins |
| **Infrastructure** | [Docker](https://www.docker.com/), [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/), [GitHub Actions](https://github.com/features/actions) |

## Quick Start

### Prerequisites

- Node.js 20+ (required by Vite 8)
- npm 10+
- Git
- Docker (only if you want the real backend running locally — see below)

### Setup — instant, no backend

The fastest way to explore the app is demo mode: a fully client-side backend
(localStorage, no server) built into the login page itself.

```bash
git clone https://github.com/rodneydelacruz/barangayos.git
cd barangayos/frontend
npm install
npm run dev
```

Open **http://localhost:5173**, and click any of the "Try instantly" demo
accounts on the login page — no `.env`, no Docker, nothing to configure.

### Setup — with the real backend

The real backend is a self-hosted Supabase stack (Postgres, GoTrue, PostgREST,
Realtime, Edge Functions, Kong) defined in `backend/supabase/docker-compose.yml`:

```bash
cd backend/supabase
cp .env.example .env               # fill in POSTGRES_PASSWORD / JWT_SECRET
node ../scripts/generate-supabase-keys.mjs   # fills in ANON_KEY / SERVICE_ROLE_KEY
docker compose up -d
node ../scripts/bootstrap-platform-admin.mjs # creates the first platform admin
```

See the [Development Guide](docs/DEVELOPMENT.md) and [Deployment Guide](docs/DEPLOYMENT.md)
for detailed setup, MFA enrollment, and production deployment instructions.

## Project Structure

```
barangayos/
├── frontend/                  # React SPA
│   ├── src/                   # Application source
│   │   ├── api/               # 26 API client modules (real backend via @supabase/supabase-js, demo-mode branch via mockPocketBase.ts)
│   │   ├── auth/              # Authentication, session, route guards
│   │   ├── components/ui/     # 30+ shared UI components
│   │   ├── features/          # 12 domain feature modules
│   │   ├── lib/               # Utilities, helpers, config
│   │   ├── offline/           # IndexedDB queue, sync manager, indicator
│   │   ├── pages/             # Page-level components
│   │   └── routes/            # Route definitions
│   ├── public/                # Static assets (manifest, icons, service worker)
│   ├── e2e/                   # Playwright E2E tests (demo mode — no backend needed)
│   ├── Dockerfile             # Multi-stage production build
│   ├── nginx-entrypoint.sh    # Startup that copies placeholder TLS certs
│   ├── nginx.conf             # Nginx config, proxies /rest,/auth,/realtime,/functions to Kong
│   └── package.json           # Frontend dependencies
├── backend/                   # Self-hosted Supabase backend
│   ├── supabase/               # Postgres, GoTrue, PostgREST, Realtime, Edge Functions, Kong
│   │   ├── migrations/         # SQL schema + Row-Level Security policies
│   │   ├── functions/          # Edge Functions (Deno)
│   │   ├── backup/             # pgBackRest continuous-backup config
│   │   └── docker-compose.yml  # The full stack
│   ├── scripts/                 # bootstrap-platform-admin.mjs, load-test.mjs, test-tenant-isolation.mjs, ...
│   └── webauthn-service/        # Passkey/WebAuthn sidecar
├── scripts/                   # Deploy and utility scripts
│   ├── deploy.ps1             # Build frontend
│   ├── deploy-prod.ps1        # Production deploy from GitHub artifact
│   ├── generate-certs.ps1       # Generate mkcert certs for LAN HTTPS
│   ├── generate-icons.cjs       # Generate square PWA icons from logo
│   └── healthcheck.sh         # Backend health check (GoTrue)
├── docs/                      # Documentation
│   ├── ARCHITECTURE.md        # System design and data flow
│   ├── DEVELOPMENT.md         # Local setup and coding standards
│   ├── DEPLOYMENT.md          # Production deployment guide
│   ├── CONTRIBUTING.md        # Engineering contribution workflow
│   └── SECURITY.md            # Security policy
├── .github/                   # GitHub workflow/PR files
│   ├── workflows/ci.yml       # CI pipeline
│   ├── ISSUE_TEMPLATE/        # Bug report and feature request templates
│   └── PULL_REQUEST_TEMPLATE.md
├── CHANGELOG.md               # Version history
├── CODE_OF_CONDUCT.md         # Team conduct standards
└── LICENSE                    # Proprietary license
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture Guide](docs/ARCHITECTURE.md) | System design, data flow, smart URL resolution, offline architecture |
| [Development Guide](docs/DEVELOPMENT.md) | Local setup, coding standards, testing, building |
| [Deployment Guide](docs/DEPLOYMENT.md) | Production deployment with Docker, Cloudflare Tunnel, and more |
| [Contributing Guide](docs/CONTRIBUTING.md) | Engineering workflow, code style, PR process |
| [Security Policy](docs/SECURITY.md) | Reporting vulnerabilities, security best practices |
| [Privacy Notice](docs/PRIVACY_NOTICE.md) | Data privacy notice for residents under RA 10173 |
| [Terms of Use](docs/TERMS_OF_USE.md) | Acceptable use policy for Barangay staff |
| [Data Processing Agreement](docs/DATA_PROCESSING_AGREEMENT.md) | DPA template for deployers and processors |
| [Changelog](CHANGELOG.md) | Version history and release notes |

## Testing

```bash
# Unit tests (Vitest)
cd frontend && npm run test

# With coverage
npm run test:coverage

# E2E tests (Playwright)
npx playwright test

# CI verification (what runs in GitHub Actions)
npm run lint
npx tsc -b
npm run test
npm run build
```

## Roadmap

- [x] Core record management (residents, households, documents)
- [x] Blotter / incident tracking with case workflow
- [x] Finance module (appropriations, revenues, disbursements)
- [x] Offline mode with automatic sync
- [x] Role-based access control
- [x] Docker deployment with Cloudflare Tunnel
- [ ] API documentation (OpenAPI / Swagger)
- [ ] Mobile app (wrapping the web app)
- [ ] Multi-barangay / centralized deployment
- [ ] SMS notifications for document releases
- [ ] Electronic signatures
- [ ] Integration with Philippine government systems (PSA, DILG)

> Suggest and vote on features via [GitHub Issues](https://github.com/rodneydelacruz/barangayos/issues/new?template=feature_request.md).

## Support

This is commercially licensed software. For bug reports, feature requests, or account/licensing
questions, contact your CLUSTR account representative.

## License

CLUSTR is proprietary software, licensed under a paid subscription — see the [LICENSE](LICENSE)
file for details. It is not open source and may not be copied, redistributed, or self-hosted
outside the terms of a signed license agreement.

## Acknowledgments

- Built for every Barangay in the Philippines
- [Supabase](https://supabase.com/) — the open-source backend platform this project self-hosts (Supabase's own license, not CLUSTR's)
- [Cloudflare](https://www.cloudflare.com/) — for their generous free-tier tunnel and R2 services
- All barangay secretaries and staff who provided invaluable domain expertise

---

<p align="center">
  <sub>Made for every Barangay in the Philippines</sub>
</p>
