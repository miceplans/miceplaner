-- 비로그인 공개 캘린더 (명세 F-07, 2026-11-24 결정).
-- 공개는 행사별 선택(opt-in)이다. 기본값은 비공개이며 PM·AM(과 Super Admin)이 켠 행사만 노출한다.
-- 노출 필드는 행사명과 기간뿐이다. 장소·고객사·Program·담당자는 공개하지 않는다.

ALTER TABLE events ADD COLUMN public_visible boolean NOT NULL DEFAULT false;
CREATE INDEX events_public_visible_idx ON events (start_date) WHERE public_visible AND deleted_at IS NULL;

-- events_update 정책은 행사 멤버 전체에게 수정을 허용하므로, 공개 상태는 트리거로 PM·AM만 바꾸게 한다.
CREATE FUNCTION events_guard_public_visible() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.public_visible IS DISTINCT FROM OLD.public_visible AND NOT can_manage_members(NEW.id) THEN
    RAISE EXCEPTION '공개 상태는 PM·AM만 바꿀 수 있다' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER events_guard_public_visible BEFORE UPDATE OF public_visible ON events FOR EACH ROW EXECUTE FUNCTION events_guard_public_visible();

-- 공개 전용 모델. 로그인 전 익명 컨텍스트에서도 호출되므로 역할을 묻지 않고, 필터는 함수 안에 둔다.
CREATE FUNCTION public_events() RETURNS TABLE (event_id uuid, name text, start_date date, end_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.name, e.start_date, e.end_date
  FROM events e
  WHERE e.public_visible AND e.deleted_at IS NULL
  ORDER BY e.start_date, e.name
$$;

GRANT EXECUTE ON FUNCTION public_events() TO miceplans_app;
