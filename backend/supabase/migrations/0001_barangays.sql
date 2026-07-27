-- Tenant registry. Every other tenant-scoped table's barangay_id points here.
-- Final PocketBase rules (after 1785000027 + 1785000028_platform_admin.js +
-- 1785000033_mfa_extend_to_staff.js's require_staff_mfa addition):
--   list/view: id = @request.auth.barangay_id || is_platform_admin
--   create/update: is_platform_admin only
--   delete: null (nobody via API — deliberate, tenant deletion is a manual/
--            scripted superuser-only operation, matches the plan's "tenant
--            offboarding is a deliberate manual/scripted op, not a cascade")

create extension if not exists pgcrypto;

create table public.barangays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  municipality_city text,
  province text,
  region text,
  active boolean not null default true,
  require_staff_mfa boolean not null default false,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create or replace function app.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.barangays
  for each row execute function app.set_updated_at();

alter table public.barangays enable row level security;
alter table public.barangays force row level security;

create policy barangays_select on public.barangays for select
  using (id = app.current_barangay_id() or app.is_platform_admin());

create policy barangays_insert on public.barangays for insert
  with check (app.is_platform_admin());

create policy barangays_update on public.barangays for update
  using (app.is_platform_admin())
  with check (app.is_platform_admin());

-- No delete policy: matches PocketBase's deleteRule = null.

-- Seed the "Platform Operations" pseudo-tenant (1785000028_platform_admin.js)
-- — not a real barangay, just a home for platform-ops accounts so they still
-- satisfy the required barangay_id FK like any other user.
insert into public.barangays (id, name, active)
values ('00000000-0000-0000-0000-000000000000', 'Platform Operations', true)
on conflict (id) do nothing;
