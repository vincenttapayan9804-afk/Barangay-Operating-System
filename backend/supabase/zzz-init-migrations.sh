#!/bin/sh
# supabase/postgres only auto-runs *.sql/*.sh files directly inside
# docker-entrypoint-initdb.d on first boot, not subdirectories. This applies
# ./migrations/*.sql (mounted read-only alongside this script) in filename
# order, the same order verified in backend/supabase/verify/.
set -e
for f in /docker-entrypoint-initdb.d/migrations/*.sql; do
  echo "Applying $f"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done
