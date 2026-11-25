-- 행사 상세의 스케줄·할 일을 브라우저 저장에서 event_items로 옮긴다 (명세 F-04, 2026-11-24 결정).
-- 스케줄은 날짜와 함께 시작·종료 시각을 가지므로 자정 기준 분 단위 시각을 둔다. 날짜는 due_on을 쓴다.
-- 웹에서 만든 항목은 클라이언트가 만든 uuid를 그대로 id로 쓸 수 있다(생성 API의 선택 필드).

ALTER TABLE event_items
  ADD COLUMN start_minute smallint CHECK (start_minute BETWEEN 0 AND 1440),
  ADD COLUMN end_minute   smallint CHECK (end_minute BETWEEN 0 AND 1440),
  ADD CONSTRAINT event_items_minutes_order CHECK (start_minute IS NULL OR end_minute IS NULL OR end_minute > start_minute);
