# Architecture Guide

## System Overview

CLUSTR (BarangayOS) is a **multi-tenant** platform — one shared Docker stack serves every onboarded barangay, with tenant isolation enforced server-side by PocketBase API rules (see [Multi-Tenancy](#multi-tenancy) below). The stack is four containers: **nginx** (SPA + reverse proxy), **PocketBase** (REST API, SQLite), **webauthn** (passkey sidecar), and **litestream** (continuous backup). A Cloudflare Tunnel provides secure public internet access through the nginx container.

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
                     │  rate limiting       │
                     └───┬──────────────┬───┘
                    /api/│              │/api/webauthn/
                     ┌───┴────────┐ ┌───┴──────────┐
                     │ PocketBase │ │  webauthn     │
                     │  (8090)    │ │  sidecar      │
                     │ pb_data/   │ │  (8091)       │
                     └─────┬──────┘ └──────────────┘
                           │ WAL stream
                     ┌─────┴──────┐
                     │ litestream │──→ S3-compatible bucket
                     └────────────┘

LAN Users: http://192.168.x.x:8080 or https://192.168.x.x:8443 (HTTPS with mkcert for PWA)
Remote:    https://app.yourdomain.com (via Cloudflare Tunnel → nginx, HTTPS)
Direct:    http://192.168.x.x:8090 (PocketBase admin UI, LAN only)
```

The nginx container serves the SPA and proxies `/api/*` (with separate, tighter rate limits on auth endpoints) to PocketBase, `/api/webauthn/*` to the WebAuthn sidecar, and `/_/*` to the PocketBase admin UI. The Cloudflare Tunnel exposes `localhost:8080` (nginx) to the internet. PocketBase port 8090 remains accessible on the LAN for direct admin access. See `docs/DEPLOYMENT.md` for the full hosting/scaling guide.

## Multi-Tenancy

One shared PocketBase instance serves every barangay. Every tenant-owned collection carries a `barangay_id` relation field (added in `backend/pb_migrations/1785000027_multi_tenant_barangays.js` onward), and every collection's list/view/create/update/delete rule is compounded with a `barangay_id = @request.auth.barangay_id` check — enforced server-side by PocketBase as a SQL `WHERE` clause, not by client-side filtering. A `beforeSend` hook on the frontend PocketBase client (`frontend/src/api/client.ts`) auto-stamps every record-create request with the logged-in user's own `barangay_id`, so none of the 20+ API modules need to set it manually.

New tenants are provisioned through the `/platform-admin` console (`frontend/src/pages/PlatformAdmin.tsx`, `frontend/src/api/platformAdmin.ts`), gated to a platform-admin flag rather than the regular per-tenant `admin` role — a barangay's own admin can never see or manage another barangay's data or users. Tenant isolation is verified in CI: `.github/workflows/ci.yml`'s `tenant-isolation` job spins up a real PocketBase instance and runs `backend/scripts/test-tenant-isolation.mjs`, which asserts that a session authenticated as tenant A gets zero rows back when listing tenant B's data.

## Smart URL Resolution

The app automatically selects the optimal API URL based on the client's network environment. This logic lives in `frontend/src/lib/apiConfig.ts`.

| Scenario | Resolution |
|----------|-----------|
| Vite dev server (`localhost:8080`) | Uses `VITE_API_URL` directly |
| Phone on cellular (HTTPS via tunnel) | Uses tunnel URL (mixed-content blocked otherwise) |
| Desktop on office LAN (HTTP) | Pings server's LAN IP with 3s timeout, uses it if reachable |
| Remote desktop (HTTP, different network) | LAN ping times out, falls back to tunnel URL |

### Resolution algorithm

1. If `VITE_LOCAL_API_URL` is empty (dev mode), use `VITE_API_URL` directly
2. If the page was loaded over HTTPS, skip local fallback entirely (browsers block HTTPS to HTTP requests)
3. If the page is HTTP, probe `VITE_LOCAL_API_URL/api/health` with a 3-second timeout
4. If the local server responds, use the LAN URL for zero-latency, offline-capable access
5. If the local server is unreachable, fall back to the tunnel URL

This ensures that users inside the barangay office connect directly to the local server (fast, works offline), while remote users always use the secure tunnel URL.

## Offline Architecture

The offline system uses IndexedDB as a persistent write queue. This allows users to continue working even when the network connection drops — critical for barangay offices with intermittent internet.

```
User Action → try API call → success → done
                           → failure → enqueue to IndexedDB
                                     → connection restored → flush queue → done
```

### Components

- **`frontend/src/offline/queue.ts`** — IndexedDB wrapper using the `idb` library. Provides `enqueue()`, `dequeue()`, `peekAll()`, and `queueSize()` operations. Stores pending create/update/delete operations with their payloads and timestamps. Each item stores the API module, method name, and serialized arguments.

- **`frontend/src/offline/syncManager.ts`** — Flushes the queue when the connection is restored. Processes items FIFO (first-in, first-out) with status notifications via a listener pattern. Emits `idle`, `syncing`, `error`, or `complete` status updates. On error, failed items are kept in the queue for retry.

- **`frontend/src/offline/OfflineIndicator.tsx`** — UI component that displays the current sync status to the user. Shows a banner indicating offline mode, syncing progress, or confirmation when all queued operations complete.

## Authentication & Authorization

PocketBase handles authentication via email/password or passkey. The app uses role-based access control with three roles, enforced server-side by PocketBase's collection-level rules, on top of the tenant (`barangay_id`) scoping described above.

| Role | Permissions |
|------|------------|
| **Admin** | Full CRUD on all collections, user management, system settings — within their own tenant |
| **Staff** | Create/update records, documents, residents; limited delete |
| **Viewer** | Read-only access to most collections |

A separate platform-admin flag (independent of the three tenant roles above) gates the `/platform-admin` console for onboarding new barangays.

### Auth flow

1. User submits email/password (or completes a passkey ceremony — see below) via `login()`
2. Server validates credentials and returns an auth token
3. Token is stored in PocketBase's `authStore` (persisted to localStorage under `pocketbase_auth`; the SDK's `LocalAuthStore` writes to localStorage for session persistence across page loads)
4. If the account's role requires MFA (see below), PocketBase issues a partial MFA token instead of a full session; the user completes an emailed one-time code before a real session is minted
5. `getCurrentUser()` extracts role, `barangay_id`, and user data from the auth record
6. Route guards (`ProtectedRoute`) check authentication status, user role, and (for `/platform-admin`) the platform-admin flag before rendering protected pages
7. On session expiry, the user is redirected to the login page

### Multi-factor authentication (MFA)

Configured declaratively in `backend/pb_migrations/1785000029_admin_mfa.js` via PocketBase's built-in MFA support (`usersColl.mfa`) — a second factor (password + emailed one-time code, 10-minute window) is required by rule, not by frontend logic, so it can't be bypassed by calling the API directly.

### Passkeys (WebAuthn)

PocketBase has no native WebAuthn support, so the `webauthn` sidecar (`backend/webauthn-service/server.mjs`, Node + `@simplewebauthn/server`) owns the attestation/assertion cryptography. On successful verification it mints a real PocketBase session via the superuser impersonate API. Credentials are stored in the `webauthn_credentials` collection (`backend/pb_migrations/1785000032_webauthn_credentials.js`). Client-side ceremony helpers live in `frontend/src/auth/LoginPage.tsx` via `@simplewebauthn/browser`; users manage their registered passkeys from Settings.

### Server-side rules

Collection-level access rules are defined in PocketBase migration files at `backend/pb_migrations/`. These are JavaScript files that PocketBase executes on startup to configure collections and their access rules. Rules combine role checks with tenant scoping:

```javascript
// Staff can create and update within their own tenant, but not delete
"createRule": "@request.body.barangay_id = @request.auth.barangay_id && (@request.auth.role = \"admin\" || @request.auth.role = \"staff\")",
"updateRule": "barangay_id = @request.auth.barangay_id && (@request.auth.role = \"admin\" || @request.auth.role = \"staff\")",
"deleteRule": "barangay_id = @request.auth.barangay_id && @request.auth.role = \"admin\""
```

## State Management

No external state management library (Redux, Zustand, etc.) is used. The app relies entirely on React built-in features:

- **React built-in state** — `useState`, `useEffect`, `useContext` for component-level and shared state
- **PocketBase SDK client** — Singleton client (`frontend/src/api/client.ts`) as the single source of truth for authentication state. The `authStore` on the PocketBase client holds the current auth token and user data.
- **React Context providers** — `LanguageProvider` (`frontend/src/lib/i18n/`) for the EN/Tagalog/Cebuano UI language, `ThemeProvider` (`frontend/src/lib/theme.tsx`) for light/dark mode
- **Custom hooks** — `useApiHealth()` for periodic server health polling (every 30 seconds), and feature-specific custom hooks for domain logic

This approach keeps the bundle size small and avoids unnecessary complexity. If your feature requires shared state across many components, consider React Context before reaching for an external library.

## Internationalization (i18n)

A lightweight, dependency-free i18n system (no `react-i18next`) lives in `frontend/src/lib/i18n/`: a flat `Record<TranslationKey, string>` dictionary per language (`translations.ts`), a `LanguageProvider` context that persists the selection to `localStorage`, and a `useTranslation()` hook exposing `{ language, setLanguage, t }`. Supported languages: English, Tagalog, Bisaya/Cebuano. `LanguageSwitcher` (`frontend/src/components/LanguageSwitcher.tsx`) renders as a compact cycling button (sidebar footer) or a full segmented control (Settings, login page).

## Code Splitting

Feature routes are lazy-loaded via `React.lazy()` in `frontend/src/routes/index.tsx`, with a single `Suspense` boundary around the `<Outlet />` in `frontend/src/components/Layout.tsx` so the sidebar/chrome stays mounted while a page chunk loads. This keeps a viewer-role user's first load from paying for finance, reports, and admin-only code they'll never execute. `exceljs` (used only by the Excel export dialogs) is similarly isolated into its own chunk by dynamic import.

## API Layer

API modules in `frontend/src/api/` follow a consistent pattern:

- Each PocketBase collection has a dedicated module (e.g., `residents.ts`, `documents.ts`, `blotter.ts`)
- Modules export typed async functions for each operation (create, read, update, delete, list with filters)
- Functions return typed responses and use the shared PocketBase client from `getClient()`
- Errors are normalized through `frontend/src/api/errorHandler.ts`
- A `beforeSend` hook on the shared client (`client.ts`) auto-stamps `barangay_id` on every record-create request — see [Multi-Tenancy](#multi-tenancy)

There are **24 API modules** in total, covering all PocketBase collections used by the application.

### Error handling hierarchy

1. `ClientResponseError` (PocketBase SDK) — mapped to user-friendly messages:
   - 429: "Rate limit exceeded. Please wait before trying again."
   - 403: "You do not have permission to perform this action."
   - 401: "Your session has expired. Please log in again." (auto-clears auth)
2. `TypeError: Failed to fetch` — "Network error. Your changes will be saved offline and synced when the connection is restored."
3. All other errors — Generic message with the original error attached for debugging

### Retry logic

The `shouldRetry()` and `retryDelay()` functions in `errorHandler.ts` implement exponential backoff for retryable status codes (429, 503):

| Attempt | Delay |
|---------|-------|
| 1st retry | 2s |
| 2nd retry | 4s |
| 3rd retry | 8s |
| 4th retry | 16s |
| 5th+ retry | 30s (capped) |

Non-retryable errors (4xx except 429) are immediately passed to the error handler.

## Data Flow

```
User Action
  |
  +-- Auth: frontend/src/auth/session.ts -> PocketBase SDK -> REST API
  |
  +-- API: frontend/src/api/{module}.ts -> getClient() -> PocketBase SDK -> REST API
  |
  +-- Offline: On network error -> enqueue() -> IndexedDB
  |   +-- On reconnect -> flushQueue() -> REST API (FIFO order)
  |
  +-- Error: handleApiError() -> ApiError -> UI notification (sonner toast)
```

## Data Model

Core PocketBase collections (defined in `backend/pb_migrations/`). Every row below except `barangays` and `lookups` carries a `barangay_id` relation and is tenant-scoped by API rule.

| Collection | Type | Purpose |
|------------|------|---------|
| `users` | auth | User accounts with `role` field (admin/staff/viewer) + `barangay_id` |
| `barangays` | base | Tenant registry — one row per onboarded barangay. Not tenant-scoped itself (a user can only see their own row) |
| `residents` | base | Resident profiles with demographic tags (voter, senior, PWD, 4Ps, deceased) |
| `households` | base | Family groupings with household head assignments |
| `household_members` | base | Members within a household, linked to a resident |
| `migrant_info` | base | Migration/relocation records linked to a resident |
| `deceased_records` | base | Deceased resident records |
| `document_requests` | base | Document request → processing → release lifecycle |
| `blotter_records` | base | Incident/blotter records with hearing/settlement workflow |
| `assets` | base | Barangay property inventory with condition tracking |
| `calendar_events` | base | Event scheduling |
| `agenda_items` | base | Meeting agenda items and resolutions |
| `meetings` | base | Meeting/session records |
| `visitor_logs` | base | Visitor check-in/out log |
| `activity_logs` | base | General system audit trail |
| `system_settings` | base | Key-value configuration store (`barangay_id` + `key` composite unique index) |
| `appropriations` | base | Budget appropriations with expense class (PS/MOOE/CO) |
| `fund_sources` | base | Fund sources with statutory rules (20% DF, SK, etc.) |
| `revenues` | base | Revenue collections linked to income accounts |
| `disbursements` | base | Disbursement records |
| `income_accounts` | base | Chart of accounts for revenue tracking |
| `finance_audit_logs` | base | Finance-specific audit trail (separate from `activity_logs`) |
| `webauthn_credentials` | base | Registered passkey public keys per user |
| `lookups` | base | Shared reference/dropdown data (ethnicity, assistance types, etc.) — global, not tenant-scoped, seeded once |

Total: **24 collections** — 1 auth collection + 23 base collections.

## Finance Audit Trail

The finance module has a dedicated audit trail that logs every create/update/delete operation across all 6 finance collections. This is completely separate from the general `activity_log` system.

### Architecture decision

Audit logging is implemented on the **frontend side** rather than in PocketBase hooks. During development, we discovered that PocketBase 0.39.5's hook events (`onRecordAfterCreate`, `onRecordAfterCreateRequest`, etc.) do not fire for REST API requests made through the JS SDK — they only fire for Admin UI operations or internal `dao.saveRecord()` calls. A frontend-side approach was chosen as the most reliable alternative.

### How it works

1. Each mutation function in `frontend/src/api/*.ts` (e.g., `createAppropriation`) first performs the main API call
2. On success, it calls `createFinanceAuditLog()` from `frontend/src/api/financeAudit.ts`
3. The audit entry is written to the `finance_audit_logs` collection with: action type (create/update/delete), collection name, record ID, details diff, financial amount, user name, and timestamp
4. Audit failures are intentionally silent — they never block the main operation. This ensures that a failed audit write doesn't prevent the user from completing their work.

### Viewing the audit trail

The `FinanceAudit` page at `/finance/audit` displays the trail with:
- Collection filter (filter by appropriations, revenues, disbursements, etc.)
- Pagination for browsing through entries
- Detail flyout showing user attribution and timestamp information
