-- Not tenant-scoped by barangay_id (created after the multi-tenant
-- migration, never retrofitted) — scoped by `user` instead, which is
-- itself tenant-scoped via profiles, so this is transitively tenant-safe.
--
-- create/update are locked to service-role only (matches PocketBase's
-- createRule/updateRule = null) — the actual write path is the WebAuthn
-- sidecar (Phase 3), authenticating with the service role, since real
-- attestation/assertion crypto isn't reimplemented as a Postgres function.

create table public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  "user" uuid not null references public.profiles(id) on delete cascade,
  credential_id text not null,
  public_key text not null,
  counter numeric not null default 0,
  device_name text,
  transports jsonb,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.webauthn_credentials
  for each row execute function app.set_updated_at();

create unique index idx_webauthn_credentials_credential_id on public.webauthn_credentials (credential_id);

alter table public.webauthn_credentials enable row level security;
alter table public.webauthn_credentials force row level security;

create policy webauthn_credentials_select on public.webauthn_credentials for select
  using (auth.uid() = "user");

create policy webauthn_credentials_delete on public.webauthn_credentials for delete
  using (auth.uid() = "user");

-- No insert/update policy: only the service role (which bypasses RLS
-- entirely) can write, matching createRule/updateRule = null.
