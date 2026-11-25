#!/usr/bin/env bash
# 기존 migrations/*.sql과 Drizzle custom SQL migration을 순서대로 한 번씩 적용한다.
# 적용 기록은 schema_migrations에 남긴다. 운영에서는 소유자 역할의 직접 연결만 쓴다.
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL이 필요하다 (마이그레이션 소유자 역할로 접속)}"
PSQL="${PSQL:-psql}"
DIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DRIZZLE_DIR="$ROOT/drizzle"

$PSQL "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c 'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'

# 번호가 바뀐 마이그레이션의 옛 이름. 이미 옛 이름으로 적용된 환경에서 새 이름을 미적용으로 보고 다시 실행하는 걸 막는다.
renamed_from() {
  case "$1" in
    0008_wiki_collab.sql) echo 0007_wiki_collab.sql ;;
    0009_files_dense.sql) echo 0008_files_dense.sql ;;
    0010_event_files_item.sql) echo 0009_event_files_item.sql ;;
    0011_password_login.sql) echo 0009_password_login.sql ;;
    0012_import_jobs.sql) echo 0010_import_jobs.sql ;;
    0013_import_fixed_values.sql) echo 0011_import_fixed_values.sql ;;
    0014_event_budget.sql) echo 0012_event_budget.sql ;;
    0015_event_creation.sql) echo 0010_event_creation.sql 0012_event_creation.sql ;;
    0016_client_applications.sql) echo 0013_client_applications.sql ;;
    0017_pm_transfer_notifications.sql) echo 0013_pm_transfer_notifications.sql ;;
    0028_event_item_times.sql) echo 0027_event_item_times.sql ;;
    0029_event_products.sql) echo 0028_event_products.sql ;;
    0030_event_calendar_blocks.sql) echo 0029_event_calendar_blocks.sql ;;
    *) echo '' ;;
  esac
}

apply_file() {
  local file="$1"
  local name="$2"
  if [ "$($PSQL "$DATABASE_URL" -tAq -c "SELECT 1 FROM schema_migrations WHERE name = '$name'")" = "1" ]; then
    echo "skip   $name"
    return 0
  fi
  # 옛 이름으로 이미 적용됐다. 다시 실행하지 않고 새 이름으로 기록만 남긴다.
  local old
  for old in $(renamed_from "$name"); do
    if [ "$($PSQL "$DATABASE_URL" -tAq -c "SELECT 1 FROM schema_migrations WHERE name = '$old'")" = "1" ]; then
      $PSQL "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "INSERT INTO schema_migrations (name) VALUES ('$name') ON CONFLICT DO NOTHING"
      echo "rename $name (was $old)"
      return
    fi
  done
  # 마이그레이션과 기록을 한 트랜잭션으로 묶어 중간 실패 시 되돌린다.
  { echo 'BEGIN;'; cat "$file"; echo "INSERT INTO schema_migrations (name) VALUES ('$name');"; echo 'COMMIT;'; } | $PSQL "$DATABASE_URL" -v ON_ERROR_STOP=1 -q
  echo "apply  $name"
}

# 기존 이력은 파일명만 기록돼 있으므로 그대로 유지한다.
for file in "$DIR"/*.sql; do
  apply_file "$file" "$(basename "$file")"
done

# Drizzle Kit의 custom migration은 별도 디렉터리에 두어 기존 이력과 충돌시키지 않는다.
if [ -d "$DRIZZLE_DIR" ]; then
  while IFS= read -r file; do
    apply_file "$file" "${file#"$ROOT/"}"
  done < <(find "$DRIZZLE_DIR" -type f -name '*.sql' -print | sort)
fi
