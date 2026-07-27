#!/bin/bash
# Phase 6 backup loop, run by the `backup` service in docker-compose.yml.
# archive_command (set on the `db` service itself — see the `command:`
# override in docker-compose.yml) continuously ships WAL segments to S3 the
# moment each one fills, exactly like litestream's own sync-interval did for
# SQLite's WAL. This script adds the other half backups always need:
# periodic full/incremental base backups, so a restore doesn't have to
# replay the entire WAL history since day one.
set -euo pipefail

STANZA="${PGBACKREST_STANZA:-barangay}"
PG_HOST="${PGBACKREST_PG1_HOST:-db}"
PG_USER="${PGBACKREST_PG1_USER:-postgres}"

until pg_isready -h "$PG_HOST" -U "$PG_USER" >/dev/null 2>&1; do
  echo "backup-cron: waiting for $PG_HOST..."
  sleep 2
done

# stanza-create is safe to re-run — pgbackrest no-ops if the stanza already
# exists and matches, and fails loudly (not silently) if it exists but the
# config has since drifted, which is the behavior an operator actually
# wants to see on next boot rather than a silently-stale backup target.
pgbackrest --stanza="$STANZA" stanza-create

while true; do
  if [ "$(date -u +%u)" = "7" ]; then
    echo "backup-cron: $(date -u -Iseconds) full backup"
    pgbackrest --stanza="$STANZA" --type=full backup
  else
    echo "backup-cron: $(date -u -Iseconds) incremental backup"
    pgbackrest --stanza="$STANZA" --type=incr backup
  fi
  sleep 86400
done
