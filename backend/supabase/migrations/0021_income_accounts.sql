create table public.income_accounts (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  coa_code text,
  name text not null,
  fiscal_year numeric,
  budgeted_amount numeric,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.income_accounts
  for each row execute function app.set_updated_at();

create index idx_income_accounts_fiscal_year on public.income_accounts (fiscal_year);

alter table public.income_accounts enable row level security;
alter table public.income_accounts force row level security;

create policy income_accounts_select on public.income_accounts for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy income_accounts_insert on public.income_accounts for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy income_accounts_update on public.income_accounts for update
  using (
    barangay_id = app.current_barangay_id()
    and (app.current_role() = 'admin' or (app.current_role() = 'staff' and auth.uid() = created_by))
  )
  with check (
    barangay_id = app.current_barangay_id()
    and (app.current_role() = 'admin' or (app.current_role() = 'staff' and auth.uid() = created_by))
  );

create policy income_accounts_delete on public.income_accounts for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');
