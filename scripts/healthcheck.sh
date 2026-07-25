#!/usr/bin/env bash
set -euo pipefail

POCKETBASE_URL="${POCKETBASE_URL:-http://localhost:8090}"

echo "Checking PocketBase health at $POCKETBASE_URL..."

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$POCKETBASE_URL/api/health" --max-time 10)

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "OK - PocketBase is healthy (HTTP $HTTP_STATUS)"
  exit 0
else
  echo "ERROR - PocketBase returned HTTP $HTTP_STATUS" >&2
  exit 1
fi
