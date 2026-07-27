-- JWT-claim helper functions used throughout every RLS policy in this
-- schema. Validated in backend/supabase-spike/ (Phase 0 spike,
-- verify-hook.sql, 14/14 assertions passing) before being copied here.
--
-- Claims are populated by the custom_access_token_hook defined in
-- 0003_custom_access_token_hook.sql (after profiles/barangays exist).

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
