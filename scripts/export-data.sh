#!/usr/bin/env bash
set -euo pipefail

POCKETBASE_URL="${POCKETBASE_URL:-http://localhost:8090}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
FORMAT="${1:-json}"
OUTPUT_DIR="${2:-./exports}"

if [ -z "$ADMIN_PASSWORD" ]; then
  echo "Error: ADMIN_PASSWORD must be set" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Authenticate with PocketBase admin API
TOKEN=$(curl -s -X POST "$POCKETBASE_URL/api/admins/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}" \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Error: Authentication failed" >&2
  exit 1
fi

# Export collections
echo "Exporting all collections to $FORMAT..."

for collection in users records; do
  echo "  -> $collection"
  curl -s -X GET "$POCKETBASE_URL/api/collections/$collection/records?export=$FORMAT" \
    -H "Authorization: Bearer $TOKEN" \
    -o "$OUTPUT_DIR/${collection}.${FORMAT}"
done

echo "Done. Exports saved to $OUTPUT_DIR/"
