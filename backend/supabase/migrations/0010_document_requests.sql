-- Hard Part #1 (docs/SUPABASE_MIGRATION_PLAN.md): PocketBase's viewRule
-- allows `status = "released"` as a public OR-branch distinct from listRule
-- (no such public branch on list — released documents stay non-enumerable).
-- Postgres RLS has one SELECT policy governing both list and single-row
-- fetch, so porting the public branch directly into this table's RLS would
-- make every released document across every tenant listable via PostgREST
-- and over-expose internal fields (notes, assigned_to, etc.).
--
-- Fix: this table's own RLS stays tenant-authenticated ONLY (matching
-- listRule, no public branch). The public "view by id" path is instead
-- 0028_get_public_document_rpc.sql's get_public_document(doc_id)
-- SECURITY DEFINER function — granted to anon, returning only safe columns,
-- for status='released' rows only. `anon` is explicitly revoked from this
-- table below so there's no direct-table fallback.

create table public.document_requests (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  barangay_name text, -- denormalized snapshot for the public verification page (1785000034)
  queue_number text not null,
  resident_id uuid not null references public.residents(id) on delete restrict,
  resident_name text not null, -- denormalized, same pattern as barangay_name
  document_type text not null check (document_type in (
    'barangay_clearance','business_permit','certificate_of_indigency','certificate_of_residency',
    'certificate_of_good_moral','cedula','other')),
  other_document_type text,
  purpose text not null,
  status text not null check (status in ('pending','processing','for_release','released','cancelled')),
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  requested_at timestamptz not null default now(),
  released_at timestamptz,
  received_by text,
  signature_data text, -- base64 PNG, added 1785000035_document_signature.js (not a separate table)
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.document_requests
  for each row execute function app.set_updated_at();

create index idx_document_requests_queue_number on public.document_requests (queue_number);
create index idx_document_requests_status on public.document_requests (status);
create index idx_document_requests_document_type on public.document_requests (document_type);
create index idx_document_requests_resident_id on public.document_requests (resident_id);
create index idx_document_requests_barangay_status on public.document_requests (barangay_id, status);

alter table public.document_requests enable row level security;
alter table public.document_requests force row level security;

create policy document_requests_select on public.document_requests for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy document_requests_insert on public.document_requests for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy document_requests_update on public.document_requests for update
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'))
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy document_requests_delete on public.document_requests for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

revoke all on public.document_requests from anon;
