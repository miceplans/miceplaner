-- Client 포털 알림함 (명세 F-06·F-07, 2026-11-25 결정).
-- 내부 알림(notifications)과 분리한 공개 전용 모델이다. 공개 Program의 공개와 일정 변경만 남기고
-- 변경한 사람·담당자·Task·Subtask 정보는 저장하지 않는다.

CREATE TABLE client_notifications (
  id               bigserial PRIMARY KEY,
  event_id         uuid NOT NULL REFERENCES events (id),
  program_id       uuid NOT NULL REFERENCES event_items (id),
  kind             text NOT NULL CHECK (kind IN ('program_published', 'schedule_changed')),
  before_starts_on date,
  before_due_on    date,
  after_starts_on  date,
  after_due_on     date,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_notifications_program_idx ON client_notifications (program_id, created_at DESC);

-- 알림은 행사 단위로 한 번만 쓰고 읽음은 Client별로 남긴다. 받는 사람은 조회할 때 포털 공개 범위로 정한다.
CREATE TABLE client_notification_reads (
  notification_id bigint NOT NULL REFERENCES client_notifications (id),
  user_id         uuid NOT NULL REFERENCES users (id),
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

-- 정책과 GRANT를 두지 않는다. 애플리케이션 역할은 아래 함수로만 읽고 쓴다.
ALTER TABLE client_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE client_notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notification_reads FORCE ROW LEVEL SECURITY;

CREATE FUNCTION event_items_client_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind <> 'program' OR NOT NEW.client_visible OR NEW.deleted_at IS NOT NULL THEN RETURN NULL; END IF;
  IF NOT OLD.client_visible THEN
    INSERT INTO client_notifications (event_id, program_id, kind, after_starts_on, after_due_on)
    VALUES (NEW.event_id, NEW.id, 'program_published', NEW.starts_on, NEW.due_on);
  ELSIF (NEW.starts_on, NEW.due_on) IS DISTINCT FROM (OLD.starts_on, OLD.due_on) THEN
    INSERT INTO client_notifications (event_id, program_id, kind, before_starts_on, before_due_on, after_starts_on, after_due_on)
    VALUES (NEW.event_id, NEW.id, 'schedule_changed', OLD.starts_on, OLD.due_on, NEW.starts_on, NEW.due_on);
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION event_items_client_notify() FROM PUBLIC;
CREATE TRIGGER event_items_client_notify AFTER UPDATE OF client_visible, starts_on, due_on ON event_items
  FOR EACH ROW EXECUTE FUNCTION event_items_client_notify();

-- portal_programs()·portal_events()와 조인해 지금 볼 수 있는 행사·공개 Program의 알림만 돌려준다.
-- 비공개로 바뀌거나 지정이 풀리면 지난 알림도 함께 사라진다. 30일이 지난 알림은 보여 주지 않는다.
CREATE FUNCTION portal_notifications() RETURNS TABLE (
  id bigint, kind text, event_id uuid, event_name text, program_id uuid, program_title text,
  before_starts_on date, before_due_on date, after_starts_on date, after_due_on date, created_at timestamptz, read_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT n.id, n.kind, n.event_id, e.name, n.program_id, p.title,
    n.before_starts_on, n.before_due_on, n.after_starts_on, n.after_due_on, n.created_at, r.read_at
  FROM client_notifications n
  JOIN portal_programs() p ON p.program_id = n.program_id
  JOIN portal_events() e ON e.event_id = n.event_id
  LEFT JOIN client_notification_reads r ON r.notification_id = n.id AND r.user_id = app_user_id()
  WHERE n.created_at > now() - interval '30 days'
  ORDER BY n.created_at DESC, n.id DESC
  LIMIT 200
$$;
REVOKE ALL ON FUNCTION portal_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portal_notifications() TO miceplans_app;

-- 볼 수 있는 알림만 읽음으로 표시한다. 이미 읽은 알림과 남의 알림은 무시하고 새로 표시한 수를 돌려준다.
CREATE FUNCTION portal_mark_notifications_read(p_ids bigint[]) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO client_notification_reads (notification_id, user_id)
  SELECT n.id, app_user_id() FROM portal_notifications() n WHERE n.id = ANY (p_ids) AND n.read_at IS NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION portal_mark_notifications_read(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portal_mark_notifications_read(bigint[]) TO miceplans_app;
