create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  key text not null,
  value jsonb,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.system_settings
  for each row execute function app.set_updated_at();

create unique index idx_system_settings_barangay_key on public.system_settings (barangay_id, key);

alter table public.system_settings enable row level security;
alter table public.system_settings force row level security;

create policy system_settings_select on public.system_settings for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy system_settings_insert on public.system_settings for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');

create policy system_settings_update on public.system_settings for update
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin')
  with check (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');

create policy system_settings_delete on public.system_settings for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');
