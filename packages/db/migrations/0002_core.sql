-- 행사·Program/Task/Subtask·알림·휴가 스키마와 RLS (명세 F-02, F-03, F-06, F-07, F-12).
-- 상태값·필수 필드는 현재 웹 목업에서 가져온 초안이다 (명세 7절 보완 계약 확정 전).
-- 예산·견적, 제작물·디자인 요청, 표 속성은 데이터 모델이 미확정이라 이 마이그레이션에 넣지 않는다 (명세 6절).

CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  email              text NOT NULL UNIQUE,
  job_title          text NOT NULL DEFAULT '',
  annual_leave_days  numeric(4, 2) NOT NULL DEFAULT 15 CHECK (annual_leave_days >= 0)
);

CREATE TABLE clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  deleted_at timestamptz
);

CREATE TABLE events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL REFERENCES clients (id),
  name       text NOT NULL,
  start_date date NOT NULL,
  end_date   date NOT NULL,
  place      text NOT NULL DEFAULT '',
  status     text NOT NULL DEFAULT '진행중' CHECK (status IN ('진행중', '성공', '확인중', '만료', '제출', '보류중')),
  priority   boolean NOT NULL DEFAULT false,
  color      text,
  version    integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (end_date >= start_date)
);
CREATE INDEX events_client_id_idx ON events (client_id);
CREATE INDEX events_start_date_idx ON events (start_date);

-- Client 주체에게 행사를 지정한다. Client는 이 표에 있는 행사의 공개 Program만 본다.
CREATE TABLE event_clients (
  event_id       uuid NOT NULL REFERENCES events (id),
  client_user_id uuid NOT NULL,
  PRIMARY KEY (event_id, client_user_id)
);

-- Program·Task·Subtask를 한 표에 둔다. kind와 parent_id로 계층을 만들고 event_id를 모든 행에 유지한다.
CREATE TABLE event_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES events (id),
  kind           text NOT NULL CHECK (kind IN ('program', 'task', 'subtask')),
  parent_id      uuid REFERENCES event_items (id),
  title          text NOT NULL,
  description    text NOT NULL DEFAULT '',
  part           text CHECK (part IN ('디자인', '영상', '3D')),
  status         text NOT NULL DEFAULT '할 일' CHECK (status IN ('할 일', '진행 중', '검토 대기', '보류', '취소', '완료')),
  starts_on      date,
  due_on         date,
  assignee_id    uuid REFERENCES users (id),
  client_visible boolean NOT NULL DEFAULT false,
  version        integer NOT NULL DEFAULT 1,
  created_by     uuid NOT NULL REFERENCES users (id),
  completed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  CHECK ((kind = 'program') = (parent_id IS NULL)),
  CHECK (kind = 'program' OR NOT client_visible),
  CHECK (starts_on IS NULL OR due_on IS NULL OR due_on >= starts_on)
);
CREATE INDEX event_items_event_id_idx ON event_items (event_id, kind);
CREATE INDEX event_items_parent_id_idx ON event_items (parent_id);
CREATE INDEX event_items_assignee_id_idx ON event_items (assignee_id) WHERE deleted_at IS NULL;

CREATE TABLE notifications (
  id           bigserial PRIMARY KEY,
  recipient_id uuid NOT NULL REFERENCES users (id),
  event_id     uuid NOT NULL REFERENCES events (id),
  item_id      uuid REFERENCES event_items (id),
  kind         text NOT NULL CHECK (kind IN ('assigned', 'schedule_changed', 'due_soon', 'member_changed')),
  title        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
);
CREATE INDEX notifications_recipient_idx ON notifications (recipient_id, created_at DESC);

-- 휴가 형태별 일수. 화면의 LEAVE_KINDS와 같다.
CREATE TABLE leave_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id),
  leave_date date NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('full', 'comp', 'am-half', 'pm-half', 'am-quarter', 'pm-quarter')),
  days       numeric(3, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (days = CASE kind WHEN 'full' THEN 1 WHEN 'comp' THEN 1 WHEN 'am-half' THEN 0.5 WHEN 'pm-half' THEN 0.5 ELSE 0.25 END),
  CHECK (extract(isodow FROM leave_date) < 6)
);
CREATE UNIQUE INDEX leave_requests_active_uniq ON leave_requests (user_id, leave_date, kind) WHERE deleted_at IS NULL;
CREATE INDEX leave_requests_date_idx ON leave_requests (leave_date);

