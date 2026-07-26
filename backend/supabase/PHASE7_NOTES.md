# Phase 7 — Testing & CI port: status

Same environment constraint as every prior phase: this sandbox has no working Docker
daemon, so the rewritten CI job below was never actually run end-to-end here. Both
scripts pass `node --check`; the CI YAML parses (`python3 -c "import yaml..."`). What
needs a real Docker host / a real GitHub Actions run to confirm is called out explicitly
below.

## What changed

- **`backend/scripts/test-tenant-isolation.mjs`** — rewritten from PocketBase's
  `/api/collections/*` shapes to GoTrue's `/admin/users` + `/token?grant_type=password` and
  PostgREST's `/rest/v1`-style (here reached directly on `rest`'s own port, so just `/`)
  query API. Same coverage as the original: seed two throwaway tenants + one staff user
  each (service_role bypasses RLS the same way the old PocketBase superuser token bypassed
  API rules), then assert tenant A can create its own data, cannot spoof-create under
  tenant B's `barangay_id`, cannot list or view tenant B's rows, sees only its own
  `barangays` row, and that `household_number`/`system_settings` composite-unique indexes
  are scoped per tenant, not global.
  - **Spoofed insert now expects 403/`42501`, not 400** — exactly the change the migration
    plan called out. A Postgres RLS policy violation is a distinct error class from a
    PocketBase API-rule violation, and PostgREST surfaces it as
    `insufficient_privilege` (403, code `42501`), not a generic 400.
  - **Cross-tenant view-by-id now expects 200 with an empty array, not 404** — a change
    the plan's own text didn't call out explicitly, found while working through the actual
    endpoint shapes rather than assumed. PocketBase has a discrete `/records/{id}` endpoint
    that 404s when a view rule excludes the row; PostgREST has no separate single-record
    endpoint — a filtered `?id=eq.<id>` query that RLS excludes just comes back as a
    normal 200 with zero rows, the same shape as the list-exclusion check. Documented
    in the script's own header comment so a future reader doesn't mistake it for a bug.
- **`backend/scripts/load-test.mjs`** — same endpoint-shape update (GoTrue admin/login,
  PostgREST households), same "hit `auth`/`rest` directly, not through Kong" design as the
  isolation script. Report format (throughput, error rate, p50/p95/p99 for writes vs.
  reads) is unchanged.
- **`.github/workflows/ci.yml`'s `tenant-isolation` job** — no longer downloads a
  PocketBase binary. Instead: writes a real `backend/supabase/.env` with freshly generated
  `POSTGRES_PASSWORD`/`JWT_SECRET`/`ANON_KEY`/`SERVICE_ROLE_KEY` (via
  `generate-supabase-keys.mjs`, same script a real deploy uses), brings up only `db`,
  `auth`, and `rest` via `docker compose up -d --build` (no Kong, no
  realtime/edge-runtime/webauthn/frontend — this job doesn't need them and starting them
  would only slow CI down), polls `docker inspect` for both containers reporting
  `healthy`, then runs `node scripts/test-tenant-isolation.mjs` against their published
  ports. Timeout bumped from 5 to 10 minutes to accommodate `db`'s image build
  (`db.Dockerfile` installs `pgbackrest` on top of `supabase/postgres`) and the `auth`/
  `rest` image pulls, neither of which the old PocketBase-binary-download job had to pay
  for. Always tears the stack down (`docker compose down -v`) whether the job passed or
  failed.

## Design decisions worth calling out

- **Kong is deliberately not part of either script or the CI job.** The migration plan's
  own Phase 7 text says CI should "start Postgres/GoTrue/PostgREST" — not Kong — and
  `apikey` enforcement (the anon/service_role consumer groups in `kong.yml`) is a Kong-only
  concern: neither GoTrue nor PostgREST checks for an `apikey` header itself, both only
  ever look at the `Authorization: Bearer <jwt>`'s `role` claim. This is the same bypass
  `scripts/healthcheck.sh` and the `deploy-prod.ps1`/`deploy.ps1` health checks already use
  (see Phase 6) to avoid a healthy backend reading as a false "unhealthy" 401/403. Testing
  through Kong as well would mostly be testing Kong's declarative config, which is a
  separate (and already-reviewed) concern from tenant data isolation.
- **`service_role`, not a superuser account, plays the old PocketBase-superuser role** for
  seeding fixtures (creating tenants, creating users, creating `system_settings` rows that
  would otherwise require `role=admin` + MFA). `service_role` is a Postgres role with
  `BYPASSRLS` in the `supabase/postgres` image by default — the direct analogue of a
  PocketBase superuser token bypassing every API rule.
- **Load-test/isolation-test users are always `role=staff`, never `role=admin`** — same
  reasoning as the original PocketBase version: `role=admin` always requires an aal2 (MFA)
  session per `app.mfa_satisfied()`, which is a separate, already-covered concern
  (`scripts/bootstrap-platform-admin.mjs`'s own documented next-steps), not something
  these two scripts need to re-exercise. `role=staff` only requires MFA when a tenant's own
  `require_staff_mfa` flag is set, which defaults to `false` and is left `false` for these
  throwaway tenants.

## What's built but NOT yet verified live (needs a real Docker host / CI run)

- **The rewritten CI job itself.** `docker compose up -d --build db auth rest` bringing up
  cleanly in GitHub Actions' runner (image pulls, `db.Dockerfile`'s `pgbackrest` apt
  install, GoTrue's own internal auth-schema migrations running against a freshly
  migrated `public` schema) has not been exercised — only reasoned through against the
  compose file's existing environment variables and each image's documented behavior.
- **The exact PostgREST error body shape for an RLS insert violation** (`{"code":"42501",
  ...}`) is Postgres/PostgREST's well-documented behavior, but was not confirmed against
  this schema's actual `households_insert` policy running live — see Phase 6 for the
  broader "entire compose stack never actually run" caveat this inherits.
- **`load-test.mjs`** was updated for endpoint shape but, per its own header comment, is
  meant to be run manually against a staging instance before a real onboarding wave — it
  is not part of CI and was not run here.

## Explicitly out of scope for this phase

- `scripts/export-data.sh` — still PocketBase-shaped. Flagged in `PHASE6_NOTES.md` as a
  separate, bigger rewrite (different auth model, different per-table export format) that
  neither Phase 6 nor Phase 7's plan text calls out by name; still a known follow-up.
