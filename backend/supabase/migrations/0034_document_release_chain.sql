-- Security Phase 7: lightweight, non-blockchain tamper-evidence for
-- released documents, applying Phase 3's hash-chain technique
-- (0030_audit_log_hash_chain.sql) to document releases.
--
-- This is a dedicated, insert-only table populated exactly once per
-- document, at the moment it is released -- not columns bolted onto
-- document_requests itself. document_requests' own row order (id/created)
-- reflects when the *request* was filed, which can differ completely from
-- release order (a fast request can be released before a slower, earlier
-- one) -- chaining off that table's insert-time order would link the
-- wrong predecessor. A fresh identity column on this table, populated only
-- by the release trigger below, gives a true release-order sequence.
--
-- Same scope/limitation as 0030: detects modification of a released
-- document's snapshotted fields, or forging/reordering a release event in
-- the middle of the sequence. Does not protect against deleting the most
-- recent release event(s) outright (tail truncation) -- see 0030's header
-- for the general reasoning; anchoring the latest hash somewhere external
-- to this database is the only real defense against that and is out of
-- scope here.

create table public.document_release_chain (
  id uuid primary key default gen_random_uuid(),
  document_request_id uuid not null unique references public.document_requests(id) on delete cascade,
  barangay_id uuid not null references public.barangays(id) on delete cascade,
  chain_seq bigint generated always as identity,
  prev_hash text,
  row_hash text not null,
  created timestamptz not null default now()
);

create index idx_document_release_chain_barangay_id on public.document_release_chain (barangay_id);

alter table public.document_release_chain enable row level security;
alter table public.document_release_chain force row level security;

create policy document_release_chain_select on public.document_release_chain for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

-- No insert/update/delete policy for any client role: only the trigger
-- below (firing during the document_requests UPDATE statement, as the
-- table owner) ever writes here.

create or replace function app.compute_document_release_hash(
  p_prev_hash text,
  p_document_request_id uuid,
  p_barangay_id uuid,
  p_queue_number text,
  p_document_type text,
  p_other_document_type text,
  p_resident_name text,
  p_barangay_name text,
  p_released_at timestamptz,
  p_received_by text
) returns text
language sql immutable as $$
  select encode(
    digest(
      coalesce(p_prev_hash, '') || '|' ||
      coalesce(p_document_request_id::text, '') || '|' ||
      coalesce(p_barangay_id::text, '') || '|' ||
      coalesce(p_queue_number, '') || '|' ||
      coalesce(p_document_type, '') || '|' ||
      coalesce(p_other_document_type, '') || '|' ||
      coalesce(p_resident_name, '') || '|' ||
      coalesce(p_barangay_name, '') || '|' ||
      coalesce(p_released_at::text, '') || '|' ||
      coalesce(p_received_by, ''),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function app.document_requests_release_chain_trigger() returns trigger
language plpgsql as $$
declare
  v_prev_hash text;
begin
  if new.status = 'released' and (old.status is distinct from 'released') then
    select row_hash into v_prev_hash
      from public.document_release_chain
      where barangay_id = new.barangay_id
      order by chain_seq desc
      limit 1;

    insert into public.document_release_chain (
      document_request_id, barangay_id, prev_hash, row_hash
    ) values (
      new.id, new.barangay_id, v_prev_hash,
      app.compute_document_release_hash(
        v_prev_hash, new.id, new.barangay_id, new.queue_number, new.document_type,
        new.other_document_type, new.resident_name, new.barangay_name, new.released_at,
        new.received_by
      )
    );
  end if;
  return new;
end;
$$;

create trigger document_requests_release_chain_trigger
  after update on public.document_requests
  for each row execute function app.document_requests_release_chain_trigger();

-- Authenticated, tenant-scoped, admin-only full-chain verification (same
-- pattern as verify_activity_log_chain/verify_finance_audit_log_chain).
create or replace function public.verify_document_release_chain(p_barangay_id uuid)
returns table(document_request_id uuid, valid boolean) language plpgsql as $$
declare
  rec record;
  v_prev text := null;
  v_expected text;
begin
  if coalesce(app.current_role(), '') <> 'admin' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  for rec in
    select c.chain_seq, c.document_request_id, c.barangay_id, c.prev_hash, c.row_hash,
           d.queue_number, d.document_type, d.other_document_type, d.resident_name,
           d.barangay_name, d.released_at, d.received_by
    from public.document_release_chain c
    join public.document_requests d on d.id = c.document_request_id
    where c.barangay_id = p_barangay_id
    order by c.chain_seq asc
  loop
    v_expected := app.compute_document_release_hash(
      v_prev, rec.document_request_id, rec.barangay_id, rec.queue_number, rec.document_type,
      rec.other_document_type, rec.resident_name, rec.barangay_name, rec.released_at, rec.received_by
    );
    document_request_id := rec.document_request_id;
    valid := (rec.prev_hash is not distinct from v_prev) and (rec.row_hash = v_expected);
    v_prev := rec.row_hash;
    return next;
  end loop;
end;
$$;

grant execute on function public.verify_document_release_chain(uuid) to authenticated;

-- Public, single-document check: recomputes just this one row's hash from
-- its own stored (prev_hash, current document snapshot) and confirms it
-- matches the stored row_hash -- proving *this* document's released
-- snapshot hasn't been altered since the moment it was chained, without
-- exposing any other tenant's or any other document's release data (no
-- other row is ever read). This does not prove the whole chain is
-- unbroken end-to-end (that requires admin-level access via
-- verify_document_release_chain above) -- see get_public_document's header
-- (0026) for why this table can't just add a public RLS branch instead:
-- same enumeration/over-exposure concern.
create or replace function public.get_public_document_chain_status(p_document_request_id uuid)
returns table(chain_verified boolean, chain_recorded_at timestamptz)
language plpgsql
security definer
set search_path = public
stable as $$
declare
  rec record;
  v_expected text;
begin
  select c.prev_hash, c.row_hash, c.created, c.barangay_id,
         d.queue_number, d.document_type, d.other_document_type, d.resident_name,
         d.barangay_name, d.released_at, d.received_by
  into rec
  from public.document_release_chain c
  join public.document_requests d on d.id = c.document_request_id
  where c.document_request_id = p_document_request_id and d.status = 'released';

  if not found then
    return;
  end if;

  v_expected := app.compute_document_release_hash(
    rec.prev_hash, p_document_request_id, rec.barangay_id, rec.queue_number, rec.document_type,
    rec.other_document_type, rec.resident_name, rec.barangay_name, rec.released_at, rec.received_by
  );

  chain_verified := (rec.row_hash = v_expected);
  chain_recorded_at := rec.created;
  return next;
end;
$$;

revoke all on function public.get_public_document_chain_status(uuid) from public;
grant execute on function public.get_public_document_chain_status(uuid) to anon, authenticated;
