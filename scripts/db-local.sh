#!/usr/bin/env bash
# Richtet die lokale Entwicklungs-Datenbank "jarvis_dev" ein (Supabase-Stub + Migrationen + lokale Anmeldung).
# ACHTUNG: --reset löscht die Datenbank vollständig.
set -euo pipefail
cd "$(dirname "$0")/.."
export PGHOST="${PGHOST:-/tmp}" PGPORT="${PGPORT:-54322}" PGUSER="${PGUSER:-postgres}"
DB="${DEV_DB:-jarvis_dev}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")

if [ "${1:-}" = "--reset" ]; then dropdb --if-exists "$DB"; fi
if ! psql -X -tAc "select 1 from pg_database where datname='$DB'" -d postgres | grep -q 1; then
  createdb "$DB"
  "${PSQL[@]}" -f supabase/tests/00_local_supabase_stub.sql
  for f in supabase/migrations/*.sql; do echo "→ $(basename "$f")"; "${PSQL[@]}" -f "$f"; done
  "${PSQL[@]}" -f supabase/local/10_local_auth.sql
  echo "✓ $DB angelegt"
else
  echo "✓ $DB existiert bereits (mit --reset neu anlegen)"
fi
