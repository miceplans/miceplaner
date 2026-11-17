-- 낮은 직원은 행사를 만들고, 생성자는 그 행사의 최초 PM이 된다 (기능 명세 F-02, 2026-11-17 결정).
-- 생성은 create_event_with_pm 함수 하나로 묶는다: 행사 INSERT, 생성자 PM 등록, 감사 로그를
-- 한 트랜잭션으로 처리한다. 생성자가 PM을 넘긴 뒤 스스로 다시 PM으로 들어오는 예외 조건이
-- 필요 없고, 앱 역할의 events 직접 INSERT 권한도 필요 없다 (AGENTS.md: 앱 코드와 RLS 양쪽 권한 강제).
-- created_by는 생성 시에만 정해지고 이후 누구도 바꿀 수 없다.

REVOKE INSERT ON events FROM miceplans_app;
-- 0002부터 앱 역할에 INSERT를 부여한 적 없으므로 이 REVOKE는 실질적 차단이라기보다
-- 향후 INSERT 정책·권한이 실수로 추가되더라도 막는 보험이다. 실제 차단은 이 파일에
-- events_insert 정책을 두지 않고 생성을 아래 함수 경로로만 허용하는 것이다.

CREATE FUNCTION create_event_with_pm(
  p_client_id uuid, p_name text, p_start_date date, p_end_date date,
  p_place text, p_status text, p_priority boolean, p_color text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event uuid;
BEGIN
  IF NOT is_internal() OR app_user_id() IS NULL THEN
    RAISE EXCEPTION '행사 생성은 낮은 직원만 할 수 있다' USING ERRCODE = 'insufficient_privilege';
  END IF;
  INSERT INTO events (client_id, name, start_date, end_date, place, status, priority, color, created_by)
    VALUES (p_client_id, p_name, p_start_date, p_end_date, p_place, p_status, p_priority, p_color, app_user_id())
    RETURNING id INTO v_event;
  INSERT INTO event_members (event_id, user_id, role) VALUES (v_event, app_user_id(), 'pm');
  INSERT INTO audit_log (event_id, actor_id, action, detail)
    VALUES (v_event, app_user_id(), 'event.create', jsonb_build_object('clientId', p_client_id));
  RETURN v_event;
END $$;
GRANT EXECUTE ON FUNCTION create_event_with_pm(uuid, text, date, date, text, text, boolean, text) TO miceplans_app;

CREATE FUNCTION events_immutable_created_by() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by는 변경할 수 없다' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER events_immutable_created_by BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION events_immutable_created_by();
