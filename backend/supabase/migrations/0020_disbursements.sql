create table public.disbursements (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  appropriation uuid references public.appropriations(id) on delete set null,
  payee text,
  disbursement_date date,
  amount numeric,
  check_no text,
  or_no text,
  particular text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.disbursements
  for each row execute function app.set_updated_at();

create index idx_disbursements_appropriation on public.disbursements (appropriation);
create index idx_disbursements_date on public.disbursements (disbursement_date);

alter table public.disbursements enable row level security;
alter table public.disbursements force row level security;

create policy disbursements_select on public.disbursements for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy disbursements_insert on public.disbursements for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy disbursements_update on public.disbursements for update
  using (
    barangay_id = app.current_barangay_id()
    and (app.current_role() = 'admin' or (app.current_role() = 'staff' and auth.uid() = created_by))
  )
  with check (
    barangay_id = app.current_barangay_id()
    and (app.current_role() = 'admin' or (app.current_role() = 'staff' and auth.uid() = created_by))
  );

create policy disbursements_delete on public.disbursements for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');
