-- 승인된 Client 계정을 고객사에 연결한다 (명세 F-01, F-07, 2026-11-23 결정).
-- Client는 소속 고객사의 모든 행사와, 행사 단위로 따로 지정된(event_clients) 행사의 공개 Program을 본다.

ALTER TABLE users ADD COLUMN client_id uuid REFERENCES clients (id);
ALTER TABLE users ADD CONSTRAINT users_client_id_requires_client_role CHECK (client_id IS NULL OR role = 'client');
CREATE INDEX users_client_id_idx ON users (client_id) WHERE client_id IS NOT NULL;

-- 연결은 Client가 볼 수 있는 행사 범위를 바꾸는 권한 변경이므로 Super Admin만 하고 감사 로그를 남긴다.
-- users_update 정책은 본인 행만 허용하므로 검증을 담은 소유자 함수로만 바꾼다.
CREATE FUNCTION link_client_account(p_user_id uuid, p_client_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before uuid;
BEGIN
  IF app_role() <> 'super_admin' OR app_user_id() IS NULL THEN
    RAISE EXCEPTION 'Client 계정 연결은 Super Admin만 할 수 있다' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT client_id INTO v_before FROM users WHERE id = p_user_id AND role = 'client' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client 계정을 찾을 수 없다' USING ERRCODE = 'no_data_found'; END IF;
  IF p_client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clients WHERE id = p_client_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION '고객사를 찾을 수 없다' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_before IS NOT DISTINCT FROM p_client_id THEN RETURN; END IF;

  UPDATE users SET client_id = p_client_id WHERE id = p_user_id;
  INSERT INTO audit_log (actor_id, action, detail) VALUES (
    app_user_id(), 'client.account.link',
    jsonb_build_object('userId', p_user_id, 'beforeClientId', v_before, 'clientId', p_client_id)
  );
END $$;

GRANT EXECUTE ON FUNCTION link_client_account(uuid, uuid) TO miceplans_app;

-- 포털 공개 모델: 소속 고객사의 행사 또는 개별 지정 행사.
CREATE OR REPLACE FUNCTION portal_events() RETURNS TABLE (event_id uuid, name text, start_date date, end_date date, place text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.name, e.start_date, e.end_date, e.place
  FROM events e
  WHERE app_role() = 'client' AND app_user_id() IS NOT NULL AND e.deleted_at IS NULL
    AND (
      EXISTS (SELECT 1 FROM event_clients c WHERE c.event_id = e.id AND c.client_user_id = app_user_id())
      OR e.client_id = (SELECT u.client_id FROM users u WHERE u.id = app_user_id() AND u.role = 'client')
    )
  ORDER BY e.start_date, e.name
$$;

CREATE OR REPLACE FUNCTION portal_programs() RETURNS TABLE (event_id uuid, program_id uuid, title text, starts_on date, due_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.event_id, i.id, i.title, i.starts_on, i.due_on
  FROM event_items i
  JOIN events e ON e.id = i.event_id AND e.deleted_at IS NULL
  WHERE app_role() = 'client' AND app_user_id() IS NOT NULL
    AND i.kind = 'program' AND i.client_visible AND i.deleted_at IS NULL
    AND (
      EXISTS (SELECT 1 FROM event_clients c WHERE c.event_id = i.event_id AND c.client_user_id = app_user_id())
      OR e.client_id = (SELECT u.client_id FROM users u WHERE u.id = app_user_id() AND u.role = 'client')
    )
  ORDER BY i.starts_on NULLS LAST, i.title
$$;

-- 이미 승인된 Client는 신청 회사명과 이름이 정확히 하나만 일치하는 고객사에 연결한다 (공백·대소문자 무시).
-- 일치하는 고객사가 없거나 여러 개면 연결하지 않고 Super Admin이 고객사 화면에서 직접 연결한다.
WITH matches AS (
  SELECT u.id AS user_id, min(c.id::text)::uuid AS client_id
  FROM users u
  JOIN client_applications a ON a.email = u.email AND a.status = 'approved'
  JOIN clients c ON c.deleted_at IS NULL AND lower(btrim(c.name)) = lower(btrim(a.company_name))
  WHERE u.role = 'client' AND u.client_id IS NULL
  GROUP BY u.id
  HAVING count(*) = 1
)
UPDATE users u SET client_id = m.client_id FROM matches m WHERE u.id = m.user_id;
