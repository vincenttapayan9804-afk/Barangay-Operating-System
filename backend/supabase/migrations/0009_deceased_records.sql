create table public.deceased_records (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  inhabitant_id uuid not null references public.residents(id) on delete restrict,
  date_of_death date not null,
  immediate_cause_of_death text not null,
  underlying_cause_of_death text not null check (underlying_cause_of_death in (
    'Mental','Physical','Infectious','Non-Infectious','Deficiency','Inherited','Degenerative',
    'Social','Self-Inflicted','Others (specify)')),
  underlying_cause_other text,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.deceased_records
  for each row execute function app.set_updated_at();

create index idx_deceased_records_barangay_id on public.deceased_records (barangay_id);

alter table public.deceased_records enable row level security;
alter table public.deceased_records force row level security;

create policy deceased_records_select on public.deceased_records for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy deceased_records_insert on public.deceased_records for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy deceased_records_update on public.deceased_records for update
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'))
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy deceased_records_delete on public.deceased_records for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');