-- 주말 근무 1일당 대휴 1일이 생긴다.
CREATE TABLE weekend_work (
  user_id   uuid NOT NULL REFERENCES users (id),
  work_date date NOT NULL CHECK (extract(isodow FROM work_date) >= 6),
  PRIMARY KEY (user_id, work_date)
);

-- ── 권한 함수 ──────────────────────────────────────────────────────────────

CREATE FUNCTION is_internal() RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT app_role() IN ('super_admin', 'pm', 'am', 'member', 'staff') $$;

-- Program 이하 항목과 행사 기본 정보는 행사 멤버까지 편집한다 (명세 2.2). 문서(can_edit_event)와 다르다.
CREATE FUNCTION can_edit_event_items(p_event_id uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT current_event_role(p_event_id) IN ('super_admin', 'pm', 'am', 'member') $$;

CREATE FUNCTION can_manage_members(p_event_id uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT current_event_role(p_event_id) IN ('super_admin', 'pm', 'am') $$;

-- ── 무결성 트리거 ──────────────────────────────────────────────────────────

CREATE FUNCTION event_items_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent event_items;
  expected text;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT * INTO parent FROM event_items WHERE id = NEW.parent_id;
    IF NOT FOUND THEN RAISE EXCEPTION '상위 항목을 찾을 수 없다' USING ERRCODE = 'foreign_key_violation'; END IF;
    IF parent.event_id <> NEW.event_id THEN RAISE EXCEPTION '상위 항목과 행사가 다르다' USING ERRCODE = 'check_violation'; END IF;
    expected := CASE NEW.kind WHEN 'task' THEN 'program' ELSE 'task' END;
    IF parent.kind <> expected THEN
      RAISE EXCEPTION '% 의 상위 항목 종류가 맞지 않는다', NEW.kind USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  -- 담당자는 행사 인력 중에서만 지정한다 (명세 3.1).
  IF NEW.assignee_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) THEN
    IF NOT EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = NEW.event_id AND m.user_id = NEW.assignee_id) THEN
      RAISE EXCEPTION '담당자는 행사 멤버여야 한다' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  NEW.updated_at := now();
  IF NEW.status = '완료' AND NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
  IF NEW.status <> '완료' THEN NEW.completed_at := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER event_items_integrity BEFORE INSERT OR UPDATE ON event_items FOR EACH ROW EXECUTE FUNCTION event_items_integrity();

-- 삭제는 하위 항목까지 함께 적용된다 (명세 3.1). Program → Task → Subtask 순으로 연쇄된다.
CREATE FUNCTION event_items_cascade_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE event_items SET deleted_at = NEW.deleted_at WHERE parent_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER event_items_cascade_delete AFTER UPDATE OF deleted_at ON event_items FOR EACH ROW EXECUTE FUNCTION event_items_cascade_delete();

-- 행사 삭제는 PM(과 Super Admin)만 한다. 삭제하면 Program 이하 항목도 함께 삭제된다.
CREATE FUNCTION events_guard_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    IF current_event_role(NEW.id) NOT IN ('super_admin', 'pm') THEN
      RAISE EXCEPTION '행사 삭제는 PM만 할 수 있다' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.deleted_at IS NOT NULL THEN
      UPDATE event_items SET deleted_at = NEW.deleted_at WHERE event_id = NEW.id AND kind = 'program' AND deleted_at IS NULL;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER events_guard_delete BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION events_guard_delete();

-- 행사에는 항상 최소 한 명의 PM이 있어야 한다 (명세 2.1).
CREATE FUNCTION event_members_keep_pm() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role = 'pm' AND (TG_OP = 'DELETE' OR NEW.role <> 'pm') THEN
    IF NOT EXISTS (SELECT 1 FROM event_members WHERE event_id = OLD.event_id AND role = 'pm' AND user_id <> OLD.user_id) THEN
      RAISE EXCEPTION '행사에는 최소 한 명의 PM이 필요하다' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER event_members_keep_pm BEFORE UPDATE OR DELETE ON event_members FOR EACH ROW EXECUTE FUNCTION event_members_keep_pm();

