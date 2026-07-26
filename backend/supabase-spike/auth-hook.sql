-- Phase 0 spike: the `app` helper schema (final home: Phase 1's
-- backend/supabase/migrations/0000_auth_helpers.sql) plus the
-- custom_access_token_hook that populates the JWT app_metadata claims those
-- helpers read. This file is self-contained so it can be verified against a
-- bare Postgres instance without a running GoTrue/PostgREST stack — see
-- verify-hook.sql and BUILD_NOTES.md for what was actually confirmed this way
-- and what still needs a live GoTrue instance.

create schema if not exists app;

-- ---------------------------------------------------------------------
-- Stand-ins for the real Phase 1 tables, just enough shape for the hook
-- to join against. Phase 1 replaces these with the real `profiles` and
-- `barangays` tables (profiles gets a real FK to auth.users; barangays
-- gains require_staff_mfa per 1785000033_mfa_extend_to_staff.js).
-- ---------------------------------------------------------------------
create table if not exists app.spike_barangays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  require_staff_mfa boolean not null default false
);

create table if not exists app.spike_profiles (
  id uuid primary key,               -- mirrors auth.users.id
  role text not null,                -- 'admin' | 'staff' | 'viewer'
  barangay_id uuid not null references app.spike_barangays(id),
  is_platform_admin boolean not null default false
);

-- ---------------------------------------------------------------------
-- Claim-reading helpers (final form — these are what RLS policies call).
-- Mirrors the plan's snippet in docs/SUPABASE_MIGRATION_PLAN.md.
-- ---------------------------------------------------------------------
create or replace function app.current_barangay_id() returns uuid
  stable language sql as
  $$ select nullif(auth.jwt()->'app_metadata'->>'barangay_id','')::uuid $$;

create or replace function app.current_role() returns text
  stable language sql as
  $$ select auth.jwt()->'app_metadata'->>'role' $$;

create or replace function app.is_platform_admin() returns boolean
  stable language sql as
  $$ select coalesce((auth.jwt()->'app_metadata'->>'is_platform_admin')::boolean, false) $$;

create or replace function app.has_aal2() returns boolean
  stable language sql as
  $$ select auth.jwt()->>'aal' = 'aal2' $$;

create or replace function app.requires_mfa() returns boolean
  stable language sql as
  $$ select coalesce((auth.jwt()->'app_metadata'->>'require_mfa')::boolean, false) $$;

-- ---------------------------------------------------------------------
-- The hook itself. GoTrue calls this at token-mint time (login, refresh)
-- as `select public.custom_access_token_hook(event)`, where `event` is:
--   { "user_id": "<uuid>", "claims": { ...default claims... },
--     "authentication_method": "password" | "otp" | ... }
-- and expects back `{ "claims": {...possibly modified...} }`.
--
-- It lives in `public` (not `app`) because GoTrue's
-- GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI is configured as
-- `pg-functions://postgres/public/custom_access_token_hook` — self-hosted
-- GoTrue calls it via the Postgres function-hook transport, which requires
-- the function to be reachable in `public` and executable by the
-- supabase_auth_admin role (grants below).
-- ---------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  profile app.spike_profiles;
  tenant app.spike_barangays;
  require_mfa boolean;
begin
  claims := event->'claims';

  select * into profile from app.spike_profiles where id = (event->>'user_id')::uuid;

  if not found then
    -- No profile yet (e.g. a user created but not yet provisioned into a
    -- tenant) — return claims unchanged rather than erroring the whole
    -- login. Matches PocketBase's behavior of a plain authenticated user
    -- with no barangay_id until an admin assigns one.
    return jsonb_build_object('claims', claims);
  end if;

  select * into tenant from app.spike_barangays where id = profile.barangay_id;

  -- Mirrors 1785000033_mfa_extend_to_staff.js:
  --   'role = "admin" || (role = "staff" && barangay_id.require_staff_mfa = true)'
  require_mfa := (profile.role = 'admin')
    or (profile.role = 'staff' and coalesce(tenant.require_staff_mfa, false));

  claims := jsonb_set(claims, '{app_metadata,barangay_id}', to_jsonb(profile.barangay_id::text));
  claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(profile.role));
  claims := jsonb_set(claims, '{app_metadata,is_platform_admin}', to_jsonb(profile.is_platform_admin));
  claims := jsonb_set(claims, '{app_metadata,require_mfa}', to_jsonb(require_mfa));

  return jsonb_build_object('claims', claims);
end;
$$;

-- Real deployment grants (harmless no-ops against a bare spike Postgres
-- with no supabase_auth_admin role yet — wrapped so this file still runs
-- standalone for the spike).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
    revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
  end if;
end $$;
