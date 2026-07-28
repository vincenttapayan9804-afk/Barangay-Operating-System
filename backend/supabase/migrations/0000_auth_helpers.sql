-- JWT-claim helper functions used throughout every RLS policy in this
-- schema. Validated in backend/supabase-spike/ (Phase 0 spike,
-- verify-hook.sql, 14/14 assertions passing) before being copied here.
--
-- Claims are populated by the custom_access_token_hook defined in
-- 0003_custom_access_token_hook.sql (after profiles/barangays exist).

-- auth.jwt()/auth.uid()/auth.role() are NOT part of the plain
-- `supabase/postgres` Docker image (only auth.users and the auth-related
-- roles are) -- they're the standard self-hosted-Supabase DIY helpers that
-- read the JWT claims PostgREST sets per-request. Defined here, first,
-- since app.current_barangay_id()/app.current_role() below (and every RLS
-- policy from 0001 onward) depend on them existing already.
create schema if not exists auth;

create or replace function auth.jwt() returns jsonb
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;

create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;

create or replace function auth.role() returns text
  language sql stable
  as $$ select nullif(auth.jwt()->>'role','')::text $$;

-- The real GoTrue binary (which we depend on for actual login) also ships
-- its own migrations that (re)create these same three functions the first
-- time the `auth` service itself starts up -- as the supabase_auth_admin
-- role, not postgres/migrate.sh (which is what created them above). Without
-- this ownership transfer, GoTrue's own `create or replace function
-- auth.uid()`/`auth.role()`/`auth.jwt()` fails outright with "must be owner
-- of function", and the auth service never becomes healthy. GoTrue's own
-- final versions are a compatible superset of these (they also read
-- request.jwt.claims), so letting it re-create them afterwards is safe.
alter function auth.jwt() owner to supabase_auth_admin;
alter function auth.uid() owner to supabase_auth_admin;
alter function auth.role() owner to supabase_auth_admin;

create schema if not exists app;

create or replace function app.has_aal2() returns boolean
  stable language sql as
  $$ select auth.jwt()->>'aal' = 'aal2' $$;

create or replace function app.requires_mfa() returns boolean
  stable language sql as
  $$ select coalesce((auth.jwt()->'app_metadata'->>'require_mfa')::boolean, false) $$;

-- Phase 2 (MFA gating, Hard Part #2): GoTrue's own login does not refuse an
-- aal1 session just because a user's role requires MFA — TOTP is opt-in
-- per session, upgraded post-login via /factors challenge+verify, matching
-- Supabase's own documented pattern for enforcing MFA in RLS rather than at
-- the login step. PocketBase's `mfa.rule` (1785000029_admin_mfa.js /
-- 1785000033_mfa_extend_to_staff.js) instead blocked the ENTIRE session
-- until the second factor completed — no token at all, not even a
-- read-only one. This function is the single choke point that reproduces
-- that all-or-nothing behavior on top of GoTrue's always-issue-aal1 model:
-- every other helper below funnels through it, so a require_mfa=true claim
-- without aal2 neuters every RLS check in one place instead of needing an
-- MFA clause bolted onto all ~90 policies across 0001-0026.
create or replace function app.mfa_satisfied() returns boolean
  stable language sql as
  $$ select not app.requires_mfa() or app.has_aal2() $$;

create or replace function app.current_barangay_id() returns uuid
  stable language sql as
  $$ select case when app.mfa_satisfied()
       then nullif(auth.jwt()->'app_metadata'->>'barangay_id','')::uuid
     end $$;

create or replace function app.current_role() returns text
  stable language sql as
  $$ select case when app.mfa_satisfied()
       then auth.jwt()->'app_metadata'->>'role'
     end $$;

create or replace function app.is_platform_admin() returns boolean
  stable language sql as
  $$ select app.mfa_satisfied()
       and coalesce((auth.jwt()->'app_metadata'->>'is_platform_admin')::boolean, false) $$;
