# Phase 4 — Custom backend logic → Edge Functions: status

Same environment constraint as Phases 0-3, plus a new one: **no Deno runtime in this sandbox
either** (`deno` isn't installed, and there's no network to fetch it or to reach
`deno.land/x/denomailer` or a real Meilisearch/SMTP server). Everything checkable without them was
actually checked; everything needing a live edge-runtime is documented with exact commands for the
first Docker-capable host.

## What was ported

`backend/supabase/functions/`:

| Function | Ports | Notes |
|---|---|---|
| `notify-document-status` | `notify.pb.js`'s `/api/notify/document-status` | Subject/body logic, `documentTitle()`, `esc()` transcribed verbatim |
| `notify-hearing-scheduled` | `notify.pb.js`'s `/api/notify/hearing-scheduled` | Same |
| `search-index` | `search.pb.js`'s `/api/search/index` | Tenant-forcing logic (`doc.barangay_id = user.barangayId`) is the actual security boundary |
| `search-query` | `search.pb.js`'s `/api/search/query` | Per-role index visibility (`ROLES_BY_INDEX`) |

`_shared/` (`auth.ts`, `http.ts`, `cors.ts`, `esc.ts`, `documentTitle.ts`, `mailer.ts`): notify.pb.js
and search.pb.js each had a comment explaining PocketBase 0.39.5's routerAdd handlers can't
reference top-level helpers (a real quirk verified against a live binary while building the
original). **Deno/edge-runtime has no such limitation** — ordinary ES module imports work
normally — so this port intentionally does share helpers across functions; the PocketBase-specific
self-containment constraint doesn't carry over and isn't a real requirement here.

### Auth model change (an improvement, not just a port)

The original routes read `e.auth.get("barangay_id")` from PocketBase's live auth record. The
ported `_shared/auth.ts` reads the same fields from the **verified JWT's `app_metadata`** (already
populated by `custom_access_token_hook`, Phase 1) via `GET /auth/v1/user` — one network call to
GoTrue's own token verification, no separate database round trip. Equally trustworthy (both
ultimately trust what the auth service put in the session at login), just architecturally simpler.

### SMTP: explicit env vars (documented behavior change, per the plan)

PocketBase's mailer was configured once in Settings -> Mail (Admin UI only). Self-hosted Supabase
Edge Functions have no equivalent admin UI, so `_shared/mailer.ts` reads `SMTP_HOST`/`SMTP_PORT`/
`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM_ADDRESS`/`SMTP_FROM_NAME` as Edge Function secrets (see
`functions/.env.example`). Still real SMTP protocol (via `denomailer`), not swapped for an HTTP
mail API — that would be a bigger behavior change than the plan calls for.

### Meilisearch index setup: moved out of the request path

`search.pb.js` ran index creation (`primaryKey=id` + `filterable-attributes`) as a top-level IIFE
on every PocketBase boot. Edge Functions have no "on boot" hook — each invocation is a stateless
request — so this one-time setup moved to `backend/scripts/setup-search-indexes.mjs`, run once at
deploy time. Documented, deliberate move, not an oversight.

## What was actually verified here (no Deno/network needed)

- **TypeScript correctness**: `npx tsc --noEmit` against all 4 functions + `_shared/` with a
  minimal `Deno.serve`/`Deno.env` shim — zero type errors.
- **The actual security-relevant logic** (tenant-forcing on write, per-role index filtering, input
  validation) — extracted into a throwaway Node harness (not shipped; Phase 7 owns real CI test
  ports) and run directly, since it's plain JS with no Deno-specific API surface:
  - a client-supplied `barangay_id` in the write body is discarded and overwritten from the
    session, never trusted (the one line that actually prevents cross-tenant indexing, same as the
    PocketBase original)
  - `delete` actions don't stamp `barangay_id` at all (matches the original — deletes are by id only)
  - an unknown index name and a missing document `id` are both rejected
  - a `viewer` querying `document_requests` has that index silently dropped (not an error) while
    `residents`/`blotter_records` still go through — matches the RLS-proven "viewer sees zero rows
    on document_requests" behavior from Phase 1
  - **a bonus check beyond what the original PocketBase code was ever tested against**: a
    `barangay_id` containing `" || 1=1 || "` has its quotes stripped before being interpolated into
    the Meilisearch filter string, closing off what would otherwise be a filter-injection path —
    same double-quote-stripping line the original `search.pb.js` already had
    (`.replace(/"/g, "")`), now confirmed to actually do its job against a realistic attack string.
  - All 7 checks pass.
- The notify functions' subject/body-line construction was transcribed verbatim from
  `notify.pb.js` (same switch statement, same template literals, same `esc()`) and reviewed
  side-by-side rather than executed — no Deno runtime here to actually run it end-to-end.

## What's still open — needs a real Docker + Deno-capable host

- Deploying the functions (`supabase functions deploy notify-document-status` etc., or the
  self-hosted `edge-runtime` container from Phase 6) and confirming `denomailer@1.6.0` actually
  resolves from `deno.land/x` — pinned but never fetched in this sandbox.
- **The plan's literal Phase 4 "done when" bar**:
  1. A status change sends the same email content as before — call
     `supabase.functions.invoke('notify-document-status', { body: {...} })` against a real SMTP
     sink (e.g. Mailhog) and diff the rendered HTML against `notify.pb.js`'s output for the same
     input.
  2. A resident create produces a correctly tenant-scoped Meilisearch upsert — call
     `search-index` with `action: "upsert"`, then `GET {MEILI_URL}/indexes/residents/documents/{id}`
     directly (bypassing the search-query route) and confirm `barangay_id` matches the caller's
     session tenant, not whatever (if anything) was sent in the request body.

## Known interim state: the frontend still calls the old routes

`frontend/src/api/notifications.ts` and `frontend/src/api/searchSync.ts` still `fetch()` the old
`/api/notify/*` and `/api/search/*` paths against PocketBase's `baseURL`. Switching these to
`supabase.functions.invoke(...)` is explicitly Phase 5's job (frontend rewrite) — this phase only
builds and verifies the Edge Functions themselves, matching Phase 3's same "sidecar/backend ported,
frontend call sites deferred" pattern.
