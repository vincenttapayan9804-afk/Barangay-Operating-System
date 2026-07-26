-- All five rules are admin/staff only in PocketBase — no general
-- authenticated (viewer-role) access, unlike most other collections.

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  title text not null,
  meeting_date date not null,
  location text,
  meeting_type text not null check (meeting_type in ('regular','special','emergency')),
  status text not null check (status in ('scheduled','ongoing','adjourned')),
  notes text,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.meetings
  for each row execute function app.set_updated_at();

create index idx_meetings_meeting_date on public.meetings (meeting_date);
create index idx_meetings_status on public.meetings (status);

alter table public.meetings enable row level security;
alter table public.meetings force row level security;

create policy meetings_select on public.meetings for select
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy meetings_insert on public.meetings for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy meetings_update on public.meetings for update
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'))
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy meetings_delete on public.meetings for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));
