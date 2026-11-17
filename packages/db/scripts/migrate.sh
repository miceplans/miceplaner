#!/usr/bin/env bash
# migrations/*.sql을 순서대로 한 번씩 적용한다. 적용 기록은 schema_migrations에 남긴다.
# 사용: DATABASE_URL=postgres://postgres@127.0.0.1:54320/miceplans packages/db/scripts/migrate.sh
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL이 필요하다 (마이그레이션 소유자 역할로 접속)}"
PSQL="${PSQL:-psql}"
DIR="$(cd "$(dirname "$0")/../migrations" && pwd)"

$PSQL "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c 'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'

# 번호가 바뀐 마이그레이션의 옛 이름. 이미 옛 이름으로 적용된 환경에서 새 이름을 미적용으로 보고 다시 실행하는 걸 막는다.
renamed_from() {
  case "$1" in
    0008_wiki_collab.sql) echo 0007_wiki_collab.sql ;;
    0009_files_dense.sql) echo 0008_files_dense.sql ;;
    0010_event_files_item.sql) echo 0009_event_files_item.sql ;;
    0011_password_login.sql) echo 0009_password_login.sql ;;
    *) echo '' ;;
  esac
}

for file in "$DIR"/*.sql; do
  name="$(basename "$file")"
  if [ "$($PSQL "$DATABASE_URL" -tAq -c "SELECT 1 FROM schema_migrations WHERE name = '$name'")" = "1" ]; then
    echo "skip   $name"
    continue
  fi
  old="$(renamed_from "$name")"
  if [ -n "$old" ] && [ "$($PSQL "$DATABASE_URL" -tAq -c "SELECT 1 FROM schema_migrations WHERE name = '$old'")" = "1" ]; then
    # 옛 이름으로 이미 적용됐다. 다시 실행하지 않고 새 이름으로 기록만 남긴다.
    $PSQL "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "INSERT INTO schema_migrations (name) VALUES ('$name') ON CONFLICT DO NOTHING"
    echo "rename $name (was $old)"
    continue
  fi
  # 마이그레이션과 기록을 한 트랜잭션으로 묶어 중간 실패 시 되돌린다.
  { echo 'BEGIN;'; cat "$file"; echo "INSERT INTO schema_migrations (name) VALUES ('$name');"; echo 'COMMIT;'; } | $PSQL "$DATABASE_URL" -v ON_ERROR_STOP=1 -q
  echo "apply  $name"
done
