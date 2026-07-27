create table public.revenues (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  revenue_date date,
  income_account uuid references public.income_accounts(id) on delete set null,
  fund_source text, -- plain text here, NOT a relation (distinct from appropriations.fund_source)
  category text check (category in (
    'nta_receipt','tax_receipt','other_receipt','document_fee','donation','grant','other')),
  source text,
  amount numeric,
  document_request uuid references public.document_requests(id) on delete set null,
  or_no text,
  remarks text,
  created_by uuid references public.profiles(id) on delete set null,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.revenues
  for each row execute function app.set_updated_at();

create index idx_revenues_date on public.revenues (revenue_date);
create index idx_revenues_category on public.revenues (category);

alter table public.revenues enable row level security;
alter table public.revenues force row level security;

create policy revenues_select on public.revenues for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy revenues_insert on public.revenues for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy revenues_update on public.revenues for update
  using (
    barangay_id = app.current_barangay_id()
    and (app.current_role() = 'admin' or (app.current_role() = 'staff' and auth.uid() = created_by))
  )
  with check (
    barangay_id = app.current_barangay_id()
    and (app.current_role() = 'admin' or (app.current_role() = 'staff' and auth.uid() = created_by))
  );

create policy revenues_delete on public.revenues for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');
