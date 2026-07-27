-- Immutable audit log: no update policy at all (matches PocketBase's
-- updateRule = null — nobody can modify a log entry once written).

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  action text not null,
  collection text not null,
  record_id text,
  details text,
  user_name text,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create index idx_activity_logs_collection on public.activity_logs (collection);
create index idx_activity_logs_barangay_created on public.activity_logs (barangay_id, created);

alter table public.activity_logs enable row level security;
alter table public.activity_logs force row level security;

create policy activity_logs_select on public.activity_logs for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy activity_logs_insert on public.activity_logs for insert
  with check (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy activity_logs_delete on public.activity_logs for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');
