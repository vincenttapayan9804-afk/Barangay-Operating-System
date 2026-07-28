#!/bin/sh
# The image's own bundled /docker-entrypoint-initdb.d/migrate.sh (not the
# standard postgres entrypoint) is what actually runs its baked-in
# init-scripts/000...0-3 (creating authenticator, supabase_auth_admin,
# supabase_admin, supabase_storage_admin, supabase_functions_admin -- with NO
# password set) and then our mounted migrations/*.sql, all in one sequential
# top-level entrypoint step. This script MUST sort alphabetically after
# "migrate.sh" so those roles already exist when it runs -- naming it
# "00000000000004-..." (tried first) ran before migrate.sh instead, so
# `if exists (select 1 from pg_roles ...)` silently skipped every role.
#
# Every service in docker-compose.yml (auth, rest, realtime, ...) connects to
# `db` using one of these roles with $POSTGRES_PASSWORD, so without this step
# every such connection fails with "password authentication failed" no matter
# what the password is. The official self-hosted Supabase docker-compose
# ships an equivalent (jwt.sql/roles.sql) init step; this project never had
# one.
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
