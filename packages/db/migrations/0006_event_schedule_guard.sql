-- 행사 상태·기간(시작일·종료일) 변경은 그 행사의 PM·AM(과 Super Admin)만 한다. 이름·장소 같은 다른 기본 정보는 행사 멤버가 고친다.
CREATE FUNCTION events_guard_schedule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.status, NEW.start_date, NEW.end_date) IS DISTINCT FROM (OLD.status, OLD.start_date, OLD.end_date) THEN
    IF current_event_role(NEW.id) NOT IN ('super_admin', 'pm', 'am') THEN
      RAISE EXCEPTION '행사 상태·기간은 PM·AM만 바꿀 수 있다' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER events_guard_schedule BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION events_guard_schedule();
