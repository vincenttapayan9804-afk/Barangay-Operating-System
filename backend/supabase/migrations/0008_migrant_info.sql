create table public.migrant_info (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  household_id uuid not null references public.households(id) on delete cascade,
  last_name text not null,
  first_name text not null,
  middle_name text,
  ext_name text,
  previous_residence text not null,
  length_of_stay_previous_barangay text not null,
  reason_for_leaving text not null check (reason_for_leaving in (
    '1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16')),
  reason_for_leaving_other text,
  date_of_transfer date not null,
  reason_for_transferring text not null check (reason_for_transferring in ('1','2','3','4','5')),
  reason_for_transferring_other text,
  duration_of_stay_current_barangay text not null,
  intention_to_return boolean not null,
  data_set text not null default 'BIPS',
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.migrant_info
  for each row execute function app.set_updated_at();

create index idx_migrant_info_barangay_household on public.migrant_info (barangay_id, household_id);

alter table public.migrant_info enable row level security;
alter table public.migrant_info force row level security;

create policy migrant_info_select on public.migrant_info for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy migrant_info_insert on public.migrant_info for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy migrant_info_update on public.migrant_info for update
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'))
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy migrant_info_delete on public.migrant_info for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));
