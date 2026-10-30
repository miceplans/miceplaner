-- 목록·포털 조회는 soft delete와 공개 상태를 항상 함께 필터링한다.
-- 그 경로에만 맞춘 부분 인덱스로 읽기 비용을 낮추고 불필요한 인덱스 쓰기 비용은 피한다.

CREATE INDEX events_active_start_date_idx
  ON events (start_date, name)
  WHERE deleted_at IS NULL;

CREATE INDEX event_clients_client_user_event_idx
  ON event_clients (client_user_id, event_id);

CREATE INDEX event_items_public_program_idx
  ON event_items (event_id, starts_on, title)
  WHERE kind = 'program' AND client_visible AND deleted_at IS NULL;

CREATE INDEX leave_requests_active_user_date_idx
  ON leave_requests (user_id, leave_date)
  WHERE deleted_at IS NULL;
