-- Standard Government Forms Phase 0: shared foundation for auto-generating
-- official COA/GAM, BIR, DBM, and DOLE forms from the system's own data.
--
-- This migration adds only the cross-agency plumbing -- a single ledger of
-- every generated form instance, tamper-evident via the same hash-chain
-- technique as 0030_audit_log_hash_chain.sql/0034_document_release_chain.sql.
-- The concrete form types (RCD, DV, BIR 2307, Barangay Budget Form 1, TUPAD
-- Annex D, ...) are intentionally NOT enumerated in a CHECK constraint here:
-- several of their official codes/titles are still pending primary-source
-- verification (see the Phase 1-4 research notes), and document_requests'
-- fixed CHECK-constrained document_type enum (0010_document_requests.sql)
-- is exactly the extensibility problem this table avoids repeating --
-- form_code is free text, validated at the application layer per phase.
--
-- Unlike document_release_chain (a derived log populated by a trigger on a
-- *different* table), this table IS the primary record of a generated form,
-- so it needs its own insert-time hash chain rather than reacting to
-- someone else's UPDATE. Once generated, a form is never edited or deleted
-- (no update/delete RLS policy at all) -- "voiding" a wrong form means
-- inserting a new row with status='void' that references the original via
-- supersedes_id, preserving full history instead of mutating it.

create table public.generated_government_forms (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null default app.current_barangay_id() references public.barangays(id) on delete cascade,
  agency text not null check (agency in ('coa', 'bir', 'dbm', 'dole')),
  form_code text not null,
  title text not null,
  period_covered text,
  input_data jsonb not null default '{}'::jsonb,
  status text not null default 'final' check (status in ('final', 'void')),
  supersedes_id uuid references public.generated_government_forms(id) on delete set null,
  generated_by uuid references auth.users(id) on delete set null,
  chain_seq bigint generated always as identity,
  prev_hash text,
  row_hash text not null,
  created timestamptz not null default now()
);

create index idx_generated_government_forms_barangay_id on public.generated_government_forms (barangay_id);
create index idx_generated_government_forms_agency on public.generated_government_forms (barangay_id, agency);

alter table public.generated_government_forms enable row level security;
alter table public.generated_government_forms force row level security;

-- Same admin/staff-only gate as every Finance table (fund_sources,
-- appropriations, disbursements, ...) -- this whole module sits behind
-- ProtectedRoute roles={['admin','staff']}, no viewer access.
create policy generated_government_forms_select on public.generated_government_forms for select
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin', 'staff'));

create policy generated_government_forms_insert on public.generated_government_forms for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin', 'staff'));

-- No update/delete policy for any client role -- immutable once inserted,
-- same as activity_logs/finance_audit_logs.

create or replace function app.compute_government_form_hash(
  p_prev_hash text,
  p_barangay_id uuid,
  p_agency text,
  p_form_code text,
  p_title text,
  p_period_covered text,
  p_input_data jsonb,
  p_status text,
  p_supersedes_id uuid,
  p_generated_by uuid
) returns text
language sql immutable as $$
  select encode(
    digest(
      coalesce(p_prev_hash, '') || '|' ||
      coalesce(p_barangay_id::text, '') || '|' ||
      coalesce(p_agency, '') || '|' ||
      coalesce(p_form_code, '') || '|' ||
      coalesce(p_title, '') || '|' ||
      coalesce(p_period_covered, '') || '|' ||
      coalesce(p_input_data::text, '') || '|' ||
      coalesce(p_status, '') || '|' ||
      coalesce(p_supersedes_id::text, '') || '|' ||
      coalesce(p_generated_by::text, ''),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function app.generated_government_forms_chain_trigger() returns trigger
language plpgsql as $$
declare
  v_prev_hash text;
begin
  select row_hash into v_prev_hash
    from public.generated_government_forms
    where barangay_id = new.barangay_id
    order by chain_seq desc
    limit 1;

  new.prev_hash := v_prev_hash;
  new.row_hash := app.compute_government_form_hash(
    v_prev_hash, new.barangay_id, new.agency, new.form_code, new.title,
    new.period_covered, new.input_data, new.status, new.supersedes_id, new.generated_by
  );
  return new;
end;
$$;

create trigger generated_government_forms_chain_trigger
  before insert on public.generated_government_forms
  for each row execute function app.generated_government_forms_chain_trigger();

-- Authenticated, tenant-scoped, admin-only full-chain verification (same
-- pattern as verify_document_release_chain/verify_finance_audit_log_chain).
create or replace function public.verify_government_form_chain(p_barangay_id uuid)
returns table(form_id uuid, valid boolean) language plpgsql as $$
declare
  rec record;
  v_prev text := null;
  v_expected text;
begin
  if coalesce(app.current_role(), '') <> 'admin' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  for rec in
    select id, chain_seq, barangay_id, agency, form_code, title, period_covered,
           input_data, status, supersedes_id, generated_by, prev_hash, row_hash
    from public.generated_government_forms
    where barangay_id = p_barangay_id
    order by chain_seq asc
  loop
    v_expected := app.compute_government_form_hash(
      v_prev, rec.barangay_id, rec.agency, rec.form_code, rec.title, rec.period_covered,
      rec.input_data, rec.status, rec.supersedes_id, rec.generated_by
    );
    form_id := rec.id;
    valid := (rec.prev_hash is not distinct from v_prev) and (rec.row_hash = v_expected);
    v_prev := rec.row_hash;
    return next;
  end loop;
end;
$$;

grant execute on function public.verify_government_form_chain(uuid) to authenticated;
