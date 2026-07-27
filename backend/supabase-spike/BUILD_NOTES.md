# Phase 0 Spike — Build Notes

Status of the three unknowns docs/SUPABASE_MIGRATION_PLAN.md's Phase 0 requires closing before
Phase 1 builds on top of them.

## Environment constraint (read this first)

This spike was authored inside a cloud dev sandbox with **no working Docker daemon** (`dockerd`
can't start — cgroup/ulimit restrictions from the sandbox's own containment) and **no network
access to arbitrary GitHub repos** (this session's GitHub scope is limited to this one repository;
`supabase/auth`, `supabase/postgrest`, `supabase/realtime` etc. are unreachable, so no route to a
static GoTrue/PostgREST/Realtime binary either). A real self-hosted Supabase stack could not be
run here under any approach.

What *was* available: a native PostgreSQL 16 install (no Docker required). Everything provable at
the SQL level was actually run and verified, not just written — see Unknown #1. Everything that
requires a live GoTrue/PostgREST/Realtime process is written up as design + a runnable spike
(`docker-compose.yml`) for the first Docker-capable host (dev machine or the target VM from
`docs/DEPLOYMENT.md`), with the specific commands to confirm it.

## Unknown #1 — Access-token hook injects the right claims: **CONFIRMED**

Verified by actually running `verify-hook.sql` against a throwaway native Postgres database
(`backend/supabase-spike/`, no Docker):

```
cd backend/supabase-spike
sudo -u postgres psql -v ON_ERROR_STOP=1 -f verify-hook.sql
```

14/14 assertions pass:
- `custom_access_token_hook` correctly injects `barangay_id`, `role`, `is_platform_admin` into
  `app_metadata` for admin, staff, and platform-admin profiles.
- `require_mfa` correctly mirrors `1785000033_mfa_extend_to_staff.js`'s rule (`role = admin` always
  true; `role = staff` only true when the tenant's `require_staff_mfa` is set) — tested against one
  tenant with it on and one with it off.
- An unknown `user_id` (no profile row yet) passes claims through unchanged instead of erroring —
  matches a freshly-created-but-unassigned PocketBase user today.
- **Bonus, beyond what Phase 0 asked for**: the hook's own output was fed into a real RLS policy
  (`app.spike_residents`, `USING (barangay_id = app.current_barangay_id())`) via
  `set_config('request.jwt.claims', ...)` — the same GUC PostgREST sets per-request — run as a
  genuine non-superuser role (`spike_authenticated`, `FORCE ROW LEVEL SECURITY` on the table).
  Admin A saw exactly A's 2 rows, staff B saw exactly B's 1 row, and a session with no claims saw
  zero rows. This is real evidence the RLS mechanism Phase 1 depends on for all ~27 tables actually
  works end-to-end from JWT claim to filtered row set, not just that the SQL parses.

`auth-hook.sql` is the real deliverable (the `app` schema helpers are copy-ready for Phase 1's
`0000_auth_helpers.sql`; the hook function is copy-ready for a `0001_custom_access_token_hook.sql`
migration). `auth-stubs.sql` is spike-only scaffolding (reimplements `auth.jwt()`/`auth.uid()` to
run without the real `supabase/postgres` image, which already ships them) — do not carry it into
Phase 1, its own header says so.

## Unknown #2 — WebAuthn session-minting path: **DESIGN RECOMMENDATION, NOT YET VERIFIED**

Current PocketBase mechanism (`backend/webauthn-service/server.mjs:262-264`): the sidecar
authenticates as a PocketBase superuser once, then calls
`admin.collection('users').impersonate(user.id, ttl)` — a single privileged call that mints a full
session (access token in the same shape `authWithPassword()` returns) for an arbitrary already-
verified user, no password needed.

Neither GoTrue path is a literal drop-in; recommendation is **path A** unless it fails the exact
check below, with B as the documented fallback:

- **Path A — `POST /admin/generate_link` (magiclink type, no email sent).** Self-hosted GoTrue's
  admin API can generate a magiclink server-side; the sidecar (already holding a
  `SUPABASE_SERVICE_ROLE_KEY`, replacing today's `PB_SUPERUSER_EMAIL`/`PASSWORD` env vars) calls
  this, then redeems the returned link's token server-side against `/verify` to get a real access +
  refresh token pair. Lower engineering surface, uses a documented admin endpoint as intended.
- **Path B — manual token mint.** Since this is self-hosted (we hold `GOTRUE_JWT_SECRET` directly —
  impossible on Supabase Cloud, fine here), an Edge Function could sign a correctly-shaped access
  token JWT by hand and insert a matching row into `auth.refresh_tokens`. More moving parts, only
  needed if Path A's redemption step turns out not to produce a refresh token in self-hosted GoTrue.

**The specific thing that must be checked on a real Docker host before Phase 3 builds on this**
(the plan's own wording): whichever path is used **must** return both an access token and a
refresh token. A session that only has an access token silently breaks on the user's next page
refresh once the short-lived access token expires, with no way to renew it — this would look like
working passkey login in a five-minute manual test and then fail in the field.

**Verification steps for the first Docker-capable host** (not run here, no Docker in this sandbox):
```
cd backend/supabase-spike && cp .env.example .env  # fill in secrets
docker compose up -d
curl -X POST http://localhost:9999/admin/generate_link \
  -H "Authorization: Bearer $SERVICE_ROLE_JWT" -H "Content-Type: application/json" \
  -d '{"type":"magiclink","email":"test@example.com"}'
# then redeem the returned action_link/token against /verify and confirm the
# response JSON has both access_token and refresh_token populated.
```

## Unknown #3 — Realtime `postgres_changes` respects RLS: **NOT YET VERIFIED**

Requires the actual `supabase/realtime` image, which needs both a live logical-replication
connection to Postgres and a live WebSocket client — not reproducible with SQL alone, and not
runnable in this sandbox.

Design is straightforward and documented in the plan (`ALTER PUBLICATION supabase_realtime ADD
TABLE <table>` per tenant-scoped table), but self-hosted Realtime's RLS enforcement on
`postgres_changes` broadcasts (as opposed to just the initial fetch) has version-dependent history
upstream — this needs an empirical check against the exact image pinned in
`backend/supabase-spike/docker-compose.yml` (`supabase/realtime:v2.34.47`) before Phase 1 commits to
it as the mechanism, per the plan's own Phase 0 wording.

**Verification steps for the first Docker-capable host:**
```
docker compose up -d   # from backend/supabase-spike/
psql "$DB_URL" -c "alter publication supabase_realtime add table app.spike_residents;"
# Subscribe two websocket clients to postgres_changes on spike_residents,
# authenticated as admin A and staff B respectively (JWTs minted via the
# /token endpoint using the profiles seeded in verify-hook.sql).
# Insert one row for tenant A, one for tenant B.
# PASS: the A-authenticated client receives only the A insert event; the
# B-authenticated client receives only the B insert event.
```

## What Phase 1 can start on now vs. what it should wait on

- **Unblocked now**: the RLS policy mapping (Unknown #1 confirmed) — Phase 1's schema + RLS
  migrations can proceed using `auth-hook.sql`'s helpers as the literal starting point.
- **Should be confirmed on a real Docker host before Phase 3 (WebAuthn port) and before Phase 1's
  Realtime publication setup is relied upon in Phase 5** — Unknowns #2 and #3. This isn't a hard
  blocker on starting Phase 1's table/RLS work, which doesn't depend on either.
