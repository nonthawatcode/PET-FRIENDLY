#!/usr/bin/env bash
# Runs the migration, seed and stock-rule tests against a throwaway local Postgres database.
# Needs a running Postgres you can reach as a superuser (PGHOST/PGUSER/PGPASSWORD env vars apply).
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-petfriendly_test}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"; }
run tests/db/auth_stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
run supabase/seed.sql
psql -v ON_ERROR_STOP=1 -d "$DB" -f tests/db/stock_rules.sql 2>&1 | sed -n 's/.*NOTICE:  //p; /ALL TESTS PASSED/p; /ERROR/p'
