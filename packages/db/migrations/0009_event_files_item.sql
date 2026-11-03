-- 행사 첨부 파일을 Program·Task·Subtask에 연결하고 삭제를 함께 적용한다 (명세 F-04 첨부 구성요소, 3.1).
-- 원본 객체와 변환 문서의 보존 정책은 0008과 같다. 여기서는 메타데이터 연결과 연쇄 삭제만 다룬다.

ALTER TABLE event_files ADD COLUMN item_id uuid REFERENCES event_items (id);
CREATE INDEX event_files_item_idx ON event_files (item_id) WHERE deleted_at IS NULL;

-- 첨부 대상 항목은 같은 행사의 것이어야 한다.
CREATE FUNCTION event_files_item_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_event uuid;
BEGIN
  IF NEW.item_id IS NOT NULL THEN
    SELECT event_id INTO v_event FROM event_items WHERE id = NEW.item_id;
    IF NOT FOUND OR v_event <> NEW.event_id THEN
      RAISE EXCEPTION '첨부 대상 항목과 행사가 다르다' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER event_files_item_integrity BEFORE INSERT OR UPDATE OF item_id, event_id ON event_files FOR EACH ROW EXECUTE FUNCTION event_files_item_integrity();

-- 삭제는 하위 항목까지 함께 적용된다 (명세 3.1). 항목·행사 삭제 때 그 첨부 파일도 함께 삭제한다.
CREATE OR REPLACE FUNCTION event_items_cascade_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE event_items SET deleted_at = NEW.deleted_at WHERE parent_id = NEW.id AND deleted_at IS NULL;
    UPDATE event_files SET deleted_at = NEW.deleted_at WHERE item_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION events_guard_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    IF current_event_role(NEW.id) NOT IN ('super_admin', 'pm') THEN
      RAISE EXCEPTION '행사 삭제는 PM만 할 수 있다' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.deleted_at IS NOT NULL THEN
      UPDATE event_items SET deleted_at = NEW.deleted_at WHERE event_id = NEW.id AND kind = 'program' AND deleted_at IS NULL;
      UPDATE event_files SET deleted_at = NEW.deleted_at WHERE event_id = NEW.id AND deleted_at IS NULL;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
