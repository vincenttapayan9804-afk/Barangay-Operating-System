-- JWT-claim helper functions used throughout every RLS policy in this
-- schema. Validated in backend/supabase-spike/ (Phase 0 spike,
-- verify-hook.sql, 14/14 assertions passing) before being copied here.
--
-- Claims are populated by the custom_access_token_hook defined in
-- 0003_custom_access_token_hook.sql (after profiles/barangays exist).

create schema if not exists app;

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
