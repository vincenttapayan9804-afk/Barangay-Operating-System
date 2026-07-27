-- Phase 0 spike verification for docs/SUPABASE_MIGRATION_PLAN.md unknown #1:
-- "the access-token hook actually injects the right claims" — plus a bonus
-- check that RLS policies driven by those claims actually isolate tenants
-- (the mechanism Phase 1 depends on).
--
-- Run with: psql -v ON_ERROR_STOP=1 -f verify-hook.sql
-- A clean exit (only NOTICE/PASS lines, no ERROR) means every assertion
-- below passed.

\set ON_ERROR_STOP on

\i auth-stubs.sql
\i auth-hook.sql

-- ---------------------------------------------------------------------
-- Seed two tenants: one with staff MFA off (default), one with it on.
-- ---------------------------------------------------------------------
truncate app.spike_profiles cascade;
truncate app.spike_barangays cascade;

insert into app.spike_barangays (id, name, require_staff_mfa) values
  ('00000000-0000-0000-0000-00000000000a', 'Barangay A (MFA off)', false),
  ('00000000-0000-0000-0000-00000000000b', 'Barangay B (MFA on)', true),
  ('00000000-0000-0000-0000-0000000000ff', 'Platform Operations', false);

insert into app.spike_profiles (id, role, barangay_id, is_platform_admin) values
  ('10000000-0000-0000-0000-000000000001', 'admin',  '00000000-0000-0000-0000-00000000000a', false), -- admin A
  ('10000000-0000-0000-0000-000000000002', 'staff',  '00000000-0000-0000-0000-00000000000a', false), -- staff A (no MFA)
  ('10000000-0000-0000-0000-000000000003', 'staff',  '00000000-0000-0000-0000-00000000000b', false), -- staff B (MFA required)
  ('10000000-0000-0000-0000-000000000004', 'admin',  '00000000-0000-0000-0000-0000000000ff', true);   -- platform admin

create or replace function app.spike_assert(label text, actual text, expected text) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected % got %', label, expected, actual;
  end if;
  raise notice 'PASS %', label;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Hook output for each role scenario
-- ---------------------------------------------------------------------
do $$
declare
  base_event jsonb := '{"claims": {"aud":"authenticated","role":"authenticated","app_metadata":{},"user_metadata":{}}}'::jsonb;
  r jsonb;
begin
  -- admin A: admin role always requires MFA, regardless of tenant setting
  r := public.custom_access_token_hook(jsonb_set(base_event, '{user_id}', '"10000000-0000-0000-0000-000000000001"'));
  perform app.spike_assert('admin A: barangay_id', r->'claims'->'app_metadata'->>'barangay_id', '00000000-0000-0000-0000-00000000000a');
  perform app.spike_assert('admin A: role', r->'claims'->'app_metadata'->>'role', 'admin');
  perform app.spike_assert('admin A: is_platform_admin', r->'claims'->'app_metadata'->>'is_platform_admin', 'false');
  perform app.spike_assert('admin A: require_mfa (admin always true)', r->'claims'->'app_metadata'->>'require_mfa', 'true');

  -- staff A: tenant has require_staff_mfa=false -> no MFA
  r := public.custom_access_token_hook(jsonb_set(base_event, '{user_id}', '"10000000-0000-0000-0000-000000000002"'));
  perform app.spike_assert('staff A: require_mfa (tenant opt-out)', r->'claims'->'app_metadata'->>'require_mfa', 'false');

  -- staff B: tenant has require_staff_mfa=true -> MFA required
  r := public.custom_access_token_hook(jsonb_set(base_event, '{user_id}', '"10000000-0000-0000-0000-000000000003"'));
  perform app.spike_assert('staff B: require_mfa (tenant opt-in)', r->'claims'->'app_metadata'->>'require_mfa', 'true');
  perform app.spike_assert('staff B: barangay_id', r->'claims'->'app_metadata'->>'barangay_id', '00000000-0000-0000-0000-00000000000b');

  -- platform admin: is_platform_admin true, own pseudo-tenant
  r := public.custom_access_token_hook(jsonb_set(base_event, '{user_id}', '"10000000-0000-0000-0000-000000000004"'));
  perform app.spike_assert('platform admin: is_platform_admin', r->'claims'->'app_metadata'->>'is_platform_admin', 'true');
  perform app.spike_assert('platform admin: barangay_id', r->'claims'->'app_metadata'->>'barangay_id', '00000000-0000-0000-0000-0000000000ff');

  -- unknown user_id (no profile row yet): claims pass through unchanged, no error
  r := public.custom_access_token_hook(jsonb_set(base_event, '{user_id}', '"99999999-9999-9999-9999-999999999999"'));
  perform app.spike_assert('unknown user: claims unchanged', (r->'claims'->'app_metadata' = '{}'::jsonb)::text, 'true');

  raise notice '--- hook claim injection: ALL PASS ---';
