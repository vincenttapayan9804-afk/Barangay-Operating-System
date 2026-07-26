# Phase 6 — Infra/ops rebuild: status

Same environment constraint as every prior phase: this sandbox has no working Docker
daemon, so none of the compose services below can actually be brought up here. Everything
checkable without one was checked — every new/changed YAML parses (`docker-compose.yml`,
`kong.yml`), every new shell script passes `bash -n`, `check-scale-signals.mjs` passes
`node --check`, and the frontend's `tsc -b`/lint/test/build (unaffected by this phase's
changes, but re-verified anyway) are all still green. What needs a real Docker host to
confirm is called out explicitly below, not glossed over.

## What changed

- **`backend/supabase/docker-compose.yml`** — expanded from Phase 2's auth-only stack
  (`db`+`auth`+`rest`+`kong`) into the full stack the plan calls for: `realtime`,
  `edge-runtime`, `meilisearch`, `webauthn`, `supavisor` (connection pooler), `backup`
  (pgBackRest), and `frontend` (the SPA/reverse-proxy nginx container, moved here from the
  old `backend/docker-compose.yml`). Every service has a healthcheck — the old PocketBase
  compose file had none on any service.
- **`backend/supabase/db.Dockerfile`** (new) — extends `supabase/postgres:15.8.1.040` with
  the `pgbackrest` binary. Needed because `archive_command` runs as a subprocess of
  Postgres itself, so the backup client has to live in the same image, not just a sidecar
  container.
- **`backend/supabase/backup/`** (new) — `pgbackrest.conf` (static, non-secret config) and
  `backup-cron.sh` (the `backup` service's entrypoint: `stanza-create` once, then a
  full-backup-on-Sunday/incremental-otherwise loop). Continuous WAL archiving to S3 comes
  from the `db` service's own `archive_mode`/`archive_command`, set via a `command:`
  override in `docker-compose.yml` rather than baked into the image, so it survives
  `db.Dockerfile` changes untouched.
- **`backend/supabase/functions/main/index.ts`** (new) — the dispatcher self-hosted
  `edge-runtime` needs (unlike managed Supabase, self-hosted edge-runtime has no
  platform-side router — one process receives every `/functions/v1/<name>` request and
  must load the right function directory itself). None of the five existing functions
  needed any change to work with it. Also answers `/_health` directly (no JWT check, no
  worker spun up) for `docker-compose.yml`'s healthcheck.
- **`backend/supabase/kong.yml`** — added `/realtime/v1/*` (with websocket-appropriate
  `key-auth` config) and `/functions/v1/*` routes, both gated the same way `/rest/v1/*`
  already was (apikey + ACL group).
- **`backend/supabase/migrations/0028_realtime_publication.sql`** (new) — adds
  `document_requests`, `blotter_records`, `visitor_logs` (the three tables
  `frontend/src/hooks/useRealtimeCollection.ts` actually subscribes to) to the
  `supabase_realtime` publication. **This was a real gap, not defensive boilerplate**:
  nothing in Phases 1-5 ever added a table to a publication, so without this migration the
  `realtime` service would come up healthy and simply never deliver an event for any of
  the three tables the frontend already has live-subscription UI wired up for.
- **`backend/supabase/migrations/0029_scale_signal_observability.sql`** (new) — enables
  `pg_stat_statements`, which `check-scale-signals.mjs`'s rewritten write-latency check
  depends on.
