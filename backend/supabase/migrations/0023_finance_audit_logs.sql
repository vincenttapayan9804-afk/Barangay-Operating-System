-- Fully immutable: no update or delete policy at all — matches PocketBase's
-- updateRule = null AND deleteRule = null (cannot be changed or removed by
-- anyone through the API, only via direct superuser/service-role access).

create table public.finance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  action text not null,
  collection_name text not null,
  record_id text,
  details text,
  amount numeric,
  user_name text,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

alter table public.finance_audit_logs enable row level security;
alter table public.finance_audit_logs force row level security;

create policy finance_audit_logs_select on public.finance_audit_logs for select
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy finance_audit_logs_insert on public.finance_audit_logs for insert
  with check (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');
