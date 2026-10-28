-- 로그인 주체와 Client 지정을 지원한다 (명세 F-01, F-07).
-- 워크스페이스 전역 역할은 super_admin/staff/client이고, 행사 역할(pm/am/member)은 event_members에 둔다 (명세 2.1, 2.2).

ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'staff' CHECK (role IN ('super_admin', 'staff', 'client'));

-- 세션 확인은 모든 주체가 자기 사용자 행을 읽을 수 있어 권한 회수가 즉시 반영되게 한다 (명세 F-01).
DROP POLICY users_select ON users;
CREATE POLICY users_select ON users FOR SELECT USING (is_internal() OR id = app_user_id());

-- 로그인 시 이메일로 사용자를 만들거나 이름을 동기화한다. 역할 변경은 이 정책으로 하지 않는다.
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (is_internal());
CREATE POLICY users_update ON users FOR UPDATE USING (id = app_user_id()) WITH CHECK (id = app_user_id());
GRANT INSERT, UPDATE ON users TO miceplans_app;

-- Client 지정·해제는 PM·AM(과 Super Admin)이 하고 감사 로그에 남긴다 (명세 3.1).
CREATE POLICY event_clients_insert ON event_clients FOR INSERT WITH CHECK (can_manage_members(event_id));
CREATE POLICY event_clients_delete ON event_clients FOR DELETE USING (can_manage_members(event_id));
GRANT INSERT, DELETE ON event_clients TO miceplans_app;
