create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  title text not null,
  description text,
  event_type text not null check (event_type in (
    'barangay_event','hearing','council_meeting','holiday','other')),
  start_datetime timestamptz not null,
  end_datetime timestamptz,
  all_day boolean not null default false,
  location text,
  agenda_ref uuid references public.meetings(id) on delete set null,
  notes text,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.calendar_events
  for each row execute function app.set_updated_at();

create index idx_calendar_events_start on public.calendar_events (start_datetime);
create index idx_calendar_events_event_type on public.calendar_events (event_type);
create index idx_calendar_events_barangay_start on public.calendar_events (barangay_id, start_datetime);

alter table public.calendar_events enable row level security;
alter table public.calendar_events force row level security;

create policy calendar_events_select on public.calendar_events for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy calendar_events_insert on public.calendar_events for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy calendar_events_update on public.calendar_events for update
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'))
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy calendar_events_delete on public.calendar_events for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));
