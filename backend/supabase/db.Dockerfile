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

# pgbackrest pulls in postgresql-client-common, whose /usr/bin/pg_isready
# (and psql, pg_dump, ...) are version-dispatching wrapper scripts, not real
# binaries -- they refuse to run ("You must install at least one
# postgresql-client-<version> package") unless some postgresql-client-X
# package is also installed, since this image's own Postgres wasn't
# installed via apt. postgresql-client (any version) satisfies that
# dispatcher; pg_isready only needs a bare connection handshake, so a
# version mismatch with the server doesn't matter for this container's
# healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends pgbackrest postgresql-client \
    && rm -rf /var/lib/apt/lists/*
