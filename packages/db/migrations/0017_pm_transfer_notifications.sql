-- PM 넘기기 알림 종류를 추가한다 (기능 명세 F-06, 2026-11-17 결정).
-- 위임받은 멤버와 넘긴 PM 양쪽에 각각 통지한다.

ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('assigned', 'schedule_changed', 'due_soon', 'member_changed', 'client_application', 'pm_transferred'));
