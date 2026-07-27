-- Global reference/dropdown data (relationship-to-head codes, ethnicity/
-- religion/blood-type option lists, DILG/BIMS indicator lists, etc.) —
-- deliberately NOT tenant-scoped, shared across all barangays alike.
-- Final PocketBase rules:
--   list/view:   @request.auth.id != ""  (any authenticated user, any tenant)
--   create/update/delete: role = "admin"
--
-- "admin" here means ANY tenant's admin can edit shared lookup data in
-- PocketBase today (the rule has no barangay_id check, since lookups has no
-- barangay_id column at all) — preserved as-is; tightening this to
-- platform-admin-only would be a real behavior change out of scope for a
-- 1:1 migration.

create table public.lookups (
  id uuid primary key default gen_random_uuid(),
  "group" text not null,
  values jsonb not null,
  description text
);

alter table public.lookups enable row level security;
alter table public.lookups force row level security;

create policy lookups_select on public.lookups for select
  using (auth.role() = 'authenticated');

create policy lookups_insert on public.lookups for insert
  with check (app.current_role() = 'admin');

create policy lookups_update on public.lookups for update
  using (app.current_role() = 'admin')
  with check (app.current_role() = 'admin');

create policy lookups_delete on public.lookups for delete
  using (app.current_role() = 'admin');
