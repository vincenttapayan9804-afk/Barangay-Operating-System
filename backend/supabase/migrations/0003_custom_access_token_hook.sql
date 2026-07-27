-- The real custom_access_token_hook, joining the real profiles/barangays
-- tables. Logic validated against stand-in tables in the Phase 0 spike
-- (backend/supabase-spike/, 14/14 assertions passing); this is the same
-- function body, just pointed at public.profiles / public.barangays.
--
-- Mirrors 1785000033_mfa_extend_to_staff.js's cross-relation MFA rule:
--   'role = "admin" || (role = "staff" && barangay_id.require_staff_mfa = true)'
-- PocketBase's `barangay_id.require_staff_mfa` dot-path is a live relation
-- traversal per login; here it's the join against barangays below.
--
-- GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI must be configured (Phase 2) as
-- pg-functions://postgres/public/custom_access_token_hook.
--
-- SECURITY DEFINER is required, not optional: profiles/barangays both have
-- RLS forced, and the hook must see the row being logged in regardless of
-- what (if any) JWT claims the calling role currently carries — at the
-- moment this runs, the caller has no claims yet (that's the whole point,
-- it's computing them). Without SECURITY DEFINER, the SELECT below is
-- silently blocked by profiles' own RLS policy and this function falls
-- into its "no profile found" branch for every real login, not just
-- genuinely-unprovisioned users — caught by the Phase 1 verification
-- script (backend/supabase/verify/), not by inspection.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  profile public.profiles;
  tenant public.barangays;
  require_mfa boolean;
begin
  claims := event->'claims';

  select * into profile from public.profiles where id = (event->>'user_id')::uuid;

  if not found then
    -- No profile yet — return claims unchanged rather than erroring the
    -- whole login. Matches a PocketBase user record with no barangay_id
    -- assigned yet (shouldn't normally happen since profiles are created
    -- alongside auth.users by app.handle_new_user(), but a hook must never
    -- be the reason login fails).
    return jsonb_build_object('claims', claims);
  end if;

  select * into tenant from public.barangays where id = profile.barangay_id;

  require_mfa := (profile.role = 'admin')
    or (profile.role = 'staff' and coalesce(tenant.require_staff_mfa, false));

  claims := jsonb_set(claims, '{app_metadata,barangay_id}', to_jsonb(profile.barangay_id::text));
  claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(profile.role));
  claims := jsonb_set(claims, '{app_metadata,is_platform_admin}', to_jsonb(profile.is_platform_admin));
  claims := jsonb_set(claims, '{app_metadata,require_mfa}', to_jsonb(require_mfa));

  return jsonb_build_object('claims', claims);
end;
$$;

-- Self-hosted GoTrue calls this as supabase_auth_admin; deny everyone else.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
    revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
  end if;
end $$;
