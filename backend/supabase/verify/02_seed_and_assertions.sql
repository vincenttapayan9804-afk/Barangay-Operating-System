-- Phase 1 "done when" criterion: RLS isolation provable via psql-level
-- simulated sessions, before any API code exists. Exercises a
-- representative cross-section of the 24 tables (not just the one demo
-- table from the Phase 0 spike): a globally-visible table (lookups), the
-- ordinary tenant-scoped pattern (residents), the public-RPC carve-out
-- (document_requests / get_public_document), an admin-only table (assets),
-- a staff-but-not-viewer table (meetings), an own-record-only update table
-- (blotter_records), an immutable-insert-only log (activity_logs), a
-- fully-immutable log (finance_audit_logs), and a user-scoped non-tenant
-- table (webauthn_credentials).
--
-- IMPORTANT pattern note: claims are always computed via
-- app.verify_claims_for() *before* switching role to `authenticated`/`anon`.
-- custom_access_token_hook is SECURITY DEFINER but still REVOKEd from
-- authenticated/anon/public (0003_custom_access_token_hook.sql) — only
-- supabase_auth_admin (GoTrue itself, in the real deployment) may call it.
-- This mirrors the real request lifecycle: GoTrue computes the JWT once at
-- token-mint time as a privileged call; PostgREST requests afterward only
-- ever *consume* the already-minted claims, never re-invoke the hook.

\set ON_ERROR_STOP on

create or replace function app.verify_assert(label text, actual text, expected text) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected % got %', label, expected, actual;
  end if;
  raise notice 'PASS %', label;
end;
$$;

-- ---------------------------------------------------------------------
-- Seed two tenants + identities (via auth.users, exercising the real
-- app.handle_new_user() trigger from 0002_profiles.sql, not a shortcut).
-- ---------------------------------------------------------------------
insert into public.barangays (id, name, require_staff_mfa) values
  ('11111111-1111-1111-1111-111111111111', 'Barangay A', false),
  ('22222222-2222-2222-2222-222222222222', 'Barangay B', true)
on conflict (id) do nothing;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'admin-a@example.com',
    '{"role":"admin","barangay_id":"11111111-1111-1111-1111-111111111111"}'),
  ('a0000000-0000-0000-0000-000000000002', 'staff-a@example.com',
    '{"role":"staff","barangay_id":"11111111-1111-1111-1111-111111111111"}'),
  ('a0000000-0000-0000-0000-000000000003', 'staff-a2@example.com',
    '{"role":"staff","barangay_id":"11111111-1111-1111-1111-111111111111"}'),
  ('a0000000-0000-0000-0000-000000000004', 'viewer-a@example.com',
    '{"role":"viewer","barangay_id":"11111111-1111-1111-1111-111111111111"}'),
  ('b0000000-0000-0000-0000-000000000001', 'staff-b@example.com',
    '{"role":"staff","barangay_id":"22222222-2222-2222-2222-222222222222"}')
on conflict (id) do nothing;

-- Sanity: the trigger actually ran and populated profiles.
select app.verify_assert('handle_new_user trigger populated profiles',
  (select count(*)::text from public.profiles where id in (
    'a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000001')),
  '5');

-- Helper: build the exact claims a real login would produce, via the real
-- hook — called only as postgres superuser (see note above), never after
-- switching to authenticated/anon. Includes `sub`, which real GoTrue always
-- populates itself (before calling any custom hook) — our hook only adds
-- app_metadata, so the harness must supply `sub` the same way GoTrue would.
create or replace function app.verify_claims_for(p_user_id uuid) returns jsonb
language sql stable as $$
  select (public.custom_access_token_hook(jsonb_build_object(
    'user_id', p_user_id::text,
    'claims', jsonb_build_object(
      'sub', p_user_id::text,
      'aud','authenticated','role','authenticated','app_metadata','{}'::jsonb,'user_metadata','{}'::jsonb)
  )))->'claims';
$$;

