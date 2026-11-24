-- 행사 디자인 담당(명세 F-06, 2026-11-24). 행사 상세의 '디자인' 속성으로 지정한다.
-- 권한은 일반 행사 멤버와 같다: 항목 편집은 하되 멤버 관리·공개 상태 변경·위키 편집은 하지 않는다.
-- 그래서 권한 판정(current_event_role)에서는 'member'로 본다. 기존 정책·함수는 그대로 둔다.

ALTER TABLE event_members DROP CONSTRAINT event_members_role_check;
ALTER TABLE event_members ADD CONSTRAINT event_members_role_check CHECK (role IN ('pm', 'am', 'design', 'member'));

CREATE OR REPLACE FUNCTION current_event_role(p_event_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN app_role() IN ('super_admin', 'client') THEN app_role()
    ELSE coalesce(
      (SELECT CASE m.role WHEN 'design' THEN 'member' ELSE m.role END FROM event_members m WHERE m.event_id = p_event_id AND m.user_id = app_user_id()),
      'staff')
  END
$$;
