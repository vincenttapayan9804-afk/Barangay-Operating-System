create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  household_id uuid not null references public.households(id) on delete cascade,
  resident_id uuid references public.residents(id) on delete set null,
  last_name text not null,
  first_name text not null,
  middle_name text,
  ext_name text,
  -- Numeric codes; human labels live in `lookups` (group='relationship_to_head' / 'source_of_income')
  relationship_to_head text not null check (relationship_to_head in (
    '1','2a','2b','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19',
    '20','21','22','23','24','25','26')),
  source_of_income text check (source_of_income in ('1','2','3','4','5','6','7','8')),
  monthly_income numeric,
  sort_order numeric,
  data_set text not null default 'BIPS',
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.household_members
  for each row execute function app.set_updated_at();

create index idx_household_members_barangay_household on public.household_members (barangay_id, household_id);

alter table public.household_members enable row level security;
alter table public.household_members force row level security;

create policy household_members_select on public.household_members for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy household_members_insert on public.household_members for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy household_members_update on public.household_members for update
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'))
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy household_members_delete on public.household_members for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));
