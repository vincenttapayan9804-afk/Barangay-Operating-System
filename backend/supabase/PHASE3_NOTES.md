# Phase 3 — WebAuthn/passkey sidecar port: status

Same environment constraint as Phases 0-2: no Docker daemon, no GitHub access beyond this repo, so
the ported sidecar could never be run end-to-end against a live GoTrue/PostgREST/Kong stack here.
Everything checkable without them was actually checked; everything that needs a live stack is
built + documented with the exact commands to confirm it on a real Docker host.

## What changed in `backend/webauthn-service/server.mjs`

Direct 1:1 port, same endpoints, same request/response shapes for `register/*` (no change there —
registration only ever returns `{ verified: true }`), same challenge-store logic, same
`@simplewebauthn/server` crypto calls unchanged (per the plan's own wording: "crypto logic is
unchanged"). What moved:

- **PocketBase superuser client -> plain `fetch` calls to PostgREST/GoTrue, authenticated as
  `service_role`.** `webauthn_credentials` CRUD goes straight to `/rest/v1/webauthn_credentials`;
  RLS on that table already has no insert/update policy at all (service-role-only by design, see
  `migrations/0025_webauthn_credentials.sql`), so `service_role`'s RLS bypass is the *only* way
  writes ever happened even under Phase 1's schema — this port doesn't change that property, just
  which HTTP client exercises it.
- **`getUserFromToken` -> `GET /auth/v1/user`.** Same rationale as before (reuse the auth service's
  own token validation instead of reimplementing JWT verification), just GoTrue's endpoint instead
  of PocketBase's `authRefresh`.
- **Email -> user id lookup for login start -> `public.lookup_user_id_by_email` RPC**
  (`migrations/0027_lookup_user_by_email_rpc.sql`, new this phase). Needed because
  `PGRST_DB_SCHEMAS=public` means `auth.users` isn't reachable through PostgREST at all — a
  SECURITY DEFINER function scoped to `service_role` only (never anon/authenticated, since that
  would be an email-existence oracle) is the same narrow-RPC pattern
  `0026_get_public_document_rpc.sql` already established for Hard Part #1. Verified against a real
  Postgres instance: `service_role` resolves a known email, an unknown email resolves to `null`,
  and `authenticated` is denied outright (`backend/supabase/verify/02_seed_and_assertions.sql`'s
  Phase 3 section, 3 new assertions — full suite is now 21 + 8 + 3 = 32/32 passing).
- **`impersonate()` -> Path A from the Phase 0 spike** (`backend/supabase-spike/BUILD_NOTES.md`,
  Unknown #2): `POST /admin/generate_link` (type `magiclink`, no email actually sent) followed by
  the sidecar itself redeeming the link server-side via `POST /auth/v1/verify` using the response's
  **`email_otp`** field specifically — not `action_link`/`hashed_token`, which are meant for a
  *browser* to follow and return tokens in a URL fragment the server never sees. `email_otp` is the
  one field documented to redeem via a plain JSON `POST /verify` call, returning `access_token` +
  `refresh_token` directly. This is the exact design Phase 0 flagged as needing empirical
  confirmation before Phase 3 relies on it — **still not verified live**, see below.

## What's still open — needs a real Docker host

**The plan's literal Phase 3 "done when" bar — passkey-only login survives a page refresh — cannot
be checked in this sandbox at all.** It requires: a live GoTrue instance, a live PostgREST/Kong
front door, a real WebAuthn ceremony (needs a browser or a WebAuthn virtual authenticator, e.g.
Chrome DevTools' "Add a virtual authenticator" or Playwright's CDP WebAuthn support), and a page
reload to prove the refresh token actually works — none of which are SQL-level facts a throwaway
Postgres instance can stand in for, unlike Phases 1-2's RLS logic.

**Verification steps for the first Docker-capable host:**

```
# 1. Bring up the Phase 2 stack (backend/supabase/), bootstrap a user, and
#    have them register a passkey via a real browser (or Playwright +
#    a virtual authenticator) against POST /api/webauthn/register/options
#    and /register/verify while holding a normal password-login session.

# 2. Confirm session-minting returns BOTH tokens (the specific unknown
#    Phase 0 flagged):
curl -s -X POST http://localhost:8091/api/webauthn/login/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"...","assertionResponse": { ... from step 1s ceremony ... }}' | jq
# expect a JSON body with both access_token and refresh_token populated,
# not just one of them.

# 3. THE ACTUAL "done when" CHECK: in a real browser, complete a
#    passkey-only login (frontend's Phase-5-updated login flow calling
#    supabase.auth.setSession({ access_token, refresh_token })), then hard
#    -refresh the page. PASS: the session survives (still logged in) —
#    proves GoTrue's refresh-token flow actually works for a
#    magiclink-minted session, not just that an access token was returned.
#    A session that only had a working access token would look
#    indistinguishable from success until the access token's 1-hour
#    expiry, then silently log the user out — this is exactly the failure
#    mode Phase 0 identified and this check exists to catch.
```

## Known, intentional interim breakage: the frontend

`frontend/src/lib/webauthn.ts:48-53` still expects the OLD PocketBase-shaped response
(`{ token, record }`) and calls `getClient().authStore.save(token, record)`. This service now
returns `{ access_token, refresh_token, user }` instead — a deliberate behavior change, not a bug.
Per the plan, the frontend rewrite (Phase 5) is what updates this call site to
`supabase.auth.setSession({ access_token, refresh_token })`, matching every other auth call site's
move to `@supabase/supabase-js` at the same time. Passkey login will not work end-to-end again
until Phase 5 lands; password login (still PocketBase-backed until Phase 5 too) is unaffected by
this phase's changes.

Similarly, `backend/docker-compose.yml`'s `webauthn` service still wires the old
`PB_URL`/`PB_SUPERUSER_EMAIL`/`PB_SUPERUSER_PASSWORD` env vars, which `server.mjs` no longer reads.
Per the plan, rewiring the full compose file (replacing the `pocketbase` service with
`db`+`auth`+`rest`+`realtime`+`kong`+`edge-runtime` and pointing `webauthn` at
`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`) is explicitly Phase 6's scope
("Infra/ops rebuild"), not Phase 3's — this phase only ports the sidecar's own code, matching its
"done when" bar being about the session-minting mechanism, not deployment wiring.
