-- 행사 멤버와 담당자는 낮은 직원만 된다 (명세 2.1, 3.1).
-- Client 계정은 event_members에 들어갈 수 없으므로 담당자 지정도 불가능하다.
-- 앱 역할이 바로 쓰는 트리거이고 users는 SELECT 권한이 있어 앱 역할 그대로 검사할 수 있다.

CREATE FUNCTION event_members_internal_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND role <> 'client') THEN
    RAISE EXCEPTION '행사 멤버는 낮은 직원만 될 수 있다' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER event_members_internal_only BEFORE INSERT OR UPDATE ON event_members FOR EACH ROW EXECUTE FUNCTION event_members_internal_only();
