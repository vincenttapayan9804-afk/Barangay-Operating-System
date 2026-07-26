# Migration Plan: PocketBase (SQLite) → Self-Hosted Supabase (Postgres)

**Status: proposed, not started.** This document is the plan only — no migration code has been
written yet. It exists so the migration can be reviewed and executed phase by phase, the same way
prior features on this platform were (each phase independently shippable and verified before the
next begins).

## Why

BarangayOS/CLUSTR is targeting **500+ tenants (barangays)**. PocketBase's SQLite backend has a
single writer lock for the *entire* database, not per tenant — every barangay's writes queue
behind each other. That's the platform's core structural scaling risk, already flagged in
`docs/DEPLOYMENT.md` §7. PocketBase has no official Postgres support and no plans to add it, so
solving this means leaving PocketBase, not reconfiguring it.

We're moving to a **self-hosted** Supabase stack (Postgres + PostgREST + GoTrue + Realtime + Kong,
all open source, run via Docker on our own VM) — not Supabase Cloud. Same "we own the box, no
vendor bill" model this platform already uses for PocketBase, but with Postgres's real concurrent
writers instead of SQLite's global lock, at a realistic hosting cost of roughly $35–90/month
(vs. Supabase Cloud pricing that would run well into the hundreds/month at this data volume).

## Cutover strategy: clean cutover, no dual-write machinery

There is currently **no live production backend anywhere** for this app — the only live artifact
is the frontend-only GitHub Pages demo shell, which has no real backend behind it and is out of
scope here. That means there's no live traffic or real tenant data to protect during a transition,
so building dual-write/gradual-cutover infrastructure (CDC sync, conflict resolution, per-tenant
cutover flags) would be pure overhead with no payoff.

This is "finish the correct backend before go-live," not "migrate a live system." PocketBase never
needs to serve real production traffic — it can be deleted once the Supabase stack passes its own
verification. Rollback pre-cutover is just `git revert` — no data to reconcile.

**Tripwire:** if a real pilot deployment with real barangay data happens on PocketBase before this
ships, that changes the calculus — see Phase 8.

## PocketBase rule → Postgres RLS mapping (applied uniformly across all tables)

| PocketBase rule | Postgres equivalent |
|---|---|
| `listRule`/`viewRule` | `SELECT` policy `USING (barangay_id = app.current_barangay_id() AND <role fragment>)` |
| `createRule` | `INSERT` policy `WITH CHECK (...)` **+** `barangay_id DEFAULT app.current_barangay_id()` — this replaces `frontend/src/api/client.ts`'s client-side `beforeSend` tenant-stamping hook with a server-side default, strictly better than trusting the client at all |
| `updateRule` | `UPDATE` policy needs **both** `USING` (pre-update visibility) and `WITH CHECK` (re-pins `barangay_id`, blocking a tenant-reassignment update — Postgres splits these two phases where PocketBase's rule string didn't) |
| `deleteRule` | `DELETE` policy `USING (...)` |
| `null` rule | No policy for that command — RLS defaults deny-all once enabled, a clean 1:1 mapping |
| `"own record"` (e.g. blotter's `auth.id = created_by`) | `created_by uuid DEFAULT auth.uid()` + `auth.uid() = created_by` in the policy |

Helper functions (`db/migrations/0000_auth_helpers.sql`), reading claims injected by a
`custom_access_token_hook` at token-mint time:
```sql
create schema if not exists app;
create function app.current_barangay_id() returns uuid stable language sql as
  $$ select nullif(auth.jwt()->'app_metadata'->>'barangay_id','')::uuid $$;
create function app.current_role() returns text stable language sql as
  $$ select auth.jwt()->'app_metadata'->>'role' $$;
create function app.is_platform_admin() returns boolean stable language sql as
  $$ select coalesce((auth.jwt()->'app_metadata'->>'is_platform_admin')::boolean, false) $$;
create function app.has_aal2() returns boolean stable language sql as
  $$ select auth.jwt()->>'aal' = 'aal2' $$;
```

`backend/pb_migrations/1785000027_multi_tenant_barangays.js`'s `specs` array (the role-fragment
per collection) is the mechanical source of truth for translating all ~20 tenant-scoped
collections' policies — table by table, not redesigned from scratch.

## The genuinely hard parts

**1. `document_requests`'s public "view by ID" (QR verification) has no direct RLS equivalent.**
PocketBase lets `listRule` and `viewRule` differ; Postgres RLS has one `SELECT` policy governing
both. Porting the rule as-is would make every released document across every tenant listable via
PostgREST, and over-expose internal fields. Fix: a `SECURITY DEFINER` RPC function
(`get_public_document(doc_id)`) returning only safe columns for `status = 'released'`, granted to
`anon`, with the underlying table `REVOKE`d from `anon`. Not enumerable, field-redacted — closer to
the intended design than PocketBase's current behavior.

