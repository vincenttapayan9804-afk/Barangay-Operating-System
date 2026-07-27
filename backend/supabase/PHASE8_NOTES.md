# Phase 8 — Cutover: status

This is the final phase of `docs/SUPABASE_MIGRATION_PLAN.md`. Unlike Phases 1-7, most of
this phase's work is *deletion* and *documentation*, not new backend code — Phases 1-7
already built and independently verified the real thing this repo now runs on.

## What was deleted

Per the plan's own Phase 8 text ("delete `backend/pb_hooks/`, `backend/pb_migrations/`,
`backend/pocketbase.exe`, `backend/litestream.yml`, the PocketBase compose service, the
`pocketbase` npm dependency"), plus the files that were unambiguously part of the same
PocketBase-era backend the plan text didn't enumerate by name:

- `backend/pb_hooks/`, `backend/pb_migrations/` — fully superseded by
  `backend/supabase/functions/` and `backend/supabase/migrations/` since Phases 1 and 4.
- `backend/pocketbase.exe`, `backend/Dockerfile`, `backend/.dockerignore` — the PocketBase
  binary and its image build; `backend/supabase/db.Dockerfile` is the real Postgres image now.
- `backend/docker-compose.yml`, `backend/docker-compose.dev.yml` — the old PocketBase +
  meilisearch + litestream + webauthn + frontend compose; `backend/supabase/docker-compose.yml`
  has been the real 10-service stack since Phase 6 (meilisearch/webauthn/frontend already
  moved there).
- `backend/litestream.yml` — replaced by pgBackRest (`backend/supabase/backup/`) since Phase 6.
- `backend/.env.example` — the old PocketBase-era root env vars; `backend/supabase/.env.example`
  has covered the real stack since Phase 6.
- The `pocketbase` npm dependency (`frontend/package.json`) — see "Frontend fallout" below for
  what this actually touched.
- `scripts/export-data.sh` — talked to PocketBase's admin/collection-export API directly.
  Never adapted in Phase 6 or 7 (both explicitly flagged it as out of scope), and cutover
  removes the backend it talked to entirely — kept, it would just be dead code pointing at
  nothing. A Postgres-native export feature (if ever wanted) is a new, separate task; pgBackRest
  already covers disaster-recovery-grade backup/restore.
- `scripts/e2e-server.mjs` — orchestrated a real local PocketBase instance for Playwright's
  CI-only `webServer` path. No longer needed — see "e2e test harness" below.

## Frontend fallout from removing the `pocketbase` npm dependency

Two files still imported `ClientResponseError` from the `pocketbase` package itself, entirely
independent of any real backend choice: `frontend/src/api/mockPocketBase.ts` (demo mode's
in-browser fake backend, unrelated to PocketBase-the-server — it just borrowed one error class
for shape compatibility) and `frontend/src/api/errorHandler.ts` (which catches it). Replaced
with a local `DemoResponseError` class in `mockPocketBase.ts` with the identical
`status`/`response`/`data` shape, so `errorHandler.ts`'s demo-mode branch needed no logic
changes — just a different import. Demo mode itself is untouched and still fully
PocketBase-independent; this was purely about removing the leftover npm dependency, not about
demo mode's design.

## A real bug found and fixed while verifying this phase

`frontend/src/auth/session.ts`'s `initAuthSession()` (called from `App.tsx` before anything
renders) called `getSupabase()` unconditionally whenever demo mode wasn't *already* enabled —
including on first page load, before a user has clicked anything. `getSupabase()` throws
synchronously ("Invalid supabaseUrl") when `VITE_API_URL` is unset, which is exactly the state
of the "instant demo, zero `.env`" path this phase's rewritten README/DEVELOPMENT.md now
document as the primary quick start. The result: with no `.env.local` at all, the app never
rendered anything — not even the login page's demo buttons — because `App.tsx` awaits
`initAuthSession()` before flipping `ready` to `true`, and that promise never resolved.

