#!/bin/sh
# The plain `supabase/postgres` image's own init scripts (000...0 through
# 000...3, which run before this one) create authenticator, supabase_auth_admin,
# supabase_admin, supabase_storage_admin, and supabase_functions_admin -- but
# leave every one of them with NO password set. Every service in
# docker-compose.yml (auth, rest, realtime, ...) connects to `db` using one of
# these roles with $POSTGRES_PASSWORD, so without this step every such
# connection fails with "password authentication failed" no matter what the
# password is. The official self-hosted Supabase docker-compose ships an
# equivalent (jwt.sql/roles.sql) init step; this project never had one.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	do \$\$
	declare
	  r text;
	begin
	  foreach r in array array[
	    'authenticator',
	    'supabase_auth_admin',
	    'supabase_admin',
	    'supabase_storage_admin',
	    'supabase_functions_admin',
	    'supabase_replication_admin'
	  ] loop
	    if exists (select 1 from pg_roles where rolname = r) then
	      execute format('alter role %I with password %L', r, '$POSTGRES_PASSWORD');
	    end if;
	  end loop;
	end \$\$;
EOSQL
