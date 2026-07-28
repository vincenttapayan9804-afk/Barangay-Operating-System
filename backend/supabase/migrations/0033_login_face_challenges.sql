-- Security Phase 6: the pending step-up state between login-gate's two
-- calls (password grant, then face verification). GoTrue's password grant
-- and the CompreFace recognize call happen in two separate HTTP requests,
-- and self-hosted edge-runtime gives no guarantee the same worker process
-- (and therefore no in-memory Map, unlike the WebAuthn sidecar's
-- long-running Node process) handles both — so the pending challenge has to
-- live in Postgres, not memory.
--
-- Deliberately does NOT store the GoTrue session tokens the password grant
-- already returned: those are discarded once the password itself is
-- confirmed correct, and a *fresh* session is minted via the admin
-- magiclink flow (see login-gate/index.ts's mintSessionForUser, the same
-- technique the WebAuthn sidecar uses) only after the face match succeeds.
-- That keeps no live, usable session token sitting at rest in this table
-- even for the short single-use/2-minute window below.
--
-- No RLS policies at all (beyond force-enabling it): this table is never
-- read or written by an authenticated end-user session, only by login-gate
-- authenticated as service_role, which bypasses RLS by construction.

create table public.login_face_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created timestamptz not null default now()
);

create index idx_login_face_challenges_expires_at on public.login_face_challenges (expires_at);

alter table public.login_face_challenges enable row level security;
alter table public.login_face_challenges force row level security;
