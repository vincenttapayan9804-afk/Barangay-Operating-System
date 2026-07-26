# Migration numbering & approach

This directory is the target of docs/SUPABASE_MIGRATION_PLAN.md Phase 1. Source of truth for
every table/rule below is `backend/pb_migrations/` as of the latest commit — extracted collection
by collection (all 25 PocketBase migration files read in order, cumulative final state).

**Each file is the collection's *final* schema**, not a replay of PocketBase's incremental history.
Replaying every intermediate step (e.g. the required→optional bool fixes, the ethnicity ALL-CAPS→
mixed-case fix, the global→tenant-scoped unique index change) would migrate through broken
intermediate states that never need to exist in a fresh Postgres schema — there is no live data to
carry through them (see the plan's own "Cutover strategy" section: no live production backend
exists yet). Where a fix or bug fix in the PocketBase history changed a real decision (not just a
typo), it's preserved as a comment in the relevant file instead — so the "committed knowledge" the
plan asks to keep (e.g. `1785000031_tenant_scoped_uniqueness.js`'s cross-tenant collision bug) stays
visible to whoever reads this schema next, without needless replay.

One file per collection (plus foundation files 0000-0004), applied in filename order:

| File | Contents |
|---|---|
| `0000_auth_helpers.sql` | `app` schema + JWT-claim helper functions (validated in Phase 0 spike) |
| `0001_barangays.sql` | Tenant registry (also the `require_staff_mfa` per-tenant MFA toggle) |
| `0002_profiles.sql` | `profiles` table + `auth.users` insert trigger |
| `0003_custom_access_token_hook.sql` | The real hook (Phase 0 spike used stand-in tables; this is the same logic against real `profiles`/`barangays`) |
| `0004_lookups.sql` | Global (non-tenant-scoped) reference data |
| `0005`-`0025` | One file per remaining collection (21 files), dependency order (parents before children) |
| `0026_get_public_document_rpc.sql` | Public QR-verification RPC (Hard Part #1 in the plan) |

Verified against a real (throwaway) Postgres instance in `backend/supabase/verify/` — see that
directory's own comments for how to re-run it. 21/21 assertions passing across a representative
cross-section of the schema (not just one demo table): tenant isolation, the admin-only/staff-only/
viewer-excluded role variations, own-record-only update (blotter_records), immutable logs
(activity_logs, finance_audit_logs), the public document RPC (including the anon-direct-access
REVOKE), and the user-scoped-not-tenant-scoped webauthn_credentials table. This is also how a real
bug was caught before it ever reached a running stack: `custom_access_token_hook` needed
`SECURITY DEFINER` to read `profiles`/`barangays` regardless of the calling role's own RLS — without
it, the hook silently fell into its "no profile found" branch for every real login.

## Relation → foreign key mapping decision

PocketBase's `cascadeDelete: false` on a relation does not mean "restrict" in the SQL sense — it
means "silently clear the reference on the referencing record when the target is deleted." That
doesn't translate cleanly to NOT NULL columns (e.g. `document_requests.resident_id` is required),
and silently orphaning a government record's reference is worse than blocking the delete. This
schema instead maps:

- `cascadeDelete: true` → `ON DELETE CASCADE` (the two real cases: `meetings → agenda_items`,
  `households → household_members` / `households → migrant_info`)
- `cascadeDelete: false` **and required** → `ON DELETE RESTRICT` (block deleting a resident/
  household/meeting/etc. while records still reference it — safer default for audit-relevant
  government data than PocketBase's silent-null behavior)
- `cascadeDelete: false` **and optional** → `ON DELETE SET NULL` (e.g. `assigned_to`, `created_by`
  user references — removing a staff account shouldn't delete their historical records)

## RLS pattern applied uniformly

Per docs/SUPABASE_MIGRATION_PLAN.md's mapping table:

```sql
alter table public.<table> enable row level security;
alter table public.<table> force row level security;

create policy <table>_select on public.<table> for select
  using (barangay_id = app.current_barangay_id() and <role fragment>);

create policy <table>_insert on public.<table> for insert
  with check (barangay_id = app.current_barangay_id() and <role fragment>);
  -- barangay_id also has DEFAULT app.current_barangay_id() so a client that
  -- omits it entirely still gets stamped server-side, replacing
  -- frontend/src/api/client.ts's beforeSend tenant-stamping hook.

create policy <table>_update on public.<table> for update
  using (barangay_id = app.current_barangay_id() and <role fragment>)
  with check (barangay_id = app.current_barangay_id() and <role fragment>);
  -- WITH CHECK re-pins barangay_id, blocking a tenant-reassignment update —
  -- Postgres splits visibility (USING) from the post-write check (WITH
  -- CHECK) where PocketBase's single rule string didn't.

create policy <table>_delete on public.<table> for delete
  using (barangay_id = app.current_barangay_id() and <role fragment>);
```

A PocketBase rule of `null` (nobody, not even superuser-bypassed-API) becomes: no policy for that
command at all — RLS defaults deny-all once enabled, a clean 1:1 mapping, same as the plan states.

## MFA gating (added in Phase 2, `0000_auth_helpers.sql`)

`app.has_aal2()`/`app.requires_mfa()` existed since Phase 1 but were unused by any policy. Phase 2
wires them up via a new `app.mfa_satisfied()` function that every claim helper used across
`0001-0026` (`current_barangay_id()`, `current_role()`, `is_platform_admin()`) now funnels through:
when a session's `require_mfa` claim is true but its `aal` claim isn't `aal2`, all three helpers
collapse to a value that satisfies no policy, denying access everywhere in one place instead of
retrofitting an MFA clause onto ~90 individual policies. This reproduces PocketBase's `mfa.rule`
(`1785000029_admin_mfa.js`/`1785000033_mfa_extend_to_staff.js`) — which blocked the entire session
until the second factor completed — on top of GoTrue's own model, where login always issues an aal1
token regardless of role and MFA is enforced by whoever reads the session, not by GoTrue itself. See
`backend/supabase/PHASE2_NOTES.md` for the verification run (21 Phase 1 assertions unchanged + 8 new
MFA-gating assertions, including the plan's literal "flip `require_staff_mfa`, staff gets gated
immediately" wording).
