# Phase 2 — Auth layer: status

Same environment constraint as Phase 0 (`backend/supabase-spike/BUILD_NOTES.md`): this sandbox has
no working Docker daemon and GitHub access scoped to this one repo, so the actual GoTrue/PostgREST/
Kong binaries can never run here. Everything provable without them was actually run; everything that
needs a live stack is built + documented with the exact commands to confirm it on a real Docker host.

## What was verified here (SQL/RLS layer — the actual enforcement mechanism)

MFA gating (Hard Part #2's "done when" bar: flip `require_staff_mfa`, staff gets gated immediately)
is enforced in `app.mfa_satisfied()` (`migrations/0000_auth_helpers.sql`), which every RLS-facing
claim helper (`current_barangay_id()`, `current_role()`, `is_platform_admin()`) now funnels through:
a `require_mfa=true` claim without an `aal=aal2` session claim collapses all three helpers to a
"nothing matches" value, denying every RLS policy in one place rather than needing a bolted-on MFA
clause across all ~90 policies in `migrations/0001-0026`.

Verified against the same real (throwaway) Postgres 16 database as Phase 1
(`backend/supabase/verify/`, re-run in full after this change — all 21 Phase 1 assertions still
pass unchanged), plus 8 new assertions in `verify/02_seed_and_assertions.sql`:

- admin pre-MFA (aal1): 0 rows anywhere, even their own tenant; post-MFA (aal2): normal access restored
- staff at a `require_staff_mfa=false` tenant: unaffected by aal at all (opt-in per tenant, per
  `1785000033_mfa_extend_to_staff.js`)
- staff at a `require_staff_mfa=true` tenant: gated exactly like an admin until aal2
- **the literal "done when" wording**: flip `require_staff_mfa` on a previously-unrequired tenant
  mid-script and prove a staff member there is immediately gated on their very next request, with no
  re-seed/re-login/cache-bust
- `is_platform_admin()` is gated the same way — a platform admin pre-aal2 sees zero barangays, not
  even the "Platform Operations" tenant they belong to

Run it yourself: `cd backend/supabase && sudo -u postgres psql -f verify/00_test_env.sql -d <db>`,
then all of `migrations/0*.sql` in order, then `verify/01_grants.sql`, then
`verify/02_seed_and_assertions.sql` — same procedure as Phase 1, see that directory's own comments.

## What's built but NOT yet verified live (needs a real Docker host)

- `docker-compose.yml` — `db` (supabase/postgres:15.8.1.040) + `auth` (supabase/gotrue:v2.170.0) +
  `rest` (postgrest/postgrest:v12.2.8) + `kong` (kong:2.8), migrations auto-applied via
  `init-migrations.sh` on first boot.
- `kong.yml` — trimmed self-hosted-Supabase declarative config: `/auth/v1/*` and `/rest/v1/*`
  routes, `anon`/`service_role` API-key consumers via the `key-auth` + `acl` plugins.
- `scripts/generate-supabase-keys.mjs` — generates `ANON_KEY`/`SERVICE_ROLE_KEY` JWTs from
  `JWT_SECRET`. **This one WAS actually run and independently signature-verified** (no Docker
  needed, it's pure Node crypto) — see the commit history for the manual HMAC cross-check.
- `scripts/bootstrap-platform-admin.mjs` — calls GoTrue's `POST /auth/v1/admin/users` to create the
  first platform-admin account (replaces PocketBase's manual superuser-panel step from
  `1785000028_platform_admin.js`'s own comment).

**Verification steps for the first Docker-capable host:**

```
cd backend/supabase
cp .env.example .env
# fill in POSTGRES_PASSWORD, JWT_SECRET (openssl rand -base64 48 for each)
node ../scripts/generate-supabase-keys.mjs .env    # paste ANON_KEY/SERVICE_ROLE_KEY into .env
docker compose up -d
docker compose logs db | grep "Applying"           # confirm all 27 migration files ran

# 1. GOTRUE_DISABLE_SIGNUP=true is live — open signup must be refused:
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/auth/v1/signup \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"nope@example.com","password":"whatever123"}'
# expect 422/404, not 200

# 2. Bootstrap the first platform admin:
SUPABASE_URL=http://localhost:8000 SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
  PLATFORM_ADMIN_EMAIL=you@example.com PLATFORM_ADMIN_PASSWORD='...' \
  node ../scripts/bootstrap-platform-admin.mjs

# 3. Log in (aal1) and confirm the custom access-token hook fired:
curl -s -X POST "http://localhost:8000/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"..."}' | jq -r .access_token | cut -d. -f2 | base64 -d
# expect app_metadata.role=admin, is_platform_admin=true, require_mfa=true, aal=aal1

# 4. MFA GATING LIVE END-TO-END — the actual Phase 2 "done when" bar:
curl -s http://localhost:8000/rest/v1/barangays -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ACCESS_TOKEN"
# expect [] (empty) at aal1, matching the SQL-level assertion already proven above

# 5. Enroll + verify TOTP (per bootstrap script's printed next steps), then repeat step 4's
#    curl with the resulting aal2 token: expect the real barangays rows this time.

# 6. Flip require_staff_mfa on a tenant live and confirm a staff session already holding an
#    aal1 token for that tenant is blocked on its very next request (no new login needed) --
#    the exact plan wording, now proven against a real GoTrue-issued token instead of a
#    hand-built claims object.
```

## Bootstrap script design notes

`bootstrap-platform-admin.mjs` intentionally does NOT attempt to enroll MFA itself — TOTP
enrollment needs an interactive QR-code scan in an authenticator app, not something a
non-interactive bootstrap script should try to automate. It creates the account and prints the
exact next steps (enroll -> challenge -> verify) as its output, which is also why step 1 (login)
correctly returns zero rows everywhere per `app.mfa_satisfied()` until step 2-3 completes: that's
this phase's whole point being demonstrated on the very first real login, not a bug to work around.