-- 대휴는 주말 근무 일수까지, 그 외 휴가는 연간 연차 일수까지만 신청할 수 있다.
CREATE FUNCTION leave_requests_check_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  used   numeric;
  limit_ numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.kind = 'comp' THEN
    SELECT coalesce(sum(days), 0) INTO used FROM leave_requests
      WHERE user_id = NEW.user_id AND kind = 'comp' AND deleted_at IS NULL AND id IS DISTINCT FROM NEW.id;
    SELECT count(*) INTO limit_ FROM weekend_work WHERE user_id = NEW.user_id;
  ELSE
    SELECT coalesce(sum(days), 0) INTO used FROM leave_requests
      WHERE user_id = NEW.user_id AND kind <> 'comp' AND deleted_at IS NULL AND id IS DISTINCT FROM NEW.id
        AND extract(year FROM leave_date) = extract(year FROM NEW.leave_date);
    SELECT annual_leave_days INTO limit_ FROM users WHERE id = NEW.user_id;
  END IF;
  IF used + NEW.days > limit_ THEN
    RAISE EXCEPTION '잔여 일수가 부족하다 (사용 %, 신청 %, 한도 %)', used, NEW.days, limit_ USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER leave_requests_check_balance BEFORE INSERT OR UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION leave_requests_check_balance();

-- ── soft delete 함수 ──────────────────────────────────────────────────────
-- SELECT 정책이 deleted_at IS NULL 행만 허용하므로 UPDATE 후의 새 행이 정책을 통과하지 못한다.
-- 그래서 삭제는 권한을 함수 안에서 검사하는 소유자 권한 함수로 처리한다. 소유자는 마이그레이션 역할이며 앱 역할이 아니다.

