# Development Guide

## Prerequisites

- **Node.js** 20+ (required for Vite 8)
- **npm** 10+
- **Git**
- **Docker Desktop** — only needed if you want the real backend running locally; demo mode (see below) needs nothing but Node

## Initial Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USER/barangayos.git
cd barangayos

# Install JavaScript dependencies
cd frontend && npm install

# Set up environment variables
cp .env.local.example frontend/.env.local
```

### Environment Variables

Create `frontend/.env.local` with the following:

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=
VITE_LOCAL_API_URL=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | **Yes** (real backend only) | — | Kong gateway URL. In dev: `http://localhost:8000`. In production: the Cloudflare Tunnel URL. |
| `VITE_SUPABASE_ANON_KEY` | **Yes** (real backend only) | — | The `ANON_KEY` printed by `node backend/scripts/generate-supabase-keys.mjs`. |
| `VITE_LOCAL_API_URL` | No | — | LAN IP for local network access in production (e.g., `http://192.168.1.100:8080`). Leave empty in dev. |
| `VITE_CLOUDINARY_CLOUD_NAME` | No | — | Cloudinary cloud name for image uploads. Leave empty if not using image upload. |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | No | — | Cloudinary unsigned upload preset. Leave empty if not using image upload. |

> **Note:** `*.local` files are gitignored and never committed. None of the above is needed for demo mode — see below.

## Running Locally

### Fastest: demo mode, no backend

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`, and click a "Try instantly" demo account on the
login page. Everything runs in this browser's localStorage — no `.env`, no
Docker, nothing to configure. This is the fastest way to work on UI-only
changes.

### With the real backend

#### Terminal 1: Start the Supabase stack

```bash
# From the project root
cd backend/supabase
cp .env.example .env                          # fill in POSTGRES_PASSWORD / JWT_SECRET
node ../scripts/generate-supabase-keys.mjs .env   # fills in ANON_KEY / SERVICE_ROLE_KEY
docker compose up -d
node ../scripts/bootstrap-platform-admin.mjs   # creates the first platform admin
```

This starts, among others:
- Postgres on `127.0.0.1:54322`, with every migration in `backend/supabase/migrations/` applied automatically on first boot
- GoTrue (auth) on `127.0.0.1:9999`
- PostgREST (REST API) on `127.0.0.1:3001`
- Kong (the public gateway everything above is really reached through) on `8000`

#### Terminal 2: Start the Vite dev server

```bash
cd frontend
# .env.local needs VITE_API_URL=http://localhost:8000 and
# VITE_SUPABASE_ANON_KEY set to bootstrap-platform-admin.mjs's printed ANON_KEY
npm run dev
```

Open `http://localhost:5173` and sign in with the platform admin account the
bootstrap script created. Role `admin` always requires MFA — see the
script's own printed next-steps for enrolling a TOTP factor before its first
login will see any data (this is `app.mfa_satisfied()` in
`backend/supabase/migrations/0000_auth_helpers.sql` working as designed, not
a bug).

## Running with Docker (Production Simulation)

```bash
# From the project root
cd frontend && npm run build
cd ../backend/supabase
docker compose up -d --build
```

- Frontend: http://localhost:8080
- Kong gateway: http://localhost:8000

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full production setup, including secret
generation, pgBackRest continuous backups, and Cloudflare Tunnel.

## Available Scripts

