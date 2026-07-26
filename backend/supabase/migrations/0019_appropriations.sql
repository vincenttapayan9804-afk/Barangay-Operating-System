create table public.appropriations (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  fiscal_year numeric,
  fund_source uuid references public.fund_sources(id) on delete set null,
  expense_class text check (expense_class in ('PS','MOOE','CO')),
  item_name text not null,
  appropriated_amount numeric,
  disbursed_amount numeric,
  payee text,
  obligated_date date,
  fully_disbursed_date date,
  obligation_notes text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.appropriations
  for each row execute function app.set_updated_at();

create index idx_appropriations_fiscal_year on public.appropriations (fiscal_year);
create index idx_appropriations_fund_source on public.appropriations (fund_source);

alter table public.appropriations enable row level security;
alter table public.appropriations force row level security;

create policy appropriations_select on public.appropriations for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy appropriations_insert on public.appropriations for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy appropriations_update on public.appropriations for update
  using (
    barangay_id = app.current_barangay_id()
    and (app.current_role() = 'admin' or (app.current_role() = 'staff' and auth.uid() = created_by))
  )
  with check (
    barangay_id = app.current_barangay_id()
    and (app.current_role() = 'admin' or (app.current_role() = 'staff' and auth.uid() = created_by))
  );

create policy appropriations_delete on public.appropriations for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');
