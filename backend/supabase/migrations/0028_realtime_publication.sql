-- Phase 6 (infra/ops rebuild): wires the three tables the frontend actually
-- subscribes to (frontend/src/hooks/useRealtimeCollection.ts callers —
-- document_requests, blotter_records, visitor_logs) into Realtime's
-- postgres_changes publication.
--
-- Phase 0's spike proved postgres_changes respects RLS end-to-end; it did
-- not need this step because the spike subscribed to a table added to the
-- publication by hand for that one test. Nothing in Phases 1-5 added any
-- table to a publication, so without this migration, Phase 6's `realtime`
-- service would come up healthy but silently deliver zero events for every
-- one of the three tables above — a real gap this phase closes, not a
-- pre-existing bug.
--
-- The real supabase/postgres image creates an empty `supabase_realtime`
-- publication as part of its own bootstrap; the guard below also makes this
-- migration apply cleanly against a bare Postgres instance (this repo's own
-- verify/00_test_env.sql target) that has no such publication yet.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['document_requests', 'blotter_records', 'visitor_logs']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
