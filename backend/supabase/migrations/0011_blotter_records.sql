create table public.blotter_records (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  case_number text not null,
  incident_type text not null check (incident_type in ('blotter','complaint','dispute','other')),
  complainant_name text not null,
  complainant_contact text,
  respondent_name text,
  respondent_contact text,
  incident_date date,
  incident_location text,
  narrative text,
  status text not null check (status in ('pending','hearing','settled','escalated','dismissed')),
  action_taken text,
  involved_parties text,
  created_by uuid references public.profiles(id) on delete set null,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.blotter_records
  for each row execute function app.set_updated_at();

create index idx_blotter_records_status on public.blotter_records (status);
create index idx_blotter_records_incident_date on public.blotter_records (incident_date);
create index idx_blotter_records_barangay_status on public.blotter_records (barangay_id, status);
-- 1785000031_tenant_scoped_uniqueness.js: the original global-unique
-- case_number index let two barangays collide on the same case number —
-- caught by a real load test with more than one active tenant. Fixed here
-- as tenant-scoped from the start.
create unique index idx_blotter_records_barangay_case on public.blotter_records (barangay_id, case_number);

alter table public.blotter_records enable row level security;
alter table public.blotter_records force row level security;

create policy blotter_records_select on public.blotter_records for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy blotter_records_insert on public.blotter_records for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

-- Staff can only edit their own records; admin can edit any in-tenant record.
create policy blotter_records_update on public.blotter_records for update
  using (
    barangay_id = app.current_barangay_id()
    and (app.current_role() = 'admin' or (app.current_role() = 'staff' and auth.uid() = created_by))
  )
  with check (
    barangay_id = app.current_barangay_id()
    and (app.current_role() = 'admin' or (app.current_role() = 'staff' and auth.uid() = created_by))
  );

create policy blotter_records_delete on public.blotter_records for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');
