# Architecture Guide

## System Overview

CLUSTR (BarangayOS) is a **multi-tenant** platform — one shared, self-hosted Supabase stack serves every onboarded barangay, with tenant isolation enforced server-side by Postgres Row-Level Security (see [Multi-Tenancy](#multi-tenancy) below). The backend is nine containers: **db** (Postgres), **auth** (GoTrue), **rest** (PostgREST), **realtime** (Supabase Realtime), **edge-runtime** (Deno Edge Functions), **kong** (API gateway, the single public entry point for all of the above), **meilisearch** (full-text search), **webauthn** (passkey sidecar), **supavisor** (connection pooler), and **backup** (continuous pgBackRest backup). A Cloudflare Tunnel provides secure public internet access, same as before.

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
                     │   nginx (SPA host)   │
                     └──────────┬──────────┘
                                │ /rest/v1, /auth/v1, /realtime/v1, /functions/v1
                     ┌──────────┴──────────┐
                     │   kong (port 8000)   │
                     │  apikey + acl + cors │
                     └──┬───┬────┬────┬─────┘
                        │   │    │    │
              ┌─────────┘   │    │    └─────────┐
        ┌─────┴────┐  ┌─────┴──┐ │        ┌─────┴───────┐
        │   rest   │  │  auth  │ │        │ edge-runtime │
        │(PostgREST)│  │(GoTrue)│ │        │(Edge Funcs)  │
        └─────┬────┘  └────┬───┘ │        └─────┬────────┘
              │            │  ┌──┴──────┐        │
              │            │  │realtime │        │
              │            │  └────┬────┘        │
              └────────────┴───────┴──────────────┘
                                │
                          ┌─────┴──────┐
                          │  db (15)   │──────→ pgBackRest → S3-compatible bucket
                          │  Postgres  │
                          └─────┬──────┘
                                │ (pooled entry point, direct
                                │  clients / future growth)
                          ┌─────┴──────┐
                          │  supavisor  │
                          └────────────┘

        webauthn sidecar and meilisearch reach the stack only through
        kong (webauthn) or are reached only by edge-runtime (meilisearch) —
        neither is exposed publicly.

LAN Users: http://192.168.x.x:8080 or https://192.168.x.x:8443 (HTTPS with mkcert for PWA)
Remote:    https://app.yourdomain.com (via Cloudflare Tunnel → nginx, HTTPS)
```

Kong (`backend/supabase/kong.yml`) is the single public entry point for every backend service — `/auth/v1/*`, `/rest/v1/*`, `/realtime/v1/*`, and `/functions/v1/*`, each gated by an apikey (the anon or service_role JWT) plus an ACL group check. The frontend's `@supabase/supabase-js` client (`frontend/src/lib/supabaseClient.ts`) talks to Kong exclusively — it never connects to `db`, `rest`, `auth`, `realtime`, or `edge-runtime` directly, in dev or in production. See `docs/DEPLOYMENT.md` for the full hosting/scaling guide.

## Multi-Tenancy

One shared Postgres database serves every barangay. Every tenant-owned table carries a `barangay_id` column (see `backend/supabase/migrations/0001_barangays.sql` onward), and every table's Row-Level Security policies are compounded with an `app.current_barangay_id()` check — enforced server-side by Postgres itself as part of the query plan, not by client-side filtering, and not bypassable by any query shape (unlike a hand-added `WHERE` clause, RLS applies even to a client-supplied `.select('*')` with no filter at all). Every tenant-scoped table's `barangay_id` column also defaults to `app.current_barangay_id()` (see `backend/supabase/migrations/0000_auth_helpers.sql`), so — unlike the old PocketBase `beforeSend` hook, which had to stamp it onto every create request client-side — real-mode inserts never need to set it explicitly at all.

New tenants are provisioned through the `/platform-admin` console (`frontend/src/pages/PlatformAdmin.tsx`, `frontend/src/api/platformAdmin.ts`), gated to a platform-admin flag rather than the regular per-tenant `admin` role — a barangay's own admin can never see or manage another barangay's data or users. Onboarding a barangay's first admin account calls the `create-barangay-admin` Edge Function (`backend/supabase/functions/create-barangay-admin/`), since creating an `auth.users` row is a GoTrue admin-API operation gated to the `service_role` key, which never reaches the frontend — a real architectural difference from PocketBase, where any client satisfying the `users` collection's own create rule could create a user record directly. Tenant isolation is verified in CI (Phase 7): `test-tenant-isolation.mjs` asserts that a session authenticated as tenant A gets zero rows back when listing tenant B's data, rewritten to PostgREST/GoTrue endpoint shapes.

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
3. If the page is HTTP, probe `VITE_LOCAL_API_URL/auth/v1/health` (GoTrue's own health endpoint, reached through Kong) with a 3-second timeout
4. If the local server responds — even a 401 from Kong's key-auth plugin counts as "reachable"; reachability only means "something answered," not "the request was authorized" — use the LAN URL for zero-latency, offline-capable access
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

GoTrue (Supabase's auth server) handles authentication via email/password or passkey. The app uses role-based access control with three roles, enforced server-side by Postgres Row-Level Security policies keyed off the JWT's own claims, on top of the tenant (`barangay_id`) scoping described above.

| Role | Permissions |
|------|------------|
| **Admin** | Full CRUD on all tables, user management, system settings — within their own tenant |
| **Staff** | Create/update records, documents, residents; limited delete |
| **Viewer** | Read-only access to most tables |

A separate platform-admin flag (independent of the three tenant roles above) gates the `/platform-admin` console for onboarding new barangays.

### Auth flow

1. User submits email/password (or completes a passkey ceremony — see below) via `login()` (`frontend/src/auth/session.ts`)
2. GoTrue validates credentials and always returns a valid session — unlike PocketBase, a correct password alone is enough to sign in; there is no separate "partial MFA token" state
3. The session (access + refresh token) is held by `@supabase/supabase-js`'s own client, which persists it to localStorage and refreshes it automatically; `initAuthSession()` hydrates a synchronous `cachedUser` at boot (awaited once in `App.tsx`) and keeps it current via `supabase.auth.onAuthStateChange(...)`, since every call site here expects `getCurrentUser()`/`isAuthenticated()` to answer synchronously
4. If the account's role requires MFA (see below), `login()` itself checks the session's assurance level right after sign-in and, if it's below aal2, issues a challenge and returns `{ mfaRequired: true, factorId, challengeId }` instead of treating the user as fully signed in — the RLS layer (not the sign-in call) is what actually withholds data pre-aal2
5. `getCurrentUser()` extracts role, `barangay_id`, and user data from the JWT's `app_metadata` (set by `custom_access_token_hook`, see below)
6. Route guards (`ProtectedRoute`) check authentication status, user role, and (for `/platform-admin`) the platform-admin flag before rendering protected pages
7. On session expiry, the user is redirected to the login page

### The custom access token hook

`role`, `barangay_id`, and `is_platform_admin` live in the `profiles` table (`backend/supabase/migrations/0002_profiles.sql`), not on the GoTrue-managed `auth.users` row itself. `custom_access_token_hook` (`backend/supabase/migrations/0003_custom_access_token_hook.sql`, wired into GoTrue via `GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED`/`_URI` in `docker-compose.yml`) runs on every token mint and copies those three fields from `profiles` into the JWT's `app_metadata`, which is what every RLS policy and `frontend/src/auth/session.ts`'s `getCurrentUser()` actually reads — the JWT is self-contained, so RLS policies never need a separate lookup against `profiles` per request.

### Multi-factor authentication (MFA)

TOTP authenticator-app MFA (`GOTRUE_MFA_TOTP_ENROLL_ENABLED`/`_VERIFY_ENABLED` in `docker-compose.yml`), gated at the RLS layer by `app.mfa_satisfied()` (`backend/supabase/migrations/0000_auth_helpers.sql`) — every RLS-facing claim helper (`current_barangay_id()`, `current_role()`, `is_platform_admin()`) funnels through it, so a session below the required assurance level collapses all three helpers to "nothing matches" and every policy denies, rather than needing a bolted-on MFA clause across every individual policy. This is a real mechanism change from PocketBase's email-OTP MFA (a password plus an emailed one-time code) to an authenticator-app TOTP code — GoTrue has no email-OTP-as-second-factor equivalent.

### Passkeys (WebAuthn)

Neither PocketBase nor GoTrue has native WebAuthn support, so the `webauthn` sidecar (`backend/webauthn-service/server.mjs`, Node + `@simplewebauthn/server`) still owns the attestation/assertion cryptography, reaching the rest of the stack only through Kong (`SUPABASE_URL=http://kong:8000`), authenticated as `service_role`. On successful verification it mints a real session via GoTrue's admin API and the frontend completes it with `supabase.auth.setSession({ access_token, refresh_token })`. Credentials are stored in the `webauthn_credentials` table (`backend/supabase/migrations/0025_webauthn_credentials.sql`). Client-side ceremony helpers live in `frontend/src/auth/LoginPage.tsx` via `@simplewebauthn/browser`; users manage their registered passkeys from Settings.

### Edge Functions (`backend/supabase/functions/`)

Direct behavioral ports of PocketBase's `pb_hooks/*.pb.js` custom routes, now running as Deno Edge Functions dispatched by a single `main` router (`backend/supabase/functions/main/index.ts`) inside the self-hosted `edge-runtime` container — `notify-document-status`/`notify-hearing-scheduled` (email notifications) and `search-index`/`search-query` (the Meilisearch proxy, see [Full-Text Search](#full-text-search-meilisearch) below). A fifth function, `create-barangay-admin`, has no PocketBase equivalent — it exists only because Supabase requires the `service_role` key (never shippable to the frontend) to create an `auth.users` row, a capability PocketBase's rule-based `users` collection gave any authorized client for free.

Unlike PocketBase's JSVM hooks — which had a real, empirically-verified quirk where a `routerAdd` callback couldn't reference a top-level `const`/`function` declared elsewhere in the file, forcing every handler to stay fully self-contained — Deno's Edge Functions are ordinary ES modules with no such restriction; every function here freely imports shared helpers from `_shared/` (`auth.ts`, `cors.ts`, `http.ts`, `esc.ts`, `mailer.ts`, `documentTitle.ts`).

### Server-side rules

Table-level Row-Level Security policies are defined in SQL migration files at `backend/supabase/migrations/`. Postgres executes these once, at migration time, to attach policies to each table; unlike PocketBase's rule strings (re-evaluated as an interpreted expression per request), these compile into the query planner. Policies combine role checks with tenant scoping via the shared helper functions in `0000_auth_helpers.sql`:

```sql
-- Staff can create and update within their own tenant, but not delete
create policy "staff can insert" on public.residents for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin', 'staff'));
create policy "staff can update" on public.residents for update
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin', 'staff'));
create policy "admin can delete" on public.residents for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');
```

## State Management

No external state management library (Redux, Zustand, etc.) is used. The app relies entirely on React built-in features:

- **React built-in state** — `useState`, `useEffect`, `useContext` for component-level and shared state
- **`@supabase/supabase-js` client** — Singleton client (`frontend/src/lib/supabaseClient.ts`'s `getSupabase()`) as the source of truth for the real session; `frontend/src/auth/session.ts`'s module-level `cachedUser` mirrors it synchronously via `onAuthStateChange` for the call sites (route guards, `getCurrentUser()`) that need a non-async answer. Demo mode keeps its own separate singleton, the mock PocketBase client (`frontend/src/api/client.ts`'s `getClient()`), untouched.
- **React Context providers** — `LanguageProvider` (`frontend/src/lib/i18n/`) for the EN/Tagalog/Cebuano UI language, `ThemeProvider` (`frontend/src/lib/theme.tsx`) for light/dark mode
- **Custom hooks** — `useApiHealth()` for periodic server health polling (every 30 seconds), and feature-specific custom hooks for domain logic

This approach keeps the bundle size small and avoids unnecessary complexity. If your feature requires shared state across many components, consider React Context before reaching for an external library.

## Internationalization (i18n)

A lightweight, dependency-free i18n system (no `react-i18next`) lives in `frontend/src/lib/i18n/`: a flat `Record<TranslationKey, string>` dictionary per language (`translations.ts`), a `LanguageProvider` context that persists the selection to `localStorage`, and a `useTranslation()` hook exposing `{ language, setLanguage, t }`. Supported languages: English, Tagalog, Bisaya/Cebuano. `LanguageSwitcher` (`frontend/src/components/LanguageSwitcher.tsx`) renders as a compact cycling button (sidebar footer) or a full segmented control (Settings, login page).

## Full-Text Search (Meilisearch)

The dashboard search bar (`frontend/src/pages/hooks/useGlobalSearch.ts`) tries a Meilisearch-backed proxy first for residents, document requests, and blotter records, falling back to the original per-table query for everything else — and for those same three tables too, if the proxy reports it isn't configured (`{ configured: false }`) or the request fails outright. This makes Meilisearch a pure enhancement: a deployment that never sets it up gets exactly the pre-existing search behavior.

**The frontend never talks to Meilisearch directly.** Both directions go through the `search-index`/`search-query` Edge Functions (`backend/supabase/functions/search-index/`, `search-query/`), invoked via `supabase.functions.invoke(...)`:

- `search-index` — called by `frontend/src/api/searchSync.ts` after every create/update/delete in `residents.ts`/`documents.ts`/`blotter.ts` (same fire-and-forget, never-block-the-mutation pattern as `createActivity()`). The function overwrites whatever `barangay_id` the client sent with the authenticated session's own value (from `requireUser(req)`) before writing to Meilisearch — the one line that actually prevents a compromised frontend from indexing data under another tenant.
- `search-query` — called by `useGlobalSearch`. Builds a `barangay_id = "<session's tenant>"` filter server-side (never from the request) for every index searched, and additionally restricts which indexes a request is even allowed to touch based on the authenticated user's role (mirroring the same per-table role rules used everywhere else — e.g. `viewer` can search residents/blotter but not documents).

Index setup (creating each index with an explicit `primaryKey: "id"`, and marking `barangay_id` filterable) happens once at deploy time via `backend/scripts/setup-search-indexes.mjs` — Edge Functions have no equivalent of PocketBase's "runs once on every boot" top-level hook code, since each invocation is its own stateless request. Both functions read `MEILI_URL`/`MEILI_MASTER_KEY` from their own environment (`backend/supabase/functions/.env.example`) — the Meilisearch master key never leaves the backend. See `docs/DEPLOYMENT.md` "Full-text search (Meilisearch)" for the Docker Compose setup.

## Code Splitting

Feature routes are lazy-loaded via `React.lazy()` in `frontend/src/routes/index.tsx`, with a single `Suspense` boundary around the `<Outlet />` in `frontend/src/components/Layout.tsx` so the sidebar/chrome stays mounted while a page chunk loads. This keeps a viewer-role user's first load from paying for finance, reports, and admin-only code they'll never execute. `exceljs` (used only by the Excel export dialogs) is similarly isolated into its own chunk by dynamic import.

## API Layer

API modules in `frontend/src/api/` follow a consistent pattern:

- Each table has a dedicated module (e.g., `residents.ts`, `documents.ts`, `blotter.ts`)
- Modules export typed async functions for each operation (create, read, update, delete, list with filters)
- Every function branches on `isDemoModeEnabled()`: the demo path is the original, unmodified PocketBase-shaped call through `getClient()` (the local-storage mock, `frontend/src/api/mockPocketBase.ts` — untouched by the Supabase migration, since demo mode is a self-contained sandbox with no real backend); the real path calls `supabase.from('table').select/insert/update/delete()`, `supabase.rpc(...)`, or `supabase.functions.invoke(...)` via `frontend/src/lib/supabaseClient.ts`'s `getSupabase()`
- `.or()` filter strings (search/lookup queries) are built through `frontend/src/api/supabaseFilters.ts`'s `orIlike()`/`orEq()`, which escape values before interpolating them — closing a real filter-string-injection bug class PocketBase's own hand-built filter strings had
- Errors are normalized through `frontend/src/api/errorHandler.ts`
- Real-mode inserts never set `barangay_id` themselves — every tenant-scoped table's column defaults to `app.current_barangay_id()` at the database level (see [Multi-Tenancy](#multi-tenancy)); demo mode's mock client still does its own equivalent stamping, unchanged

There are **26 API modules** that touch a backend at all (of ~29 total — `reports.ts` only composes other modules, `upload.ts` talks to Cloudinary, neither talks to the app's own backend), covering every table used by the application.

### Error handling hierarchy

1. Demo mode's `ClientResponseError` (from the `pocketbase` npm package, still used only for the mock client) — mapped to user-friendly messages:
   - 429: "Rate limit exceeded. Please wait before trying again."
   - 403: "You do not have permission to perform this action."
   - 401: "Your session has expired. Please log in again." (auto-clears auth)
2. Real mode's `AuthError` (`@supabase/supabase-js`) and duck-typed PostgREST/Postgres errors — mapped by status/code:
   - Postgres `42501` (insufficient_privilege — an RLS policy rejected the request): "You do not have permission to perform this action."
   - PostgREST `PGRST301`/`PGRST303` (JWT expired/invalid): "Your session has expired. Please log in again." (auto-clears auth)
   - Postgres `23xxx` (constraint violation — unique/foreign-key/check): a field-level validation message
3. `TypeError: Failed to fetch` — "Network error. Your changes will be saved offline and synced when the connection is restored."
4. All other errors — Generic message with the original error attached for debugging

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
  +-- Auth: frontend/src/auth/session.ts -> @supabase/supabase-js -> GoTrue (via Kong)
  |
  +-- API: frontend/src/api/{module}.ts -> getSupabase() -> supabase-js -> PostgREST (via Kong)
  |
  +-- Realtime: useRealtimeCollection() -> supabase.channel(...).on('postgres_changes', ...) -> Realtime (via Kong)
  |
  +-- Offline: On network error -> enqueue() -> IndexedDB
  |   +-- On reconnect -> flushQueue() -> PostgREST (FIFO order)
  |
  +-- Error: handleApiError() -> ApiError -> UI notification (sonner toast)
```

## Data Model

Core tables (defined in `backend/supabase/migrations/`). Every table below except `barangays` and `lookups` carries a `barangay_id` column and is tenant-scoped by RLS policy.

| Table | Type | Purpose |
|------------|------|---------|
| `auth.users` | GoTrue-managed | Email/password credentials — no app-specific columns |
| `profiles` | base | `role` (admin/staff/viewer) + `barangay_id` + `is_platform_admin`, one row per `auth.users` row |
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
| `revenues` | base | Revenue collections; `fund_source` is plain text here (not a foreign key, unlike `appropriations.fund_source`) |
| `disbursements` | base | Disbursement records |
| `income_accounts` | base | Chart of accounts for revenue tracking |
| `finance_audit_logs` | base | Finance-specific audit trail (separate from `activity_logs`) |
| `webauthn_credentials` | base | Registered passkey public keys per user |
| `lookups` | base | Shared reference/dropdown data (ethnicity, assistance types, etc.) — global, not tenant-scoped, seeded once |

Total: **24 tables** — 1 GoTrue-managed auth table + 23 application tables (`profiles` replaces PocketBase's single combined `users` collection, splitting GoTrue-managed credentials from app-specific fields).

## Finance Audit Trail

The finance module has a dedicated audit trail that logs every create/update/delete operation across all 6 finance collections. This is completely separate from the general `activity_log` system.

### Architecture decision

Audit logging is implemented on the **frontend side** rather than in a database trigger. This predates the Supabase migration: during PocketBase-era development, we discovered that PocketBase 0.39.5's hook events (`onRecordAfterCreate`, `onRecordAfterCreateRequest`, etc.) do not fire for REST API requests made through the JS SDK — they only fire for Admin UI operations or internal `dao.saveRecord()` calls. A frontend-side approach was chosen as the most reliable alternative, and carried over unchanged onto Supabase: `financeAudit.ts` still writes directly to `finance_audit_logs` via `supabase.from(...)` after each mutation, gated by the same RLS insert policy every other tenant-scoped table uses, rather than a Postgres trigger (which would have been a genuine, available alternative under Postgres that PocketBase never offered).

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
