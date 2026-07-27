-- Most restrictive collection in the schema: all five rules are admin-only
-- in PocketBase — staff/viewer have zero access, not even list/view.

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  name text not null,
  asset_type text not null check (asset_type in (
    'equipment','furniture','it_equipment','vehicle','facility','tool','other')),
  description text,
  serial_number text,
  purchase_date date,
  purchase_cost numeric,
  current_value numeric,
  condition text not null check (condition in ('new','good','fair','poor','damaged','disposed')),
  status text not null check (status in ('available','assigned','disposed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  location text,
  image_url text,
  notes text,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.assets
  for each row execute function app.set_updated_at();

create index idx_assets_asset_type on public.assets (asset_type);
create index idx_assets_condition on public.assets (condition);
create index idx_assets_status on public.assets (status);

alter table public.assets enable row level security;
alter table public.assets force row level security;

create policy assets_select on public.assets for select
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');

create policy assets_insert on public.assets for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');

create policy assets_update on public.assets for update
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin')
  with check (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');

create policy assets_delete on public.assets for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');