All commands run from the `frontend/` directory:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 5173 with HMR |
| `npm run build` | TypeScript type check + production build to `frontend/dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run all tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with HTML coverage report |
| `npm run lint` | Run oxlint on the entire codebase |

## Project Structure

```
barangayos/
├── frontend/                  # React SPA
│   ├── src/                   # Application source
│   │   ├── api/               # 26 API client modules (real backend via @supabase/supabase-js, demo-mode branch via mockPocketBase.ts)
│   │   ├── auth/              # Authentication, session, route guards
│   │   ├── components/ui/     # 30+ reusable UI components
│   │   ├── features/          # 12 domain feature modules
│   │   ├── lib/               # Utilities, helpers, config
│   │   ├── offline/           # IndexedDB queue, sync manager, indicator
│   │   ├── pages/             # Page-level components
│   │   └── routes/            # Route definitions
│   ├── e2e/                   # Playwright E2E tests (demo mode — no backend needed)
│   ├── public/                # Static assets
│   ├── nginx-entrypoint.sh    # Startup that copies placeholder TLS certs
│   ├── nginx.conf             # Nginx config, proxies /rest,/auth,/realtime,/functions to Kong
│   ├── Dockerfile             # Multi-stage Docker build
│   └── package.json           # Frontend dependencies
├── backend/                   # Self-hosted Supabase backend
│   ├── supabase/               # Postgres, GoTrue, PostgREST, Realtime, Edge Functions, Kong
│   │   ├── migrations/         # SQL schema + Row-Level Security policies
│   │   ├── functions/          # Edge Functions (Deno)
│   │   └── docker-compose.yml  # The full stack
│   ├── scripts/                 # bootstrap-platform-admin.mjs, load-test.mjs, test-tenant-isolation.mjs, ...
│   └── webauthn-service/        # Passkey/WebAuthn sidecar
├── scripts/                   # Utility scripts
│   ├── deploy.ps1             # Build frontend
│   ├── deploy-prod.ps1        # Production deploy from GitHub artifact
│   ├── generate-certs.ps1       # Generate mkcert certs for LAN HTTPS
│   ├── generate-icons.cjs       # Generate square PWA icons from logo
│   └── healthcheck.sh         # Backend health check (GoTrue)
└── docs/                      # Documentation
    ├── ARCHITECTURE.md        # System design and data flow
    ├── DEVELOPMENT.md         # This guide
    ├── DEPLOYMENT.md          # Production deployment
    ├── CONTRIBUTING.md        # How to contribute
    └── SECURITY.md            # Security policy
```

## Coding Standards

### TypeScript

- Strict mode enabled (`strict: true` in `tsconfig.app.json`)
- `noUnusedLocals` and `noUnusedParameters` are enabled — catch unused code at compile time
- Prefer explicit return types on function declarations for readability
- Use `import type` for type-only imports to avoid bundler issues

### React

- Functional components with hooks only (no class components)
- Props interfaces defined with `interface` keyword, not `type`
- File naming: PascalCase for components, camelCase for utilities and hooks
- One component per file (except small related utility collections)
- Custom hooks prefixed with `use` (e.g., `useApiHealth`)

### CSS / Tailwind

- Tailwind CSS v4 with `@import "tailwindcss"` syntax (no `@tailwind` directives)
- Custom theme colors defined in `src/index.css` via `@theme` directive
- Motion utilities available: `motion-fade-in`, `motion-slide-up`, etc.
- Dark mode via `.dark` class on `<html>` element (managed by `ThemeProvider`)

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files (utilities) | camelCase | `apiConfig.ts`, `formatDate.ts` |
| Files (components) | PascalCase | `LoginPage.tsx`, `Sidebar.tsx` |
| Functions | camelCase | `getApiUrl()`, `formatDate()` |
| Components | PascalCase | `ThemeProvider`, `ProtectedRoute` |
| Types / Interfaces | PascalCase | `AuthUser`, `HealthStatus` |
| Environment variables | UPPER_SNAKE | `VITE_API_URL`, `VITE_LOCAL_API_URL` |

## Testing

Tests use [Vitest 3](https://vitest.dev/) with jsdom environment. Test files should be placed alongside the code they test with `.test.ts` or `.test.tsx` extension.

### Running tests

```bash
# Run all tests
npm run test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage (outputs to frontend/coverage/)
npm run test:coverage
```

### Writing tests

Test files use Vitest's global API (`describe`, `it`, `expect` are globally available — no imports needed):

```typescript
// Example: src/lib/__tests__/utils.test.ts
import { formatDate } from '../utils'