- **`backend/scripts/check-scale-signals.mjs`** — rewritten from PocketBase's
  `/api/logs.execTime` + nginx `stub_status` onto `pg_stat_statements` (write latency,
  approximated via `mean + 1.645*stddev` since pg_stat_statements doesn't expose true
  percentiles — documented in the script's own output, not presented as an equivalent
  measurement), `pg_database_size()` (size/growth, same methodology as before), and
  `pg_stat_activity` (active-connection count, replacing nginx's connection count). Talks
  to Postgres via `psql` (already a prerequisite for this repo's `verify/*.sql` files) —
  no new npm dependency, consistent with `generate-supabase-keys.mjs`'s own
  "no dependencies beyond what's already required" approach.
- **`frontend/nginx.conf` / `frontend/Dockerfile`** — the SPA host's reverse-proxy routes
  changed from PocketBase's `/api/*` and `/_/*` to `/rest/v1/*`, `/auth/v1/*`,
  `/realtime/v1/*` (with websocket upgrade headers — the one route that actually needs
  them), and `/functions/v1/*`, all proxied to `kong:8000`. `/api/webauthn/*` is unchanged
  (still a direct proxy to the sidecar, which was never behind Kong). `VITE_SUPABASE_ANON_KEY`
  added as a build arg.
- **`docs/ARCHITECTURE.md` / `docs/DEPLOYMENT.md`** — both rewritten section by section to
  match: new container diagram, RLS-based multi-tenancy (replacing PocketBase rule
  strings), the custom-access-token-hook explanation, TOTP MFA, Edge Functions (replacing
  `pb_hooks/`), the API layer's demo/real split, the new Data Model table (`profiles`
  replacing `users`), pgBackRest setup/restore/retention (replacing Litestream), Supavisor,
  and the rewritten scale-signal monitoring section.
- **`scripts/deploy.ps1`, `scripts/deploy-prod.ps1`, `scripts/healthcheck.sh`** — updated
  to point at `backend/supabase` and GoTrue's health endpoint instead of `backend` and
  PocketBase's. `scripts/export-data.sh` was **not** touched — see "Explicitly out of
  scope" below.

## Design decisions worth calling out

- **PostgREST, GoTrue, and Edge Functions connect to `db:5432` directly, not through
  Supavisor.** All three hold a small, fixed number of long-lived connections — not
  one-per-request — so they were never the workload Supavisor exists to protect against.
  Supavisor is wired in as the pooled entry point (port 6543, transaction mode) for
  anything that *does* open one connection per unit of work: ad hoc `psql`/BI-tool access
  today, and a from-day-one on-ramp so pointing a future service at it is a config change,
  not a re-architecture. This is a deliberate, more conservative choice than routing
  already-working Phase 2 services through an unverified new dependency.
- **Storage was not stood up**, per the plan — zero PocketBase file-field usage exists in
  this codebase (confirmed by exhaustive grep during planning; the only two file-like
  fields are a base64 text column and a Cloudinary URL string).
- **pgBackRest over WAL-G** — both were named as acceptable in the plan. pgBackRest was
  chosen for built-in point-in-time recovery and because its S3-repo mode needs no
  separate repo host (it pushes straight from the `db`/`backup` containers), mirroring
  Litestream's own "everything talks directly to the bucket" shape.

## What's built but NOT yet verified live (needs a real Docker host)

- The entire compose stack — `docker compose up -d` was never run, since this sandbox has
  no Docker daemon. YAML/shell syntax is verified; runtime behavior (healthchecks actually
  turning green, Kong routing actually working end-to-end, migrations actually applying
  cleanly against the real `supabase/postgres` image) is not.
- **Supavisor's exact self-hosted bootstrap.** The service is wired with what should be the
  right environment variables (`DATABASE_URL`, `SECRET_KEY_BASE`, `VAULT_ENC_KEY`,
  `POOLER_TENANT_ID`, etc.), but its tenant-registration sequence against a fresh `db`
  could not be exercised here. Confirm against the current official self-hosting docs
  before relying on it in production.
- **The `db.Dockerfile` + `archive_command` combination.** Whether `supabase/postgres`'s
  entrypoint chain accepts the `command:` override cleanly, and whether the Debian
  `pgbackrest` package installs without conflicting with the base image's own packages,
  needs a real build to confirm.
- **Realtime's `SEED_SELF_HOST` single-tenant mode** — the standard self-host shortcut
  that skips Realtime's own multi-tenant onboarding API, but its exact behavior (whether
  the tenant it seeds matches `ANON_KEY`'s JWT claims without further configuration) is
  unverified here.
- The healthcheck commands themselves assume each image ships `wget`/`curl` — reasonable
  for the images chosen (documented per-service in `docker-compose.yml`'s own comments)
  but not confirmed against the actual image contents.

## Explicitly out of scope for this phase

- `scripts/export-data.sh` — still calls PocketBase's admin auth + collection export API
  directly. Rewriting it to a Postgres/PostgREST-shaped export is a real, separate task
  (different auth model, different output format per table) that the plan doesn't call out
  under Phase 6 specifically; flagging it here as a known follow-up rather than silently
  leaving it broken without a note.
- `backend/scripts/load-test.mjs` and `backend/scripts/test-tenant-isolation.mjs` — still
  PocketBase-shaped. The plan assigns `test-tenant-isolation.mjs`'s rewrite to Phase 7
  ("Testing & CI port") explicitly; `load-test.mjs` weight naturally follows the same
  rewrite for the same reason (it exercises the same endpoints), so it's grouped there too
  rather than done piecemeal now.
- `.github/workflows/ci.yml` — still spins up a PocketBase instance for its
  `tenant-isolation` job. Also Phase 7's job per the plan's own wording.
