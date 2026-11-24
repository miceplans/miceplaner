-- 행사 상태(진행중·성공·확인중·만료·제출·보류중)는 PM·AM(과 Super Admin)만 바꾼다 (2026-11-24 결정).
-- events_update 정책은 행사 멤버 전체에게 수정을 허용하므로, 공개 상태(0022)와 같이 트리거로 막는다.
CREATE FUNCTION events_guard_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT can_manage_members(NEW.id) THEN
    RAISE EXCEPTION '행사 상태는 PM·AM만 바꿀 수 있다' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER events_guard_status BEFORE UPDATE OF status ON events FOR EACH ROW EXECUTE FUNCTION events_guard_status();