CREATE FUNCTION soft_delete_event_item(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event uuid;
BEGIN
  SELECT event_id INTO v_event FROM event_items WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND OR NOT is_internal() OR NOT can_edit_event_items(v_event) THEN RETURN false; END IF;
  UPDATE event_items SET deleted_at = now() WHERE id = p_id;
  RETURN true;
END $$;

CREATE FUNCTION soft_delete_event(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_internal() OR NOT EXISTS (SELECT 1 FROM events WHERE id = p_id AND deleted_at IS NULL) THEN RETURN false; END IF;
  IF current_event_role(p_id) NOT IN ('super_admin', 'pm') THEN
    RAISE EXCEPTION '행사 삭제는 PM만 할 수 있다' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE events SET deleted_at = now() WHERE id = p_id;
  RETURN true;
END $$;

CREATE FUNCTION cancel_leave_request(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_internal() OR app_user_id() IS NULL THEN RETURN false; END IF;
  UPDATE leave_requests SET deleted_at = now() WHERE id = p_id AND user_id = app_user_id() AND deleted_at IS NULL;
  RETURN FOUND;
END $$;

-- ── Client 포털 공개 모델 ─────────────────────────────────────────────────
-- 내부 표에는 Client 정책을 두지 않는다. 소유자 권한 함수가 RLS를 거치지 않으므로 필터를 함수 안에 직접 둔다 (ADR 0001).

CREATE FUNCTION portal_events() RETURNS TABLE (event_id uuid, name text, start_date date, end_date date, place text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.name, e.start_date, e.end_date, e.place
  FROM events e
  JOIN event_clients c ON c.event_id = e.id AND c.client_user_id = app_user_id()
  WHERE app_role() = 'client' AND app_user_id() IS NOT NULL AND e.deleted_at IS NULL
  ORDER BY e.start_date, e.name
$$;

CREATE FUNCTION portal_programs() RETURNS TABLE (event_id uuid, program_id uuid, title text, starts_on date, due_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.event_id, i.id, i.title, i.starts_on, i.due_on
  FROM event_items i
  JOIN events e ON e.id = i.event_id AND e.deleted_at IS NULL
  JOIN event_clients c ON c.event_id = i.event_id AND c.client_user_id = app_user_id()
  WHERE app_role() = 'client' AND app_user_id() IS NOT NULL
    AND i.kind = 'program' AND i.client_visible AND i.deleted_at IS NULL
  ORDER BY i.starts_on NULLS LAST, i.title
$$;

-- ── RLS ────────────────────────────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'clients', 'events', 'event_clients', 'event_items', 'notifications', 'leave_requests', 'weekend_work'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE POLICY users_select   ON users   FOR SELECT USING (is_internal());
CREATE POLICY clients_select ON clients FOR SELECT USING (is_internal() AND deleted_at IS NULL);

CREATE POLICY events_select ON events FOR SELECT USING (is_internal() AND deleted_at IS NULL);
-- 행사 생성 권한은 미확정(명세 6절)이라 INSERT 정책을 두지 않는다.
-- deleted_at 변경은 soft_delete_event 함수로만 한다 (UPDATE 새 행이 events_select를 통과해야 하므로 직접 삭제는 거부된다).
CREATE POLICY events_update ON events FOR UPDATE USING (can_edit_event_items(id)) WITH CHECK (can_edit_event_items(id));

CREATE POLICY event_clients_select ON event_clients FOR SELECT USING (can_manage_members(event_id));

CREATE POLICY event_items_select ON event_items FOR SELECT USING (is_internal() AND deleted_at IS NULL);
CREATE POLICY event_items_insert ON event_items FOR INSERT WITH CHECK (can_edit_event_items(event_id) AND created_by = app_user_id());
CREATE POLICY event_items_update ON event_items FOR UPDATE USING (can_edit_event_items(event_id)) WITH CHECK (can_edit_event_items(event_id));

CREATE POLICY event_members_insert ON event_members FOR INSERT WITH CHECK (can_manage_members(event_id));
CREATE POLICY event_members_update ON event_members FOR UPDATE USING (can_manage_members(event_id)) WITH CHECK (can_manage_members(event_id));
CREATE POLICY event_members_delete ON event_members FOR DELETE USING (can_manage_members(event_id));

CREATE POLICY notifications_select ON notifications FOR SELECT USING (is_internal() AND recipient_id = app_user_id());
CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (can_edit_event_items(event_id) OR can_manage_members(event_id));
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (is_internal() AND recipient_id = app_user_id()) WITH CHECK (recipient_id = app_user_id());

-- 연차 현황 화면은 전 직원의 사용 내역을 보여 주므로 내부 직원은 모두 조회하고, 신청과 취소는 본인 것만 한다.
CREATE POLICY leave_requests_select ON leave_requests FOR SELECT USING (is_internal() AND deleted_at IS NULL);
CREATE POLICY leave_requests_insert ON leave_requests FOR INSERT WITH CHECK (is_internal() AND user_id = app_user_id());
CREATE POLICY leave_requests_update ON leave_requests FOR UPDATE USING (is_internal() AND user_id = app_user_id()) WITH CHECK (user_id = app_user_id());

CREATE POLICY weekend_work_select ON weekend_work FOR SELECT USING (is_internal() AND user_id = app_user_id());
CREATE POLICY weekend_work_insert ON weekend_work FOR INSERT WITH CHECK (is_internal() AND user_id = app_user_id());
CREATE POLICY weekend_work_delete ON weekend_work FOR DELETE USING (is_internal() AND user_id = app_user_id());

-- ── 권한 부여 ──────────────────────────────────────────────────────────────

GRANT SELECT ON users, clients, event_clients TO miceplans_app;
GRANT SELECT, UPDATE ON events TO miceplans_app;
GRANT SELECT, INSERT, UPDATE ON event_items TO miceplans_app;
GRANT INSERT, UPDATE, DELETE ON event_members TO miceplans_app;
GRANT SELECT, INSERT, UPDATE ON notifications TO miceplans_app;
GRANT SELECT, INSERT, UPDATE ON leave_requests TO miceplans_app;
GRANT SELECT, INSERT, DELETE ON weekend_work TO miceplans_app;
GRANT USAGE ON SEQUENCE notifications_id_seq TO miceplans_app;
