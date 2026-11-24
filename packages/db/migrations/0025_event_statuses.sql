-- 행사 상태에 실패·반려·종료를 추가한다 (Figma '상태 태그', 2026-11-24).
-- 변경 권한은 0024 트리거(events_guard_status)가 그대로 PM·AM만 허용한다.

ALTER TABLE events DROP CONSTRAINT events_status_check;
ALTER TABLE events ADD CONSTRAINT events_status_check CHECK (status IN ('진행중', '성공', '확인중', '실패', '만료', '보류중', '제출', '반려', '종료'));
