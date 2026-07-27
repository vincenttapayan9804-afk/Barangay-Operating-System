-- Phase 0 spike ONLY. Reimplements the two Supabase Postgres extension
-- functions that RLS policies actually depend on (auth.jwt(), auth.uid()),
-- so app.current_barangay_id() etc. and RLS policies can be exercised
-- against a bare Postgres instance without GoTrue/PostgREST running.
--
-- These are not spike inventions — this is the real supabase/postgres
-- extension's implementation (both read the `request.jwt.claims` GUC that
-- PostgREST sets per-request from the verified JWT). Do NOT carry this file
-- into Phase 1 as a migration: the real self-hosted stack ships these via
-- the supabase/postgres Docker image's auth schema, already installed.
-- Redefining them here would conflict with the real image's own definitions.

create schema if not exists auth;

create or replace function auth.jwt() returns jsonb
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;

create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;

create or replace function auth.role() returns text
  language sql stable
  as $$ select nullif(auth.jwt()->>'role','')::text $$;
