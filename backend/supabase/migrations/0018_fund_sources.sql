create table public.fund_sources (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  name text not null,
  code text not null,
  description text,
  statutory_rule text check (statutory_rule in ('none','20%_DF','SK','BDRRMF','GAD')),
  current_balance numeric,
  original_balance numeric,
  fiscal_year numeric,
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.fund_sources
  for each row execute function app.set_updated_at();

create index idx_fund_sources_fiscal_year on public.fund_sources (fiscal_year);

alter table public.fund_sources enable row level security;
alter table public.fund_sources force row level security;

create policy fund_sources_select on public.fund_sources for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy fund_sources_insert on public.fund_sources for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy fund_sources_update on public.fund_sources for update
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin')
  with check (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');

create policy fund_sources_delete on public.fund_sources for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');
