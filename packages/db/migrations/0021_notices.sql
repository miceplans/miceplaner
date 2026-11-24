-- 공지 (명세 F-13, 2026-11-23 결정). 관리자가 전체 또는 행사 단위로 올리고, 받은 사람이 닫기 전까지 목록 최상단에 고정된다.
-- 공지 범위: event_id가 없으면 전체 공지(내부 직원 전원), 있으면 그 행사 멤버에게만 보인다.
-- 작성: 전체 공지는 Super Admin만, 행사 공지는 그 행사의 PM·AM(과 Super Admin)이 한다.

CREATE TABLE notices (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid REFERENCES events (id),
  title      text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_by uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX notices_event_idx ON notices (event_id) WHERE event_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX notices_created_idx ON notices (created_at DESC) WHERE deleted_at IS NULL;

-- 받은 사람별 닫기 상태. 닫기 전까지 공지가 목록 최상단에 고정된다.
CREATE TABLE notice_dismissals (
  notice_id    uuid NOT NULL REFERENCES notices (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users (id),
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, user_id)
);
CREATE INDEX notice_dismissals_user_idx ON notice_dismissals (user_id);

-- 공지 내용과 범위는 올린 뒤 바꿀 수 없다. 삭제(soft delete)만 허용한다.
CREATE FUNCTION notices_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.title <> OLD.title OR NEW.body <> OLD.body OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION '공지 내용과 대상은 바꿀 수 없다' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER notices_guard BEFORE UPDATE ON notices FOR EACH ROW EXECUTE FUNCTION notices_guard();

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices FORCE ROW LEVEL SECURITY;

-- 수신 범위: 전체 공지는 내부 직원 전원, 행사 공지는 그 행사 멤버(PM·AM·member)와 Super Admin.
CREATE POLICY notices_select ON notices FOR SELECT
  USING (is_internal() AND deleted_at IS NULL
         AND (event_id IS NULL OR current_event_role(event_id) IN ('super_admin', 'pm', 'am', 'member')));

-- 작성: 전체 공지는 Super Admin만, 행사 공지는 그 행사의 PM·AM(과 Super Admin).
CREATE POLICY notices_insert ON notices FOR INSERT
  WITH CHECK (is_internal() AND created_by = app_user_id() AND (
    (event_id IS NULL AND app_role() = 'super_admin')
    OR (event_id IS NOT NULL AND can_edit_event(event_id))
  ));

-- 삭제(soft delete)는 작성자와 Super Admin만 한다. 내용·범위 변경은 notices_guard가 막는다.
-- 실제 삭제는 아래 soft_delete_notice(SECURITY DEFINER)가 수행한다. 자식 테이블 FK와 함께
-- 직접 UPDATE할 때 RLS WITH CHECK가 잘못 거부하는 PostgreSQL 동작을 피하기 위한 기존 패턴(soft_delete_event 등)과 같다.
CREATE POLICY notices_update ON notices FOR UPDATE
  USING (deleted_at IS NULL AND (created_by = app_user_id() OR app_role() = 'super_admin'))
  WITH CHECK (created_by = app_user_id() OR app_role() = 'super_admin');

GRANT SELECT, INSERT, UPDATE ON notices TO miceplans_app;

ALTER TABLE notice_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_dismissals FORCE ROW LEVEL SECURITY;
-- 닫기 상태는 본인 것만 본다·만든다.
CREATE POLICY notice_dismissals_select ON notice_dismissals FOR SELECT USING (user_id = app_user_id());
CREATE POLICY notice_dismissals_insert ON notice_dismissals FOR INSERT WITH CHECK (user_id = app_user_id());

GRANT SELECT, INSERT ON notice_dismissals TO miceplans_app;

-- 공지 삭제는 soft delete다. 작성자와 Super Admin만 하고 감사 로그를 남긴다 (soft_delete_event와 같은 패턴).
CREATE FUNCTION soft_delete_notice(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event uuid;
  v_created_by uuid;
  v_title text;
BEGIN
  SELECT event_id, created_by, title INTO v_event, v_created_by, v_title FROM notices WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT (v_created_by = app_user_id() OR app_role() = 'super_admin') THEN
    RAISE EXCEPTION '공지 삭제는 작성자와 Super Admin만 할 수 있다' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE notices SET deleted_at = now() WHERE id = p_id;
  INSERT INTO audit_log (event_id, actor_id, action, detail)
    VALUES (v_event, app_user_id(), 'notice.delete', jsonb_build_object('noticeId', p_id, 'title', v_title));
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION soft_delete_notice(uuid) TO miceplans_app;