-- ---------------------------------------------------------------------
-- Seed cross-tenant data (as postgres superuser, bypasses RLS).
-- ---------------------------------------------------------------------
insert into public.residents (barangay_id, first_name, last_name, type_of_resident, date_of_birth, place_of_birth, sex, civil_status, region, province, city_municipality, barangay, nationality, religion) values
  ('11111111-1111-1111-1111-111111111111','Juan','Dela Cruz','Non-migrant','1990-01-01','Manila','Male','Single/Never Married','NCR','Metro Manila','Manila','Barangay A','Filipino Citizen','Roman Catholic'),
  ('11111111-1111-1111-1111-111111111111','Maria','Santos','Non-migrant','1985-05-05','Manila','Female','Married','NCR','Metro Manila','Manila','Barangay A','Filipino Citizen','Roman Catholic'),
  ('22222222-2222-2222-2222-222222222222','Pedro','Reyes','Non-migrant','1992-02-02','Cebu','Male','Single/Never Married','Region VII','Cebu','Cebu City','Barangay B','Filipino Citizen','Roman Catholic');

insert into public.document_requests (id, barangay_id, queue_number, resident_id, resident_name, document_type, purpose, status, barangay_name)
select '00000000-0000-0000-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'Q-0001', id, 'Juan Dela Cruz', 'barangay_clearance', 'Employment', 'released', 'Barangay A'
from public.residents where first_name = 'Juan';

insert into public.document_requests (id, barangay_id, queue_number, resident_id, resident_name, document_type, purpose, status, barangay_name)
select '00000000-0000-0000-0002-000000000002', '22222222-2222-2222-2222-222222222222', 'Q-0002', id, 'Pedro Reyes', 'certificate_of_indigency', 'Medical assistance', 'pending', 'Barangay B'
from public.residents where first_name = 'Pedro';

insert into public.assets (barangay_id, name, asset_type, condition, status) values
  ('11111111-1111-1111-1111-111111111111','Office Printer','it_equipment','good','available');

insert into public.meetings (barangay_id, title, meeting_date, meeting_type, status) values
  ('11111111-1111-1111-1111-111111111111','Monthly Session','2026-08-01','regular','scheduled');

insert into public.blotter_records (id, barangay_id, case_number, incident_type, complainant_name, status, created_by) values
  ('00000000-0000-0000-0003-000000000003','11111111-1111-1111-1111-111111111111','C-0001','complaint','Ana Cruz','pending','a0000000-0000-0000-0000-000000000002');

insert into public.lookups ("group", values) values ('blood_type', '["A+","O+"]'::jsonb);

insert into public.webauthn_credentials ("user", credential_id, public_key) values
  ('a0000000-0000-0000-0000-000000000002', 'cred-staff-a', 'pubkey-staff-a');

-- ---------------------------------------------------------------------
-- 1. residents: tenant isolation
-- ---------------------------------------------------------------------
do $$
declare cnt int; claims jsonb;
begin
  select app.verify_claims_for('a0000000-0000-0000-0000-000000000001') into claims; -- admin A
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  select count(*) into cnt from public.residents;
  reset role;
  perform app.verify_assert('residents: admin A sees only tenant A (2)', cnt::text, '2');
end $$;

do $$
declare cnt int; claims jsonb;
begin
  select app.verify_claims_for('b0000000-0000-0000-0000-000000000001') into claims; -- staff B
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  select count(*) into cnt from public.residents;
  reset role;
  perform app.verify_assert('residents: staff B sees only tenant B (1)', cnt::text, '1');
end $$;

-- ---------------------------------------------------------------------
-- 2. document_requests: table RLS + public RPC carve-out
-- ---------------------------------------------------------------------
do $$
declare cnt int;
begin
  -- anon direct table access must be fully denied (revoked), not just
  -- filtered by RLS to zero rows.
  set local role anon;
  begin
    select count(*) into cnt from public.document_requests;
    raise exception 'FAIL document_requests: anon direct SELECT should have been denied by REVOKE, got % rows', cnt;
  exception when insufficient_privilege then
    raise notice 'PASS document_requests: anon direct table access denied (REVOKE)';
  end;
  reset role;
