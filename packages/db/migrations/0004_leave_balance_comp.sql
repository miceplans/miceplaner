-- 연차 현황의 compEarned 집계를 주말 근무 개별 기록 정책과 분리한다.
-- weekend_work의 SELECT는 본인 것만 허용하지만, 직원 전체의 대휴 발생 일수는 연차 현황(F-12)에 필요하다.
-- 날짜가 아니라 집계 값만 노출하는 소유자 권한 함수로 제공한다.

CREATE FUNCTION weekend_work_year_counts(p_year int) RETURNS TABLE (user_id uuid, days numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, count(*)::numeric FROM weekend_work WHERE extract(year FROM work_date) = p_year GROUP BY user_id
$$;

GRANT EXECUTE ON FUNCTION weekend_work_year_counts(int) TO miceplans_app;