**2. MFA rule replication as JWT claims.** PocketBase's `mfa.rule` does a live relation-traversal
(`barangay_id.require_staff_mfa`) per login. GoTrue has no equivalent "who must MFA" primitive.
Fix: the `custom_access_token_hook` computes a `require_mfa` claim at mint time (joining
`profiles` + `barangays.require_staff_mfa`), and RLS gates mutations on
`(require_mfa = false) OR app.has_aal2()`. **Real trade-off, needs your call:** GoTrue's native
MFA is TOTP (authenticator app), not emailed one-time codes. Preserving the exact current UX means
a fully custom MFA flow that fights the platform; adopting TOTP is the supported, lower-risk path
but is a real user-facing change. **I'll default to switching to TOTP (Recommended) unless you
tell me otherwise** — flag it if you want the emailed-code UX preserved or both offered; either is
buildable, just more engineering surface.

**3. WebAuthn "impersonate" has no 1:1 GoTrue equivalent.** PocketBase's sidecar mints a session
for an arbitrary verified user via a single superuser call. Two self-hosted-only paths: (A)
`POST /admin/generate_link` (magiclink, no email sent) redeemed server-side for a real token pair —
try first; (B) since we control GoTrue's `JWT_SECRET` directly (impossible on Supabase Cloud, fine
self-hosted), an Edge Function manually mints a correctly-signed access token and inserts a
matching `auth.refresh_tokens` row. Whichever path: **must** return both access and refresh
tokens, or the session silently breaks on page refresh (access-token TTL expires, no refresh path).
Validated empirically in Phase 0 before Phase 3 builds on it.

**4. Global (not tenant-scoped) email uniqueness** — not actually hard, GoTrue's `auth.users.email`
is globally unique by default, matching PocketBase's existing intentional behavior. No special
handling needed.

**5. Realtime + RLS interaction** — needs `ALTER PUBLICATION supabase_realtime ADD TABLE <table>`
per table, plus empirical confirmation the self-hosted Realtime image actually respects RLS on
`postgres_changes` broadcasts (not just initial fetch), verified in Phase 0.

## Phases

**Phase 0 — Spike (no production impact).** Stand up a throwaway self-hosted Supabase stack
locally. Close three unknowns before building around assumptions: the access-token hook actually
injects the right claims; the WebAuthn session-minting path (A or B) actually works end-to-end
including refresh; Realtime `postgres_changes` respects RLS on the image version we'll run. Done
when each has a confirmed working mechanism written up as build notes.

**Phase 1 — Schema + RLS foundation.** `backend/supabase/migrations/`, mirroring the 20-migration
history 1:1 by intent (not squashed — the tenant-scoped-uniqueness bug history etc. stays as
committed knowledge). All 27 collections → tables with `barangay_id` + RLS per the mapping above,
`profiles` table + `auth.users` insert trigger, tenant-scoped composite unique indexes
(`households(barangay_id, household_number)` etc.), the `get_public_document` RPC,
`webauthn_credentials` (service-role-write-only). Done when RLS isolation is provable via psql-level
simulated sessions, before any API code exists.

**Phase 2 — Auth layer.** `db` + `auth` (GoTrue) + `rest` (PostgREST) + `kong`, custom
access-token hook wired, `GOTRUE_DISABLE_SIGNUP=true` (no open registration, matches today), TOTP
MFA per the decision in Hard Part #2. New `backend/scripts/bootstrap-platform-admin.mjs` — the
same one-time manual bootstrap PocketBase requires today, just as a runnable script instead of raw
superuser-panel clicks. Done when MFA gating is proven live (flip `require_staff_mfa`, staff gets
gated immediately).

**Phase 3 — WebAuthn/passkey sidecar port.** Swap the PocketBase superuser client for
service-role-authenticated PostgREST calls; crypto logic (`@simplewebauthn/server`) is unchanged;
swap `impersonate()` for the Phase-0-validated session-minting path. Done when passkey-only login
survives a page refresh (proves the refresh token path, not just the access token).

**Phase 4 — Custom backend logic → Edge Functions.** Direct behavioral ports of
`backend/pb_hooks/notify.pb.js` (document-status / hearing-scheduled emails) and `search.pb.js`
(Meilisearch index/query proxy, same forced-`barangay_id`-from-session, same per-role index
visibility). SMTP moves from PocketBase's Admin-UI-only config to explicit env vars (a real,
documented behavior change). Done when a status change sends the same email content and a resident
create produces a correctly tenant-scoped Meilisearch upsert.

