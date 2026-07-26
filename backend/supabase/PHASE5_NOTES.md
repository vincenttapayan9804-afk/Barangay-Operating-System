# Phase 5 — Frontend rewrite to @supabase/supabase-js: status

Same environment constraint as Phases 0-4: no live Supabase stack reachable from this
sandbox (no Docker, no network to a real Postgres/GoTrue/PostgREST/Kong/Edge Functions
deployment). Everything checkable without one was actually checked — `lint`/`tsc`/`test`/
`build` are all green — but the plan's actual "done when" bar (a full Playwright pass
against the new backend) needs a real host, same as every prior phase's live-verification
gap.

## What changed

- `@supabase/supabase-js` added (`frontend/package.json`).
- `frontend/src/lib/supabaseClient.ts` (new) — the real-backend client singleton.
- `frontend/src/api/supabaseFilters.ts` (new) — `orIlike()`/`orEq()`, the shared, escaped
  `.or()`-string builders that replace the ~5 hand-built (and in one case, entirely
  unescaped) PocketBase filter-string templates the plan calls out
  (`households.ts`/`lookups.ts`/`settings.ts`/`platformAdmin.ts`/`useGlobalSearch.ts`).
- `frontend/src/api/types.ts` (new) — `BaseRecord`, replacing `RecordModel` (from the
  `pocketbase` package) as every `ApiXxx` interface's base shape; real rows have no
  `collectionId`/`collectionName`, just the 1:1-mirrored columns Phase 1 built.
