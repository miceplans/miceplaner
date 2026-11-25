-- 행사 상세 캘린더에서 직접 추가한 일정 블록을 브라우저 저장에서 서버로 옮긴다 (명세 F-04, 2026-11-24 결정).
-- 블록은 웹이 만든 uuid로 식별하고 PUT으로 통째로 저장한다(마지막 저장 우선). 시각은 자정 기준 분이다.

CREATE TABLE event_calendar_blocks (
  id           uuid PRIMARY KEY,
  event_id     uuid NOT NULL REFERENCES events (id),
  title        text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  block_date   date NOT NULL,
  start_minute smallint NOT NULL CHECK (start_minute BETWEEN 0 AND 1440),
  end_minute   smallint NOT NULL CHECK (end_minute BETWEEN 0 AND 1440),
  created_by   uuid NOT NULL REFERENCES users (id),
  updated_by   uuid NOT NULL REFERENCES users (id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  CHECK (end_minute > start_minute)
);
CREATE INDEX event_calendar_blocks_event_idx ON event_calendar_blocks (event_id, block_date) WHERE deleted_at IS NULL;

CREATE FUNCTION event_calendar_blocks_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_id <> OLD.event_id OR NEW.created_by <> OLD.created_by THEN
    RAISE EXCEPTION '일정 블록의 행사와 만든 사람은 바꿀 수 없다' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER event_calendar_blocks_guard BEFORE UPDATE ON event_calendar_blocks FOR EACH ROW EXECUTE FUNCTION event_calendar_blocks_guard();

ALTER TABLE event_calendar_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_calendar_blocks FORCE ROW LEVEL SECURITY;
CREATE POLICY event_calendar_blocks_select ON event_calendar_blocks FOR SELECT USING (is_internal() AND deleted_at IS NULL);
CREATE POLICY event_calendar_blocks_insert ON event_calendar_blocks FOR INSERT
  WITH CHECK (can_edit_event_items(event_id) AND created_by = app_user_id() AND updated_by = app_user_id());
CREATE POLICY event_calendar_blocks_update ON event_calendar_blocks FOR UPDATE
  USING (deleted_at IS NULL AND can_edit_event_items(event_id))
  WITH CHECK (can_edit_event_items(event_id) AND updated_by = app_user_id());
GRANT SELECT, INSERT, UPDATE ON event_calendar_blocks TO miceplans_app;

CREATE FUNCTION soft_delete_event_calendar_block(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event uuid;
BEGIN
  SELECT event_id INTO v_event FROM event_calendar_blocks WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND OR NOT is_internal() OR NOT can_edit_event_items(v_event) THEN RETURN false; END IF;
  UPDATE event_calendar_blocks SET deleted_at = now(), updated_by = app_user_id() WHERE id = p_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION soft_delete_event_calendar_block(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soft_delete_event_calendar_block(uuid) TO miceplans_app;
