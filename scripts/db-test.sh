#!/usr/bin/env bash
# Spielt alle Migrationen in eine frische lokale Test-DB ein und führt die SQL-Tests aus.
# Voraussetzung: lokales Postgres 16 (PGHOST/PGPORT/PGUSER). In CI: Service-Container postgres:16.
set -euo pipefail
cd "$(dirname "$0")/.."

export PGHOST="${PGHOST:-/tmp}" PGPORT="${PGPORT:-54322}" PGUSER="${PGUSER:-postgres}"
DB="${TEST_DB:-jarvis_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")

dropdb --if-exists "$DB" >/dev/null
createdb "$DB"

"${PSQL[@]}" -f supabase/tests/00_local_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "→ Migration $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -f supabase/tests/05_test_helpers.sql

for f in supabase/tests/[12]*.sql; do
  echo "→ Test $(basename "$f")"
  "${PSQL[@]}" -f "$f" >/dev/null
done

echo "→ Demo-Seed laden (frischer Nutzer)"
"${PSQL[@]}" -c "insert into auth.users (id, email) values ('00000000-0000-4000-a000-0000000000dd','seed@example.invalid'); insert into public.profiles (id) values ('00000000-0000-4000-a000-0000000000dd') on conflict do nothing;" >/dev/null
"${PSQL[@]}" -v uid="'00000000-0000-4000-a000-0000000000dd'" -f seed/demo.sql >/dev/null
"${PSQL[@]}" -v uid="'00000000-0000-4000-a000-0000000000dd'" -f seed/demo.sql >/dev/null   # idempotent
"${PSQL[@]}" -c "select test.ok('seed: 6 Beispielaufgaben, idempotent', (select count(*) from public.tasks where user_id = '00000000-0000-4000-a000-0000000000dd') = 6)" >/dev/null

"${PSQL[@]}" -t -A -F $'\t' -c "select case when ok then 'PASS' else 'FAIL' end, name, coalesce(detail,'') from test.results order by id" \
  | awk -F'\t' '{ if ($1=="FAIL") printf "  ✗ %s  [%s]\n", $2, $3; else printf "  ✓ %s\n", $2 }'

read -r total failed < <("${PSQL[@]}" -t -A -F ' ' -c "select count(*), count(*) filter (where not ok) from test.results")
echo "DB-Tests: $total gesamt, $failed fehlgeschlagen"
[ "$failed" -eq 0 ]