**Phase 5 — Frontend rewrite.** `@supabase/supabase-js` in, all ~29 `frontend/src/api/*.ts` files
rewritten from `getClient().collection(x).getList/create/...` + templated filter strings to
`supabase.from('x').select/insert/...` + PostgREST's query builder (which also closes off the
hand-escaped-filter-string bug class in `households.ts`/`lookups.ts`/`settings.ts`/
`platformAdmin.ts`/`useGlobalSearch.ts` by construction). Realtime hook → `postgres_changes`
channels. Auth/session/guards rebuilt around `supabase.auth.*`. WebAuthn's final step becomes
`supabase.auth.setSession({ access_token, refresh_token })`. `notifications.ts`/`searchSync.ts`
become `supabase.functions.invoke(...)`. **`mockPocketBase.ts` (demo mode) is explicitly untouched**
— it's a self-contained localStorage sandbox with no real backend dependency. Done when
lint/tsc/test/build are all green and a full Playwright pass (login, resident CRUD, document
lifecycle + email, cross-session realtime, public verify page) is green against the new backend.

**Phase 6 — Infra/ops rebuild.** New `docker-compose.yml`: `db`, `auth`, `rest`, `realtime`,
`kong`, `edge-runtime`, `meilisearch` (unchanged), `webauthn`, plus Postgres backups
(pgBackRest/WAL-G to the same S3-compatible bucket, replacing `litestream.yml`). Healthchecks added
to every service (a real gap in the current compose file). **Supavisor connection pooler
recommended from day one** — Postgres's per-connection memory cost makes unpooled connections risky
at 500+ tenants, a consideration that never existed under SQLite. Storage is explicitly **not**
stood up — zero PocketBase file-field usage exists in this codebase today (confirmed by exhaustive
grep; the only two file-like fields are a base64 text column and a Cloudinary URL string), so it's
deferred until an actual file-upload feature needs it. `check-scale-signals.mjs` rewritten around
`pg_stat_statements`/`pg_stat_activity`/`pg_database_size()` instead of PocketBase's
`/api/logs.execTime` + nginx connection count. `DEPLOYMENT.md`/`ARCHITECTURE.md` rewritten to match.

**Phase 7 — Testing & CI port.** `test-tenant-isolation.mjs` rewritten to PostgREST/GoTrue endpoint
shapes (confirmed portable — it's black-box HTTP assertions, not coupled to PocketBase's specific
rule-string mechanism); one assertion's expected status code changes (`400` → `403`/`42501` for a
blocked spoofed insert). `load-test.mjs` same endpoint-shape update. CI's `tenant-isolation` job
swaps "download PocketBase binary" for "start Postgres/GoTrue/PostgREST + apply SQL migrations."
Done when CI is green and a load test has run once against staging before the first real tenant
onboarding.

**Phase 8 — Cutover.** Once Phases 1–7 are each independently verified: delete
`backend/pb_hooks/`, `backend/pb_migrations/`, `backend/pocketbase.exe`, `backend/litestream.yml`,
the PocketBase compose service, the `pocketbase` npm dependency; run the real bootstrap script;
resume barangay onboarding via `/platform-admin` (UX preserved exactly, only its internal calls
change per Phase 5's pattern). Rollback pre-cutover is `git revert`; post-cutover it's an ordinary
Postgres backup restore, not a cross-backend operation. Re-check the tripwire: if real tenant data
now exists on a PocketBase pilot, insert a one-off export/import during a short announced
maintenance window before deleting anything.

## Open decision needing your call

**MFA UX (Hard Part #2):** switch to TOTP authenticator-app MFA (my recommendation — supported,
lower-risk path), keep the current emailed-one-time-code UX (more custom code, more maintenance),
or offer both (most flexible, most work). I'll proceed with TOTP as the default when Phase 2
starts unless you say otherwise.

## Reference files (for whoever implements each phase)

- `backend/pb_migrations/1785000027_multi_tenant_barangays.js` — RLS policy source of truth
- `backend/pb_migrations/1785000029_admin_mfa.js`, `1785000033_mfa_extend_to_staff.js` — MFA rule to replicate
- `backend/pb_migrations/1785000034_public_document_verification.js` — public-verify semantics to preserve
- `backend/webauthn-service/server.mjs` — sidecar to port
- `frontend/src/api/client.ts` — tenant-stamping hook being replaced by server-side `DEFAULT`
- `backend/pb_hooks/search.pb.js`, `notify.pb.js` — logic to port to Edge Functions
- `backend/scripts/test-tenant-isolation.mjs` — regression test to port
