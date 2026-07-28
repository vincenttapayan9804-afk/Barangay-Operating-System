-- Security Phase 6 (biometric step-up authentication): authoritative,
-- server-side failed-login counter. The `login-gate` Edge Function (not the
-- frontend) is the only writer — it proxies GoTrue's password grant itself
-- so a failure is counted from GoTrue's own response, never from a
-- client-reported "that failed" call a compromised or modified client could
-- simply skip. Once failed_count reaches 3, locked_at is set and the *next*
-- login for this account must pass a CompreFace face match
-- (see 0032_face_enrollments.sql, 0033_login_face_challenges.sql) before a
-- session is issued — a step-up, not a hard account lockout, unless the
-- account has no face enrolled (see login-gate/index.ts), in which case it
-- fails closed until an admin unlocks it below.
--
-- Keyed by user_id (not email) and denormalized with barangay_id so the
-- existing app.current_role()/app.current_barangay_id() RLS pattern can
-- gate the admin-unlock action without a bespoke RPC.

create table public.login_attempts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  barangay_id uuid not null references public.barangays(id) on delete cascade,
  failed_count int not null default 0,
  locked_at timestamptz,
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.login_attempts
  for each row execute function app.set_updated_at();

create index idx_login_attempts_barangay_id on public.login_attempts (barangay_id);

alter table public.login_attempts enable row level security;
alter table public.login_attempts force row level security;

-- A locked-out user can see their own row (a "your account needs face
-- verification" status in Settings); an admin can see every row in their
-- own barangay (to know who's locked and needs the button below).
create policy login_attempts_select on public.login_attempts for select
  using (
    auth.uid() = user_id
    or (barangay_id = app.current_barangay_id() and app.current_role() = 'admin')
  );

-- The only mutation a client ever performs directly: an admin clearing a
-- teammate's lockout. Scoped to the admin's own tenant; barangay_id itself
-- is not editable (with check repeats the same tenant match).
create policy login_attempts_admin_unlock on public.login_attempts for update
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin')
  with check (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');

-- No insert/delete policy: only login-gate, authenticated as service_role
-- (which bypasses RLS entirely), creates or removes these rows.
