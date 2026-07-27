create table public.households (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  household_number text not null,
  region text not null,
  province text not null,
  city_municipality text not null,
  barangay text not null, -- denormalized display name, distinct from barangay_id
  sitio_purok text,
  household_complete_address text not null,
  no_of_families numeric,
  no_of_household_members numeric,
  no_of_migrants numeric,
  household_type text not null check (household_type in (
    'Nuclear Family','Extended Family','Single/Solo Parent Family','Childless Family',
    'Blended/Stepfamily','Single Person Household','Non-related Family','Others')),
  household_type_other text,
  tenure_status text not null check (tenure_status in ('Owner','Renter','Others')),
  tenure_status_other text,
  household_unit text not null check (household_unit in (
    'Single House','Duplex','Townhouse/Rowhouse','Condominium','Apartment','Others')),
  household_unit_other text,
  household_name text,
  monthly_income numeric,
  data_set text not null default 'BIPS',
  water_system text check (water_system in (
    'Level I (Point Source)','Level II (Communal Faucet)','Level III (Individual Connection)','Others')),
  waste_disposal text check (waste_disposal in (
    'Garbage Collection','Composting','Burning','Open Dumping','Others')),
  power_supply text check (power_supply in (
    'Electric Connection','Solar','Generator','None','Others')),
  toilet_type text check (toilet_type in ('Water-Sealed','Antipolo','Pit Latrine','None','Others')),
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.households
  for each row execute function app.set_updated_at();

create unique index idx_households_barangay_number on public.households (barangay_id, household_number);

alter table public.households enable row level security;
alter table public.households force row level security;

create policy households_select on public.households for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy households_insert on public.households for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy households_update on public.households for update
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'))
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy households_delete on public.households for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');
