# Extends the real supabase/postgres image with the one binary it doesn't
# ship: pgBackRest (Phase 6 — replaces backend/litestream.yml's SQLite WAL
# streaming, which has no equivalent once the data directory is a real
# Postgres cluster instead of a single file).
#
# archive_command runs as a subprocess of the postgres server itself, so
# the pgbackrest CLI has to live inside this same image — a separate sidecar
# container (litestream's own model) can't do it for Postgres the way it
# could for SQLite's single-file WAL.
FROM supabase/postgres:15.8.1.040

RUN apt-get update \
    && apt-get install -y --no-install-recommends pgbackrest \
    && rm -rf /var/lib/apt/lists/*
