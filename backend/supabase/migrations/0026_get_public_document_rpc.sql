-- Hard Part #1 resolution (see 0010_document_requests.sql's header comment
-- for the full reasoning): public QR-code verification needs a way to view
-- a single released document by id, unauthenticated, without exposing the
-- table to enumeration or leaking internal-workflow fields (notes,
-- assigned_to, signature_data, etc.) the way a raw RLS carve-out would.
--
-- SECURITY DEFINER + fixed search_path so it runs with the defining role's
-- privileges (bypassing document_requests' RLS deliberately, the same way
-- PocketBase's superuser-bypassed API rule evaluation worked) but only
-- returns the specific safe columns listed below, and only for
-- status = 'released' rows — not enumerable (a random/guessed uuid gets
-- zero rows, not an error), and every other field on the document (notes,
-- assigned_to, signature_data) stays invisible even to this function's
-- caller.

create or replace function public.get_public_document(doc_id uuid)
returns table (
  id uuid,
  queue_number text,
  document_type text,
  other_document_type text,
  status text,
  resident_name text,
  barangay_name text,
  released_at timestamptz,
  received_by text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    id, queue_number, document_type, other_document_type, status,
    resident_name, barangay_name, released_at, received_by
  from public.document_requests
  where id = doc_id and status = 'released';
$$;

revoke all on function public.get_public_document(uuid) from public;
grant execute on function public.get_public_document(uuid) to anon, authenticated;
