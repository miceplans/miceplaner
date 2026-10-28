#!/usr/bin/env bash
# migrations/*.sql을 순서대로 한 번씩 적용한다. 적용 기록은 schema_migrations에 남긴다.
# 사용: DATABASE_URL=postgres://postgres@127.0.0.1:54320/miceplans packages/db/scripts/migrate.sh
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL이 필요하다 (마이그레이션 소유자 역할로 접속)}"
PSQL="${PSQL:-psql}"
DIR="$(cd "$(dirname "$0")/../migrations" && pwd)"

$PSQL "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c 'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
for file in "$DIR"/*.sql; do
  name="$(basename "$file")"
  if [ "$($PSQL "$DATABASE_URL" -tAq -c "SELECT 1 FROM schema_migrations WHERE name = '$name'")" = "1" ]; then
    echo "skip   $name"
  else
    # 마이그레이션과 기록을 한 트랜잭션으로 묶어 중간 실패 시 되돌린다.
    { echo 'BEGIN;'; cat "$file"; echo "INSERT INTO schema_migrations (name) VALUES ('$name');"; echo 'COMMIT;'; } | $PSQL "$DATABASE_URL" -v ON_ERROR_STOP=1 -q
    echo "apply  $name"
  fi
done
