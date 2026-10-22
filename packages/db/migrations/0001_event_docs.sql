-- 행사 문서의 열람 범위를 PostgreSQL RLS로 강제한다.
-- 앱 역할은 BYPASSRLS가 없고 테이블 소유자도 아니다 (AGENTS.md 권한과 데이터 보호).

CREATE TABLE event_members (
  event_id uuid NOT NULL,
  user_id  uuid NOT NULL,
  role     text NOT NULL CHECK (role IN ('pm', 'am', 'member')),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE event_docs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL,
  title      text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'members' CHECK (visibility IN ('all', 'members', 'managers')),
  version    integer NOT NULL DEFAULT 1,
  deleted_at timestamptz
);
CREATE INDEX event_docs_event_id_idx ON event_docs (event_id);

CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  event_id   uuid,
  actor_id   uuid NOT NULL,
  action     text NOT NULL,
  detail     jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- withContext가 트랜잭션 로컬로 설정하는 값을 읽는다.
CREATE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
CREATE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT coalesce(nullif(current_setting('app.role', true), ''), 'client') $$;

-- 행사 안에서의 실제 역할. 비멤버 내부 직원은 staff로 본다 (명세 2.2).
CREATE FUNCTION current_event_role(p_event_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN app_role() IN ('super_admin', 'client') THEN app_role()
    ELSE coalesce((SELECT m.role FROM event_members m WHERE m.event_id = p_event_id AND m.user_id = app_user_id()), 'staff')
  END
$$;

CREATE FUNCTION can_edit_event(p_event_id uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT current_event_role(p_event_id) IN ('super_admin', 'pm', 'am') $$;

CREATE FUNCTION can_view_doc(p_event_id uuid, p_visibility text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT CASE p_visibility
    WHEN 'all'      THEN current_event_role(p_event_id) IN ('super_admin', 'pm', 'am', 'member', 'staff')
    WHEN 'members'  THEN current_event_role(p_event_id) IN ('super_admin', 'pm', 'am', 'member')
    WHEN 'managers' THEN current_event_role(p_event_id) IN ('super_admin', 'pm', 'am')
    ELSE false
  END
$$;

ALTER TABLE event_docs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_docs    FORCE ROW LEVEL SECURITY;
ALTER TABLE event_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_members FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log     FORCE ROW LEVEL SECURITY;

CREATE POLICY event_docs_select ON event_docs FOR SELECT USING (deleted_at IS NULL AND can_view_doc(event_id, visibility));
CREATE POLICY event_docs_insert ON event_docs FOR INSERT WITH CHECK (can_edit_event(event_id));
CREATE POLICY event_docs_update ON event_docs FOR UPDATE USING (can_edit_event(event_id)) WITH CHECK (can_edit_event(event_id));

CREATE POLICY event_members_select ON event_members FOR SELECT USING (app_role() <> 'client');

CREATE POLICY audit_log_insert ON audit_log FOR INSERT WITH CHECK (actor_id = app_user_id());
CREATE POLICY audit_log_select ON audit_log FOR SELECT USING (event_id IS NOT NULL AND can_edit_event(event_id));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'miceplans_app') THEN
    CREATE ROLE miceplans_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE ON event_docs TO miceplans_app;
GRANT SELECT ON event_members TO miceplans_app;
GRANT SELECT, INSERT ON audit_log TO miceplans_app;
GRANT USAGE ON SEQUENCE audit_log_id_seq TO miceplans_app;