end $$;

-- ---------------------------------------------------------------------
-- 2. RLS isolation driven by those exact claims (proves the mechanism
--    Phase 1's "27 collections -> tables with barangay_id + RLS" relies
--    on, not just that the hook function returns the right jsonb).
-- ---------------------------------------------------------------------
create table if not exists app.spike_residents (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references app.spike_barangays(id),
  name text not null
);
alter table app.spike_residents enable row level security;
alter table app.spike_residents force row level security;

drop policy if exists spike_residents_tenant_isolation on app.spike_residents;
create policy spike_residents_tenant_isolation on app.spike_residents
  for select using (barangay_id = app.current_barangay_id());

truncate app.spike_residents;
insert into app.spike_residents (barangay_id, name) values
  ('00000000-0000-0000-0000-00000000000a', 'Resident A1'),
  ('00000000-0000-0000-0000-00000000000a', 'Resident A2'),
  ('00000000-0000-0000-0000-00000000000b', 'Resident B1');

-- A non-superuser role is required: Postgres superusers bypass RLS
-- regardless of FORCE ROW LEVEL SECURITY, which would make this check
-- silently pass for the wrong reason.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'spike_authenticated') then
    create role spike_authenticated nologin;
  end if;
end $$;
grant usage on schema app to spike_authenticated;
grant usage on schema auth to spike_authenticated;
grant select on app.spike_residents to spike_authenticated;

-- Simulate a PostgREST request as admin A (using the hook's own output,
-- not hand-typed claims, so this proves the whole chain: hook -> jwt ->
-- RLS, not just RLS in isolation).
do $$
declare
  hook_result jsonb;
  final_claims jsonb;
  cnt int;
begin
  hook_result := public.custom_access_token_hook(
    '{"claims": {"aud":"authenticated","role":"authenticated","app_metadata":{},"user_metadata":{}}, "user_id":"10000000-0000-0000-0000-000000000001"}'::jsonb
  );
  final_claims := hook_result->'claims';

  set local role spike_authenticated;
  perform set_config('request.jwt.claims', final_claims::text, true);

  select count(*) into cnt from app.spike_residents;
  reset role;

  perform app.spike_assert('RLS: admin A sees only tenant A rows (2)', cnt::text, '2');
end $$;

do $$
declare
  hook_result jsonb;
  final_claims jsonb;
  cnt int;
begin
  hook_result := public.custom_access_token_hook(
    '{"claims": {"aud":"authenticated","role":"authenticated","app_metadata":{},"user_metadata":{}}, "user_id":"10000000-0000-0000-0000-000000000003"}'::jsonb
  );
  final_claims := hook_result->'claims';

  set local role spike_authenticated;
  perform set_config('request.jwt.claims', final_claims::text, true);

  select count(*) into cnt from app.spike_residents;
  reset role;

  perform app.spike_assert('RLS: staff B sees only tenant B rows (1)', cnt::text, '1');
end $$;

-- No claims at all (anon-equivalent): must see zero rows, not an error and
-- not everything — RLS defaults deny-all with no matching policy, and
-- FORCE ROW LEVEL SECURITY still applies since spike_authenticated is not
-- a superuser.
do $$
declare
  cnt int;
begin
  set local role spike_authenticated;
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into cnt from app.spike_residents;
  reset role;
  perform app.spike_assert('RLS: no claims -> zero rows visible', cnt::text, '0');
end $$;

do $$ begin raise notice '--- RLS isolation driven by hook claims: ALL PASS ---'; end $$;
