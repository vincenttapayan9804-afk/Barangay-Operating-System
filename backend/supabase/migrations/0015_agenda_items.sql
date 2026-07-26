create table public.agenda_items (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  title text not null,
  description text,
  sort_order numeric,
  status text not null check (status in ('pending','discussed','deferred')),
  minutes text,
  submitted_by text,
  submitted_at timestamptz not null default now(),
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.agenda_items
  for each row execute function app.set_updated_at();

create index idx_agenda_items_meeting_id on public.agenda_items (meeting_id);
create index idx_agenda_items_sort_order on public.agenda_items (sort_order);

alter table public.agenda_items enable row level security;
alter table public.agenda_items force row level security;

create policy agenda_items_select on public.agenda_items for select
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy agenda_items_insert on public.agenda_items for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy agenda_items_update on public.agenda_items for update
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'))
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy agenda_items_delete on public.agenda_items for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));
