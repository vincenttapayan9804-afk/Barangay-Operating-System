-- Phase 3 (WebAuthn sidecar port): passkey login starts from just an email
-- address, before any session/JWT exists — the sidecar needs to resolve
-- that email to a user id to look up their credentials. auth.users isn't
-- exposed through PostgREST at all (PGRST_DB_SCHEMAS=public, see
-- backend/supabase/docker-compose.yml), so this is the same narrow-RPC
-- pattern as 0026_get_public_document_rpc.sql: a single SECURITY DEFINER
-- function returning only what's needed (the id, nothing else about the
-- account), restricted to service_role — never anon/authenticated, since
-- letting any authenticated user probe "does this email exist" would be an
-- account-enumeration oracle.

create or replace function public.lookup_user_id_by_email(p_email text)
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.lookup_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.lookup_user_id_by_email(text) to service_role;
