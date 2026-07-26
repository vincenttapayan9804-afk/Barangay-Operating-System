-- Verification-harness-ONLY. The real supabase/postgres image ships
-- default privileges granting PostgREST's anon/authenticated roles broad
-- table/function access in `public`, relying on RLS (not GRANT) as the
-- actual security boundary — same model PostgREST always uses. Replicated
-- here so the migrations can be tested standalone.

grant usage on schema app to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- 0010_document_requests.sql explicitly revokes anon from this one table —
-- re-assert it here so the grant above doesn't accidentally undo the point
-- of Hard Part #1's fix (the migration's own revoke already handles this
-- when run in order, this is just a guard against reordering the two
-- scripts in future edits).
revoke all on public.document_requests from anon;
