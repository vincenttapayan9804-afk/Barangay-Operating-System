#!/usr/bin/env bash
set -euo pipefail

# GoTrue's own port, published directly in backend/supabase/docker-compose.yml
# (127.0.0.1:9999) — not the public Kong URL, which requires an apikey header
# on every route and would turn a healthy backend into a false "unhealthy"
# 401 here.
AUTH_URL="${AUTH_URL:-http://localhost:9999}"

echo "Checking backend health at $AUTH_URL..."

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$AUTH_URL/health" --max-time 10)

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "OK - Auth (GoTrue) is healthy (HTTP $HTTP_STATUS)"
  exit 0
else
  echo "ERROR - Auth (GoTrue) returned HTTP $HTTP_STATUS" >&2
  exit 1
fi
