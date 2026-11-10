#!/usr/bin/env bash
# Windows·macOS 배포용 설치 파일을 GitHub Actions에서 동시에 빌드하고 ./release 에 내려받는다.
# 사용: pnpm desktop:installers [git-ref]   (기본: 현재 브랜치)
# 필요: gh CLI 로그인, 리포지토리 변수 DESKTOP_API_URL, ref가 push 되어 있을 것
set -euo pipefail

REF="${1:-$(git rev-parse --abbrev-ref HEAD)}"
OUT="release"
WORKFLOWS=(desktop-windows.yml desktop-macos.yml)

git fetch -q origin "$REF" 2>/dev/null || true
START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

for wf in "${WORKFLOWS[@]}"; do
  gh workflow run "$wf" --ref "$REF"
done

echo "빌드 시작: ref=$REF"
declare -a RUN_IDS=()
for wf in "${WORKFLOWS[@]}"; do
  id=""
  for _ in $(seq 1 30); do
    id="$(gh run list --workflow "$wf" --branch "$REF" --event workflow_dispatch \
      --json databaseId,createdAt --jq "[.[] | select(.createdAt >= \"$START\")][0].databaseId // empty")"
    [ -n "$id" ] && break
    sleep 2
  done
  [ -n "$id" ] || { echo "실행을 찾지 못했다: $wf" >&2; exit 1; }
  RUN_IDS+=("$id")
  echo "  $wf -> run $id"
done

fail=0
for id in "${RUN_IDS[@]}"; do
  gh run watch "$id" --exit-status >/dev/null || { echo "실패: run $id" >&2; fail=1; }
done
[ "$fail" -eq 0 ] || exit 1

rm -rf "$OUT" && mkdir -p "$OUT"
for id in "${RUN_IDS[@]}"; do
  gh run download "$id" --dir "$OUT"
done
echo "완료:"
find "$OUT" -type f \( -name '*.dmg' -o -name '*.msi' -o -name '*.exe' \)