describe('formatDate', () => {
  it('returns formatted date string for valid input', () => {
    expect(formatDate('2024-01-15 10:00:00')).toContain('Jan')
  })

  it('returns empty string for null input', () => {
    expect(formatDate(null)).toBe('')
  })

  it('handles edge case timestamp', () => {
    expect(formatDate('2024-12-31 23:59:59')).toContain('Dec')
  })
})
```

For React component tests:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  it('renders and responds to user interaction', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)

    const button = screen.getByRole('button', { name: /submit/i })
    await user.click(button)

    expect(screen.getByText(/success/i)).toBeInTheDocument()
  })
})
```

> **Configuration:** Vitest is configured with `globals: true` in `vitest.config.ts` — global test functions (`describe`, `it`, `expect`) are available without imports. jsdom provides browser-like DOM APIs in the test environment.

### E2E Testing

E2E tests use [Playwright](https://playwright.dev/). Tests are in `frontend/e2e/`:

```bash
# Install Playwright browsers (first time only)
npx playwright install --with-deps chromium

# Run E2E tests
npx playwright test

# Run with UI mode (interactive)
npx playwright test --ui
```

## Linting

```bash
npm run lint
```

Uses [oxlint](https://oxc.rs/) with React and TypeScript plugins. Configuration is in `.oxlintrc.json` at the project root.

To automatically fix fixable issues:

```bash
npx oxlint --fix
```

## Building for Production

```bash
# 1. TypeScript check + Vite production build
cd frontend && npm run build

# 2. Output is in frontend/dist/ — static files ready for nginx

# 3. Deploy with Docker
cd ../backend/supabase && docker compose up -d --build
```

> See [DEPLOYMENT.md](DEPLOYMENT.md) for complete production deployment instructions, including Cloudflare Tunnel setup and database backup configuration.

## Troubleshooting

### A backend service won't come up healthy

- **Port already in use**: Check nothing else is bound to `54322` (Postgres), `9999` (auth), `3001` (rest), or `8000` (Kong).
- **`docker compose ps` shows "unhealthy"**: `docker compose logs <service>` — most first-boot failures are a missing `.env` value (`POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`/`SERVICE_ROLE_KEY` — see `backend/supabase/.env.example`).
- **Migration errors**: `docker compose down -v` (removes the `db_data` volume) and `docker compose up -d db` again to re-run every migration in `backend/supabase/migrations/` from scratch.

### Vite dev server won't start

- **Node.js version**: Verify you're on Node.js 20+ with `node --version`. Vite 8 requires Node 20+.
- **Missing node_modules**: Run `npm install` in `frontend/`.
- **Port conflict**: Vite defaults to port 5173. Change it in `vite.config.ts` if needed.

### Tests fail

- **No tests found**: Ensure test files end in `.test.ts` or `.test.tsx` and are inside `frontend/src/`.
- **Type errors**: Run `npx tsc -b` to check for TypeScript issues separately.

### Build fails

- **TypeScript errors**: Run `npx tsc -b` to see all type errors. Fix them before building.
- **Out of memory**: Add `--max-old-space-size=4096` to the build command: `NODE_OPTIONS="--max-old-space-size=4096" npm run build`

### Login always fails (real backend)

- `auth`/`rest`/`kong` must all be up and healthy — `docker compose ps` from `backend/supabase/`.
- Verify `VITE_API_URL` in `.env.local` is Kong's gateway (`http://localhost:8000`) and `VITE_SUPABASE_ANON_KEY` matches the `ANON_KEY` `generate-supabase-keys.mjs` printed.
- `role=admin` accounts always require MFA (`app.mfa_satisfied()`) — a brand-new platform admin will see zero data until it enrolls a TOTP factor; see `bootstrap-platform-admin.mjs`'s printed next-steps.
- Not troubleshooting the real backend at all? Demo mode (the "Try instantly" buttons on the login page) needs none of the above.