end $$;

do $$
declare rec record;
begin
  set local role anon;
  select * into rec from public.get_public_document('00000000-0000-0000-0001-000000000001');
  reset role;
  perform app.verify_assert('get_public_document: released doc visible to anon', rec.queue_number, 'Q-0001');
end $$;

do $$
declare cnt int;
begin
  set local role anon;
  select count(*) into cnt from public.get_public_document('00000000-0000-0000-0002-000000000002');
  reset role;
  perform app.verify_assert('get_public_document: pending doc NOT visible (not released)', cnt::text, '0');
end $$;

-- ---------------------------------------------------------------------
-- 3. assets: admin-only, staff gets zero rows (not an error)
-- ---------------------------------------------------------------------
do $$
declare cnt int; claims jsonb;
begin
  select app.verify_claims_for('a0000000-0000-0000-0000-000000000002') into claims; -- staff A
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  select count(*) into cnt from public.assets;
  reset role;
  perform app.verify_assert('assets: staff sees zero rows', cnt::text, '0');
end $$;

do $$
declare cnt int; claims jsonb;
begin
  select app.verify_claims_for('a0000000-0000-0000-0000-000000000001') into claims; -- admin A
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  select count(*) into cnt from public.assets;
  reset role;
  perform app.verify_assert('assets: admin sees the seeded row', cnt::text, '1');
end $$;

-- ---------------------------------------------------------------------
-- 4. meetings: staff yes, viewer no
-- ---------------------------------------------------------------------
do $$
declare cnt int; claims jsonb;
begin
  select app.verify_claims_for('a0000000-0000-0000-0000-000000000004') into claims; -- viewer A
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  select count(*) into cnt from public.meetings;
  reset role;
  perform app.verify_assert('meetings: viewer sees zero rows', cnt::text, '0');
end $$;

do $$
declare cnt int; claims jsonb;
begin
  select app.verify_claims_for('a0000000-0000-0000-0000-000000000002') into claims; -- staff A
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  select count(*) into cnt from public.meetings;
  reset role;
  perform app.verify_assert('meetings: staff sees the seeded row', cnt::text, '1');
end $$;

-- ---------------------------------------------------------------------
-- 5. blotter_records: own-record-only update for staff
-- ---------------------------------------------------------------------
do $$
declare affected int; claims jsonb;
begin
  select app.verify_claims_for('a0000000-0000-0000-0000-000000000003') into claims; -- staff A2 (not the creator)
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  update public.blotter_records set status = 'settled' where id = '00000000-0000-0000-0003-000000000003';
  get diagnostics affected = row_count;
  reset role;
  perform app.verify_assert('blotter_records: non-owner staff update affects 0 rows', affected::text, '0');
end $$;

do $$
declare affected int; claims jsonb;
begin
  select app.verify_claims_for('a0000000-0000-0000-0000-000000000002') into claims; -- staff A (creator)
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  update public.blotter_records set status = 'settled' where id = '00000000-0000-0000-0003-000000000003';
  get diagnostics affected = row_count;
  reset role;
  perform app.verify_assert('blotter_records: owning staff update succeeds', affected::text, '1');
end $$;

-- ---------------------------------------------------------------------
-- 6. activity_logs: any authenticated role can insert; nobody can update
-- ---------------------------------------------------------------------
do $$
declare new_id uuid; affected int; claims jsonb;
begin
  select app.verify_claims_for('a0000000-0000-0000-0000-000000000004') into claims; -- viewer A
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  insert into public.activity_logs (barangay_id, action, collection) values
    ('11111111-1111-1111-1111-111111111111','create','residents') returning id into new_id;
  update public.activity_logs set details = 'tampered' where id = new_id;
  get diagnostics affected = row_count;
  reset role;
  perform app.verify_assert('activity_logs: viewer can insert', (new_id is not null)::text, 'true');
  perform app.verify_assert('activity_logs: nobody can update (immutable)', affected::text, '0');
