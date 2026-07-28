-- Security Phase 6: tracks which accounts have a face template enrolled in
-- CompreFace (the actual biometric template lives only in CompreFace's own
-- store, keyed by subject = this user's id — nothing biometric is ever
-- stored in this database). Onboarding enrolls every role (staff/admin/
-- viewer) up front via Settings (frontend/src/features/settings/
-- FaceEnrollmentSettings.tsx) specifically so a template already exists
-- before any lockout occurs; an account with no row here fails closed
-- (soft-locked, admin-unlock — see login-gate/index.ts and
-- 0031_login_attempts.sql) rather than silently skipping the second factor
-- once it's needed.
--
-- Writes are service-role-only, same rationale as webauthn_credentials
-- (0025): enrollment and deletion both call out to CompreFace's own API
-- first (add/remove the face template) and only then write this row, from
-- the enroll-face Edge Function — never a bare client insert.

create table public.face_enrollments (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  barangay_id uuid not null references public.barangays(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.face_enrollments
  for each row execute function app.set_updated_at();

create index idx_face_enrollments_barangay_id on public.face_enrollments (barangay_id);

alter table public.face_enrollments enable row level security;
alter table public.face_enrollments force row level security;

create policy face_enrollments_select on public.face_enrollments for select
  using (
    auth.uid() = user_id
    or (barangay_id = app.current_barangay_id() and app.current_role() = 'admin')
  );

-- No insert/update/delete policy: only the service role (enroll-face Edge
-- Function) writes, matching webauthn_credentials' createRule/updateRule =
-- null equivalent.
