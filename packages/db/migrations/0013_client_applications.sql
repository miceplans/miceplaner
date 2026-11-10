-- Client 포털은 client. 서브도메인에서 회사명·이름·이메일·비밀번호로 신청한다.
-- 계정 생성은 Super Admin 승인 뒤에만 이뤄진다 (명세 F-01, F-06, F-07).

CREATE TABLE client_applications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name   text NOT NULL,
  applicant_name text NOT NULL,
  email          text NOT NULL,
  password_hash  text NOT NULL,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by     uuid REFERENCES users (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  decided_at     timestamptz,
  UNIQUE (email)
);

ALTER TABLE notifications ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('assigned', 'schedule_changed', 'due_soon', 'member_changed', 'client_application'));

ALTER TABLE client_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_applications FORCE ROW LEVEL SECURITY;

-- 공개 신청은 API가 검증한 입력만 넣으며, 조회·결정은 Super Admin으로 제한한다.
CREATE POLICY client_applications_insert ON client_applications FOR INSERT WITH CHECK (is_internal());
CREATE POLICY client_applications_select ON client_applications FOR SELECT USING (app_role() = 'super_admin');
CREATE POLICY client_applications_update ON client_applications FOR UPDATE USING (app_role() = 'super_admin') WITH CHECK (app_role() = 'super_admin');
GRANT INSERT, SELECT, UPDATE ON client_applications TO miceplans_app;

DROP POLICY notifications_insert ON notifications;
CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (
  (kind = 'client_application' AND is_internal())
  OR (kind <> 'client_application' AND (can_edit_event_items(event_id) OR can_manage_members(event_id)))
);

-- event_clients는 Client 역할의 사용자만 가질 수 있다. FK와 트리거를 함께 둬 내부 직원 오지정을 막는다.
-- 과거의 잘못된 배정은 조용히 지우지 않는다. 운영자가 감사한 뒤 정정해야 마이그레이션이 진행된다.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM event_clients ec
    LEFT JOIN users u ON u.id = ec.client_user_id
    WHERE u.id IS NULL OR u.role <> 'client'
  ) THEN
    RAISE EXCEPTION 'event_clients에 Client 역할이 아닌 기존 배정이 있습니다. 정정 후 0013 마이그레이션을 다시 실행하세요.';
  END IF;
END $$;
ALTER TABLE event_clients ADD CONSTRAINT event_clients_client_user_fk FOREIGN KEY (client_user_id) REFERENCES users (id);
CREATE FUNCTION event_clients_require_client() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.client_user_id AND role = 'client') THEN
    RAISE EXCEPTION 'Client 역할 사용자만 행사에 지정할 수 있다' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER event_clients_require_client BEFORE INSERT OR UPDATE OF client_user_id ON event_clients
  FOR EACH ROW EXECUTE FUNCTION event_clients_require_client();