end $$;

-- ---------------------------------------------------------------------
-- 7. finance_audit_logs: fully immutable (no update, no delete policy)
-- ---------------------------------------------------------------------
do $$
declare new_id uuid; affected int; claims jsonb;
begin
  select app.verify_claims_for('a0000000-0000-0000-0000-000000000002') into claims; -- staff A
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  insert into public.finance_audit_logs (barangay_id, action, collection_name) values
    ('11111111-1111-1111-1111-111111111111','create','revenues') returning id into new_id;
  delete from public.finance_audit_logs where id = new_id;
  get diagnostics affected = row_count;
  reset role;
  perform app.verify_assert('finance_audit_logs: insert succeeds', (new_id is not null)::text, 'true');
  perform app.verify_assert('finance_audit_logs: delete is a no-op (immutable)', affected::text, '0');
end $$;

-- ---------------------------------------------------------------------
-- 8. webauthn_credentials: user-scoped, not tenant-scoped; write is
--    service-role-only (no policy for authenticated to insert)
-- ---------------------------------------------------------------------
do $$
declare cnt int; claims jsonb;
begin
  select app.verify_claims_for('a0000000-0000-0000-0000-000000000002') into claims; -- staff A (owner)
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  select count(*) into cnt from public.webauthn_credentials;
  reset role;
  perform app.verify_assert('webauthn_credentials: owner sees own credential', cnt::text, '1');
end $$;

do $$
declare cnt int; claims jsonb;
begin
  select app.verify_claims_for('a0000000-0000-0000-0000-000000000003') into claims; -- staff A2 (not owner)
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  select count(*) into cnt from public.webauthn_credentials;
  reset role;
  perform app.verify_assert('webauthn_credentials: non-owner sees zero', cnt::text, '0');
end $$;

do $$
declare claims jsonb;
begin
  select app.verify_claims_for('a0000000-0000-0000-0000-000000000002') into claims; -- staff A
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  begin
    insert into public.webauthn_credentials ("user", credential_id, public_key)
      values ('a0000000-0000-0000-0000-000000000002', 'cred-should-fail', 'x');
    raise exception 'FAIL webauthn_credentials: authenticated insert should have been denied';
  exception when insufficient_privilege then
    raise notice 'PASS webauthn_credentials: authenticated insert denied (service-role-only)';
  end;
  reset role;
end $$;

-- ---------------------------------------------------------------------
-- 9. lookups: global, visible across tenants
-- ---------------------------------------------------------------------
do $$
declare cnt int; claims jsonb;
begin
  select app.verify_claims_for('b0000000-0000-0000-0000-000000000001') into claims; -- staff B
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  select count(*) into cnt from public.lookups;
  reset role;
  perform app.verify_assert('lookups: visible from a different tenant', cnt::text, '1');
end $$;

-- ---------------------------------------------------------------------
-- 10. profiles: self-view for staff, tenant-wide for admin
-- ---------------------------------------------------------------------
do $$
declare cnt int; claims jsonb;
begin
  select app.verify_claims_for('a0000000-0000-0000-0000-000000000002') into claims; -- staff A
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  select count(*) into cnt from public.profiles;
  reset role;
  perform app.verify_assert('profiles: staff sees only self', cnt::text, '1');
end $$;

do $$
declare cnt int; claims jsonb;
begin
  select app.verify_claims_for('a0000000-0000-0000-0000-000000000001') into claims; -- admin A
  set local role authenticated;
  perform set_config('request.jwt.claims', claims::text, true);
  select count(*) into cnt from public.profiles;
  reset role;
  -- admin A + staff A + staff A2 + viewer A = 4 tenant-A profiles
  perform app.verify_assert('profiles: admin sees all tenant profiles', cnt::text, '4');
end $$;

do $$ begin raise notice '=== ALL PHASE 1 ASSERTIONS PASSED ==='; end $$;
