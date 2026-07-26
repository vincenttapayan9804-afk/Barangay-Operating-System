-- PocketBase's `users` auth collection splits into two things under
-- Supabase: auth.users (GoTrue-managed: email, password, verified, etc.)
-- and this `profiles` table (the app-specific fields PocketBase bolted onto
-- its users collection: role, barangay_id, is_platform_admin, name, avatar).
--
-- Final PocketBase rules (users collection, after 1785000027 + 1785000028):
--   list:   barangay_id = auth.barangay_id && role = "admin"
--   view:   barangay_id = auth.barangay_id && (role = "admin" || auth.id = id)
--   create: (body.barangay_id = auth.barangay_id && role = "admin")
--             || is_platform_admin
--   update: barangay_id = auth.barangay_id && role = "admin"
--   delete: barangay_id = auth.barangay_id && role = "admin"
--
-- Note: Postgres RLS has one SELECT policy governing both "list" and
-- "view a single row" (same limitation noted in the plan's Hard Part #1 for
-- document_requests). Using the more permissive (view) fragment as the
-- single policy means a non-admin staff/viewer issuing a list query just
-- gets back their own row via the self-view branch — not a security
-- regression (still tenant-scoped, still only their own row), just a minor
-- behavior difference from PocketBase's separate list/view distinction.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','staff','viewer')),
  barangay_id uuid not null references public.barangays(id) on delete restrict,
  is_platform_admin boolean not null default false,
  name text,
  avatar_url text, -- deferred Storage decision (Phase 6): plain URL until a real upload feature needs it
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.profiles
  for each row execute function app.set_updated_at();

create index idx_profiles_barangay_id on public.profiles (barangay_id);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy profiles_select on public.profiles for select
  using (
    barangay_id = app.current_barangay_id()
    and (app.current_role() = 'admin' or auth.uid() = id)
  );

create policy profiles_insert on public.profiles for insert
  with check (
    (barangay_id = app.current_barangay_id() and app.current_role() = 'admin')
    or app.is_platform_admin()
  );

create policy profiles_update on public.profiles for update
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin')
  with check (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');

create policy profiles_delete on public.profiles for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');

-- ---------------------------------------------------------------------
-- auth.users insert trigger: provisions a matching profiles row whenever
-- an account is created (via the admin-create-user API, per
-- GOTRUE_DISABLE_SIGNUP=true — no open self-registration). The invite/
-- bootstrap flow (Phase 2's bootstrap-platform-admin.mjs, and the eventual
-- Edge Function backing the in-app "invite staff" UI) must pass role,
-- barangay_id, and optionally is_platform_admin in the admin API call's
-- user_metadata — the NOT NULL constraints on role/barangay_id below
-- enforce that the same way PocketBase required them at creation time.
-- ---------------------------------------------------------------------
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, barangay_id, is_platform_admin, name)
  values (
    new.id,
    new.raw_user_meta_data->>'role',
    (new.raw_user_meta_data->>'barangay_id')::uuid,
    coalesce((new.raw_user_meta_data->>'is_platform_admin')::boolean, false),
    new.raw_user_meta_data->>'name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();