- All 26 `frontend/src/api/*.ts` files that touched a backend were rewritten (`reports.ts`
  and `upload.ts` needed no change — the former only composes other api/*.ts calls, the
  latter talks to Cloudinary, not the app backend).
- `auth/session.ts`, `lib/webauthn.ts`, `hooks/useRealtimeCollection.ts` rewritten around
  `supabase.auth.*` / `supabase.channel(...).on('postgres_changes', ...)` /
  `supabase.auth.setSession(...)`.
- `notifications.ts` / `searchSync.ts` / `useGlobalSearch.ts`'s Meilisearch proxy calls now
  go through `supabase.functions.invoke(...)`.
- `App.tsx`, `auth/LoginPage.tsx`, `features/settings/PasskeySettings.tsx`,
  `features/settings/SystemSettings.tsx`, `features/settings/demoData.ts`,
  `features/agenda/AgendaPage.tsx`, `offline/syncManager.ts`, `lib/apiConfig.ts`,
  `lib/export.ts` updated for the new auth/session shape and/or their own direct backend
  calls.
- **`mockPocketBase.ts`, `demoAccounts.ts`, `demoSeed.ts` are untouched** — demo mode is a
  self-contained localStorage sandbox with no real backend dependency, exactly as the plan
  specifies.

## The demo/real split

Every api/*.ts file now branches on `isDemoModeEnabled()`:

```ts
if (isDemoModeEnabled()) {
  // unchanged PocketBase-shaped call via getClient() (the mock)
} else {
  // supabase.from('table')... / supabase.rpc(...) / supabase.functions.invoke(...)
}
```

This is the one structural decision this phase made beyond the plan's literal wording:
the plan says api/*.ts files get "rewritten ... to `supabase.from('x').select/insert/...`"
and, separately, that `mockPocketBase.ts` stays untouched. Both are true simultaneously
only if the real and demo code paths coexist side by side in each file — there's no way to
satisfy "demo mode still works, unmodified" and "real backend calls are pure supabase-js"
without a branch somewhere. `client.ts`'s `getClient()` is now demo-mode-only (it throws if
called outside demo mode, so a missed branch fails loudly instead of silently touching fake
local data); the real backend goes through `lib/supabaseClient.ts`'s `getSupabase()`.

`api/client.ts`'s old `beforeSend` hook (which stamped a missing `barangay_id` onto every
create) is gone — Phase 1's schema already defaults every tenant-scoped table's
`barangay_id` column to `app.current_barangay_id()`, so real-mode inserts don't need to set
it at all; demo mode's mock client does the equivalent stamping itself (unchanged).

## MFA: a real, plan-consistent flow change

PocketBase's admin MFA was email-OTP (`requestOTP`/`authWithOTP`). Phase 2 already decided
Supabase's side would be TOTP (`docs/SUPABASE_MIGRATION_PLAN.md` Hard Part #2) — and
critically, GoTrue's login flow doesn't block on MFA itself: `signInWithPassword` always
succeeds and returns a valid (aal1) session; it's `app.mfa_satisfied()` in RLS that then
refuses tenant data pre-aal2. So `auth/session.ts`'s `login()` now checks
`supabase.auth.mfa.getAuthenticatorAssuranceLevel()` right after a successful password
sign-in, and if the account needs aal2, issues an MFA challenge itself and returns
`{ mfaRequired: true, factorId, challengeId }` instead of PocketBase's `{ mfaId }`.
`auth/LoginPage.tsx`'s second-factor screen now asks for an authenticator app code instead
of "we emailed you a code," and its "resend" button issues a fresh challenge (TOTP codes
aren't emailed, so there's nothing to resend — a new challengeId just gives the user a new
30-second window).

## A new Edge Function, surfaced by this phase (not a port)

`platformAdmin.ts`'s `createBarangayAdmin()` — used by `/platform-admin` to onboard a new
barangay's first admin — POSTed directly to PocketBase's `users` collection, because
PocketBase's auth collection is just a collection with API rules: any client satisfying
`(body.barangay_id = auth.barangay_id && role="admin") || is_platform_admin` could create a
user record, including setting its password. Supabase splits this: creating an
`auth.users` row is a GoTrue admin operation gated to the `service_role` key, which must
never reach the frontend (`GOTRUE_DISABLE_SIGNUP=true` also rules out open self-registration
as a workaround). So this phase adds
`backend/supabase/functions/create-barangay-admin/index.ts` — checks
`requireUser(req).isPlatformAdmin`, then calls `/auth/v1/admin/users` with the service-role
key server-side, same shape as `backend/scripts/bootstrap-platform-admin.mjs`'s own call.
Not a pb_hooks port (there was no such route — PocketBase didn't need one), but a
capability that has to exist somewhere once the frontend can't do this directly anymore.

## Two pre-existing bugs fixed as a direct consequence of the rewrite

- **`settings.ts`'s `getFinanceConfig`/`updateFinanceConfig`** read/wrote a `finance_config`
  field that was never a real column (`system_settings` only has `key`/`value`) — PocketBase
  silently ignores unknown fields on write and returns `undefined` for unknown fields on
  read, so this was a silent no-op that just happened to never error. PostgREST rejects
  unknown JSON keys with a 400, which would have turned a silent no-op into a hard failure
  under the exact same call pattern. Fixed to actually read/write the `value` column (what
  `upsertSetting('barangay_config', ...)` already writes to) — this is the first version
  where finance config persistence actually works, not a functional regression.
- **`lookups.ts`'s `getLookup()`** built its single-quoted-value filter as a raw
  `` `group = "${group}"` `` template with no escaping. Ported to the same escaped
  `.filter()`/`orEq()`-style construction used everywhere else (both the demo and real
  paths), closing the same bug class the plan calls out for the other four files.

## What's still open — needs a real Supabase-stack host

- The plan's literal "done when" bar: a full Playwright pass (login incl. MFA and passkey,
  resident CRUD, document lifecycle + email, cross-session realtime, public verify page)
  against a live Phase 2+3+4 stack. Not runnable here (no Docker/network).
- `backend/supabase/kong.yml` has no `/functions/v1` or `/realtime/v1` route yet — Phase 4's
  Edge Functions and this phase's `supabase.functions.invoke(...)`/realtime-channel calls
  are written against the standard self-hosted-Supabase URL conventions, but wiring the
  actual Kong routes is Phase 6's job (infra/ops rebuild), not this one.
- `lib/apiConfig.ts`'s reachability check now hits `/auth/v1/health` (GoTrue's own health
  endpoint) instead of PocketBase's `/api/health` — reachability is inferred from getting
  *any* HTTP response (even a 401 from Kong's key-auth plugin), not a 200, since this
  endpoint may or may not require an apikey depending on how Phase 6 finalizes Kong's
  routing. Worth re-checking once that's settled.
- `lib/export.ts`'s `triggerExport()` remains dead code (no callers, and the
  `/api/collections/*/export` route it targets was never implemented in pb_hooks either —
  confirmed by grep). Left unwired, just updated its token lookup so it isn't a landmine
  pointed at a since-removed localStorage key if it's ever picked back up.
