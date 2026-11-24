-- 공개 캘린더가 행사마다 지정한 대표색으로 막대를 그린다 (명세 F-07, 결정 2026-11-24).
-- 노출 필드에 events.color만 더한다. 장소·고객사·Program·담당자·상태는 여전히 공개하지 않는다.
-- 반환 형식이 바뀌므로 함수를 다시 만든다.

DROP FUNCTION public_events();

CREATE FUNCTION public_events() RETURNS TABLE (event_id uuid, name text, start_date date, end_date date, color text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.name, e.start_date, e.end_date, e.color
  FROM events e
  WHERE e.public_visible AND e.deleted_at IS NULL
  ORDER BY e.start_date, e.name
$$;

GRANT EXECUTE ON FUNCTION public_events() TO miceplans_app;