Confirmed live (this sandbox has a working Chromium, unlike the Docker-less environment every
prior phase's backend verification was limited by): running the rewritten Playwright e2e suite
against a plain `npm run dev` with zero config reproduced exactly this — the demo login button
never appeared, `global.setup.ts` timed out after 30s. Fixed by wrapping `initAuthSession()`'s
real-mode branch in a `try/catch` that treats a construction failure as "no session," matching
what should happen anyway when no real backend is configured. Re-ran the e2e suite after the
fix: demo login now succeeds, the dashboard renders, and the "customize panel" test passes.

Not a consequence of the Supabase migration architecturally — this code has looked like this
since Phase 5 — but it's a real, user-facing crash directly in the path this phase's own
documentation now promotes as the easiest way to try the app, so it was in scope to fix here.

## e2e test harness ported off PocketBase

`frontend/e2e/global.setup.ts` used to authenticate against a real, separately-started
PocketBase instance (`scripts/e2e-server.mjs`, spawned only when `CI=true` — never actually
wired into `.github/workflows/ci.yml`, so this path was untested dead code even before this
migration). Rewritten to log in through demo mode instead (click the login page's
`data-testid="demo-login-admin"` button, added to `LoginPage.tsx` for this), since these UI
smoke tests only need *some* authenticated session to reach the dashboard, not real backend
behavior — `backend/scripts/test-tenant-isolation.mjs` (Phase 7) is what actually exercises
real backend/RLS behavior. This let `scripts/e2e-server.mjs` be deleted outright and
`playwright.config.ts`'s CI/non-CI branch collapse to one command, since demo mode needs no
backend in either environment. Verified live (see above) — the only prior phase where the e2e
harness itself, not just the scripts it depends on, could be run end-to-end in this sandbox.

Also fixed while here: `vite.config.ts` had a stale PocketBase-era dev proxy
(`/api`,`/_` → `http://localhost:8091`, the old webauthn sidecar's port) that nothing in the
app actually uses anymore (`lib/apiConfig.ts`'s `getApiUrl()` resolves an absolute URL, not a
relative path Vite would need to forward) — removed.

## Documentation rewritten

`README.md`, `docs/DEVELOPMENT.md`, `docs/CONTRIBUTING.md`, `docs/SECURITY.md` — none of these
were touched by Phases 5-7 (only `ARCHITECTURE.md`/`DEPLOYMENT.md` were), so they still
described PocketBase as the live backend, with setup instructions that would no longer work
once this phase's deletions landed. Rewritten: Quick Start sections now lead with demo mode
(genuinely zero-config) and treat the real Supabase stack as the "with a real backend" path;
project-structure trees point at `backend/supabase/`; `SECURITY.md`'s Authentication/
Authorization sections now describe GoTrue/RLS/TOTP MFA/pgBackRest instead of PocketBase's
bcrypt store/collection rules/Litestream. `.github/workflows/ci.yml` also had unused
`E2E_ADMIN_EMAIL`/`E2E_USER_EMAIL`/`VITE_API_URL` workflow-level env vars left over from the
old e2e harness — removed. `.github/dependabot.yml`'s `pocketbase` dependency group replaced
with a `@supabase/*` one.

## Also fixed: a real (unrelated) `.gitignore` gap

Noticed while working in this area: `.gitignore` had no entry for a bare `.env` file — only
`.env.local`/`.env.production`. `backend/supabase/.env` (real secrets: `POSTGRES_PASSWORD`,
`JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, ...) is exactly the filename every Phase 6/7/8
doc instructs a deployer to create (`cp .env.example .env`), and it was not gitignored. Added
`.env` to `.gitignore`. Not something the Supabase migration introduced, but directly adjacent
to the setup flow this phase's docs describe, so fixed here rather than filed away.

## Running the real bootstrap (not done here — no Docker in this sandbox)

The plan's "run the real bootstrap script" step is `backend/scripts/bootstrap-platform-admin.mjs`
against a live `docker compose up -d` stack — this still requires an actual Docker host, which
this sandbox has never had (see every prior phase's own notes). This is a deploy-time action,
not a repo-state change, so there's nothing to commit for it; `docs/DEPLOYMENT.md` and
`docs/DEVELOPMENT.md` both already document the exact command sequence.

## Cutover tripwire (re-checked, per the plan's own wording)

The plan calls for re-checking, before deleting anything, whether real tenant data already
exists on a PocketBase pilot deployment (which would need a one-off export/import during an
announced maintenance window first). Nothing in this repository or session indicates a live
PocketBase deployment with real barangay data — this has been a from-scratch migration across
all 8 phases, with no production backend ever stood up in this environment. Rollback, if ever
needed: `git revert` (pre-cutover state is fully recoverable — nothing here is a destructive
operation on data, only on repo files already superseded by Phases 1-7's replacements).

## What's still unverified live (needs a real Docker host)

Unchanged from every prior phase: the full `backend/supabase/docker-compose.yml` stack has
never been brought up end-to-end in this sandbox (no Docker daemon). What *was* newly
verified live this phase — a first, within this migration — is the frontend's own runtime
behavior end-to-end (demo mode login, session boot, dashboard render, Playwright e2e), using
this sandbox's pre-installed Chromium. That's a strictly frontend-only verification; GoTrue/
PostgREST/RLS/Realtime/Kong/pgBackRest/Supavisor behavior still rests on the reasoning
documented in Phases 0-7's own notes, not a live run.
