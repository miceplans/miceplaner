-- 휴무계의 사유와 대체 근무자를 저장한다 (명세 F-12, 2026-11-25 결정: 내부 직원 전원이 본다).
-- 열람은 leave_requests의 기존 SELECT 정책(내부 직원)을 그대로 따르고 Client는 볼 수 없다. 추가만 하므로 이전 코드와 호환된다.

ALTER TABLE leave_requests
  ADD COLUMN reason        text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 500),
  ADD COLUMN substitute_id uuid REFERENCES users (id),
  ADD CONSTRAINT leave_requests_substitute_other CHECK (substitute_id <> user_id);

-- 대체 근무자는 재직 중인 내부 직원이어야 한다.
CREATE FUNCTION leave_requests_check_substitute() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.substitute_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.substitute_id AND role <> 'client' AND employment_status = 'active'
  ) THEN
    RAISE EXCEPTION '대체 근무자는 재직 중인 내부 직원이어야 한다' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER leave_requests_check_substitute BEFORE INSERT OR UPDATE OF substitute_id ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION leave_requests_check_substitute();
