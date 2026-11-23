-- 캘린더 일정 상세 패널의 내용(담당자·설명·클라이언트 메모·할 일·링크)을 서버에 저장한다 (명세 F-04, 2026-11-23 결정).
-- 패널 하나는 note_key 하나다. 메인 캘린더의 날짜 패널은 event_id가 없고, 행사 상세 캘린더 일정은 event_id를 가진다.
-- 내용은 jsonb 한 덩어리이며 형태 검증은 API의 Zod 계약이 맡는다.

CREATE TABLE schedule_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_key   text NOT NULL CHECK (char_length(note_key) BETWEEN 1 AND 200),
  event_id   uuid REFERENCES events (id),
  content    jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(content) = 'object'),
  version    integer NOT NULL DEFAULT 0 CHECK (version >= 0),  -- 0은 키만 잡히고 아직 저장되지 않은 상태
  created_by uuid NOT NULL REFERENCES users (id),
  updated_by uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX schedule_notes_key_idx ON schedule_notes (note_key) WHERE deleted_at IS NULL;
CREATE INDEX schedule_notes_event_idx ON schedule_notes (event_id) WHERE event_id IS NOT NULL AND deleted_at IS NULL;

-- 같은 키는 항상 같은 행사(또는 행사 없음)에 묶인다. 키를 다른 행사로 옮겨 권한을 바꾸지 못하게 한다.
CREATE FUNCTION schedule_notes_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.note_key <> OLD.note_key THEN
    RAISE EXCEPTION '일정 메모의 키와 행사는 바꿀 수 없다' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER schedule_notes_guard BEFORE UPDATE ON schedule_notes FOR EACH ROW EXECUTE FUNCTION schedule_notes_guard();

ALTER TABLE schedule_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_notes FORCE ROW LEVEL SECURITY;
-- 내부 직원은 모두 본다. Client는 is_internal()에서 막힌다.
-- 행사에 묶인 메모는 행사 멤버만, 행사가 없는 날짜 메모는 내부 직원 누구나 쓴다.
CREATE POLICY schedule_notes_select ON schedule_notes FOR SELECT USING (is_internal() AND deleted_at IS NULL);
CREATE POLICY schedule_notes_insert ON schedule_notes FOR INSERT
  WITH CHECK (is_internal() AND created_by = app_user_id() AND updated_by = app_user_id() AND (event_id IS NULL OR can_edit_event_items(event_id)));
CREATE POLICY schedule_notes_update ON schedule_notes FOR UPDATE
  USING (is_internal() AND deleted_at IS NULL AND (event_id IS NULL OR can_edit_event_items(event_id)))
  WITH CHECK (is_internal() AND updated_by = app_user_id() AND (event_id IS NULL OR can_edit_event_items(event_id)));
GRANT SELECT, INSERT, UPDATE ON schedule_notes TO miceplans_app;

-- 담당자 변경은 audit_log(schedule_note.assignees)에 남긴다. 날짜 메모는 event_id가 없어 기존 audit_log_select 정책상 앱 역할로는 조회되지 않는다.
