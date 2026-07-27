create table public.visitor_logs (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  visitor_name text not null,
  contact_number text,
  purpose text not null,
  person_to_visit text,
  time_in timestamptz not null default now(),
  time_out timestamptz,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.visitor_logs
  for each row execute function app.set_updated_at();

create index idx_visitor_logs_time_in on public.visitor_logs (time_in);
create index idx_visitor_logs_time_out on public.visitor_logs (time_out);
create index idx_visitor_logs_barangay_time_in on public.visitor_logs (barangay_id, time_in);

alter table public.visitor_logs enable row level security;
alter table public.visitor_logs force row level security;

create policy visitor_logs_select on public.visitor_logs for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy visitor_logs_insert on public.visitor_logs for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy visitor_logs_update on public.visitor_logs for update
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'))
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy visitor_logs_delete on public.visitor_logs for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));
