-- Security Phase 3: cryptographic hash-chain for activity_logs and
-- finance_audit_logs. Each row's `row_hash` is a SHA-256 digest of its own
-- content plus the *previous* row's `row_hash` (chained per barangay_id,
-- matching this schema's tenant-scoping and RLS model) — so tampering with
-- (or deleting from the middle of) the historical record breaks the chain
-- for every row after the tampered one, detectable by recomputing the
-- chain and comparing.
--
-- Scope/limitation, stated plainly: this detects modification of existing
-- rows and insertion of forged rows into the middle of the sequence. It
-- does NOT protect against truncation of the tail — deleting the most
-- recent N rows leaves no later row whose stored prev_hash would fail to
-- match, since nothing chains forward from a row that no longer has a
-- successor. activity_logs already has an admin delete policy (see
-- 0012_activity_logs.sql, kept as-is — a legitimate retention/pruning
-- capability, not a bug introduced here); anyone relying on this chain for
-- non-repudiation of *deletions* needs an external anchor (e.g. Phase 7's
-- document tamper-evidence periodically publishing the latest row_hash
-- somewhere outside this database), not just the in-table chain.
--
-- `chain_seq` (not `created`/`id`) resolves "previous row": `created` is
-- assigned once per statement (every row in a single multi-row INSERT gets
-- the *same* timestamp — verified empirically while building this
-- migration), and `id` is a random uuid, so a created+id tiebreak can pick
-- the wrong predecessor whenever two rows share a timestamp. A `generated
-- always as identity` column is assigned per-row before this BEFORE INSERT
-- trigger runs, giving a real monotonic order regardless of batch size or
-- timestamp collisions.

create or replace function app.compute_audit_row_hash(
  p_prev_hash text,
  p_barangay_id uuid,
  p_action text,
  p_collection text,
  p_record_id text,
  p_details text,
  p_amount numeric,
  p_user_name text,
  p_created timestamptz
) returns text
language sql immutable as $$
  select encode(
    digest(
      coalesce(p_prev_hash, '') || '|' ||
      coalesce(p_barangay_id::text, '') || '|' ||
      coalesce(p_action, '') || '|' ||
      coalesce(p_collection, '') || '|' ||
      coalesce(p_record_id, '') || '|' ||
      coalesce(p_details, '') || '|' ||
      coalesce(p_amount::text, '') || '|' ||
      coalesce(p_user_name, '') || '|' ||
      coalesce(p_created::text, ''),
      'sha256'
    ),
    'hex'
  );
$$;

-- ---------------------------------------------------------------------
-- activity_logs
-- ---------------------------------------------------------------------
alter table public.activity_logs add column chain_seq bigint generated always as identity;
alter table public.activity_logs add column prev_hash text;
alter table public.activity_logs add column row_hash text;

create or replace function app.activity_logs_chain_trigger() returns trigger
language plpgsql as $$
declare
  v_prev_hash text;
begin
  select row_hash into v_prev_hash
    from public.activity_logs
    where barangay_id = new.barangay_id
    order by chain_seq desc
    limit 1;

  new.prev_hash := v_prev_hash;
  new.row_hash := app.compute_audit_row_hash(
    v_prev_hash, new.barangay_id, new.action, new.collection, new.record_id,
    new.details, null, new.user_name, new.created
  );
  return new;
end;
$$;

create trigger activity_logs_chain_trigger
  before insert on public.activity_logs
  for each row execute function app.activity_logs_chain_trigger();

-- ---------------------------------------------------------------------
-- finance_audit_logs
-- ---------------------------------------------------------------------
alter table public.finance_audit_logs add column chain_seq bigint generated always as identity;
alter table public.finance_audit_logs add column prev_hash text;
alter table public.finance_audit_logs add column row_hash text;

create or replace function app.finance_audit_logs_chain_trigger() returns trigger
language plpgsql as $$
declare
  v_prev_hash text;
begin
  select row_hash into v_prev_hash
    from public.finance_audit_logs
    where barangay_id = new.barangay_id
    order by chain_seq desc
    limit 1;

  new.prev_hash := v_prev_hash;
  new.row_hash := app.compute_audit_row_hash(
    v_prev_hash, new.barangay_id, new.action, new.collection_name, new.record_id,
    new.details, new.amount, new.user_name, new.created
  );
  return new;
end;
$$;

create trigger finance_audit_logs_chain_trigger
  before insert on public.finance_audit_logs
  for each row execute function app.finance_audit_logs_chain_trigger();

-- ---------------------------------------------------------------------
-- Verification RPCs — recompute each barangay's chain from scratch and
-- report the first row where the stored hash no longer matches (tamper or
-- reorder). Callable by admin only (mirrors assets/meetings-style
-- staff-vs-admin gating elsewhere in this schema); no SECURITY DEFINER
-- needed since RLS already scopes the underlying select to the caller's
-- own tenant.
-- ---------------------------------------------------------------------
create or replace function public.verify_activity_log_chain(p_barangay_id uuid)
returns table(id uuid, valid boolean) language plpgsql as $$
declare
  rec record;
  v_prev text := null;
  v_expected text;
begin
  if coalesce(app.current_role(), '') <> 'admin' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  for rec in
    select * from public.activity_logs
    where barangay_id = p_barangay_id
    order by chain_seq asc
  loop
    v_expected := app.compute_audit_row_hash(
      v_prev, rec.barangay_id, rec.action, rec.collection, rec.record_id,
      rec.details, null, rec.user_name, rec.created
    );
    id := rec.id;
    valid := (rec.prev_hash is not distinct from v_prev) and (rec.row_hash = v_expected);
    v_prev := rec.row_hash;
    return next;
  end loop;
end;
$$;

create or replace function public.verify_finance_audit_log_chain(p_barangay_id uuid)
returns table(id uuid, valid boolean) language plpgsql as $$
declare
  rec record;
  v_prev text := null;
  v_expected text;
begin
  if coalesce(app.current_role(), '') <> 'admin' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  for rec in
    select * from public.finance_audit_logs
    where barangay_id = p_barangay_id
    order by chain_seq asc
  loop
    v_expected := app.compute_audit_row_hash(
      v_prev, rec.barangay_id, rec.action, rec.collection_name, rec.record_id,
      rec.details, rec.amount, rec.user_name, rec.created
    );
    id := rec.id;
    valid := (rec.prev_hash is not distinct from v_prev) and (rec.row_hash = v_expected);
    v_prev := rec.row_hash;
    return next;
  end loop;
end;
$$;

grant execute on function public.verify_activity_log_chain(uuid) to authenticated;
grant execute on function public.verify_finance_audit_log_chain(uuid) to authenticated;
