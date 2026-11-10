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
apply_file() {
  local file="$1"
  local name="$2"
  if [ "$($PSQL "$DATABASE_URL" -tAq -c "SELECT 1 FROM schema_migrations WHERE name = '$name'")" = "1" ]; then
    echo "skip   $name"
  else
    # 마이그레이션과 기록을 한 트랜잭션으로 묶어 중간 실패 시 되돌린다.
    { echo 'BEGIN;'; cat "$file"; echo "INSERT INTO schema_migrations (name) VALUES ('$name');"; echo 'COMMIT;'; } | $PSQL "$DATABASE_URL" -v ON_ERROR_STOP=1 -q
    echo "apply  $name"
  fi
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
