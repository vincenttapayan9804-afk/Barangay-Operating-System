-- Verification-harness-ONLY scaffolding. Reimplements the pieces the real
-- `supabase/postgres` Docker image already ships (auth.users table,
-- auth.jwt()/auth.uid()/auth.role(), the anon/authenticated/service_role/
-- supabase_auth_admin roles) so the real Phase 1 migrations in
-- backend/supabase/migrations/ can be applied and RLS-tested against bare
-- Postgres, matching the same approach validated in the Phase 0 spike
-- (backend/supabase-spike/auth-stubs.sql). NOT part of the real migration
-- set — never apply this file against an actual Supabase instance, which
-- already has all of this and would conflict.

create extension if not exists pgcrypto;
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.jwt() returns jsonb
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;

create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;

create or replace function auth.role() returns text
  language sql stable
  as $$ select nullif(auth.jwt()->>'role','')::text $$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin;
  end if;
end $$;

grant usage on schema public, auth to anon, authenticated;
-- NOTE: `app` schema doesn't exist yet at this point (created by
-- migrations/0000_auth_helpers.sql) — its usage grant lives in
-- 01_grants.sql, which runs after all migrations.
