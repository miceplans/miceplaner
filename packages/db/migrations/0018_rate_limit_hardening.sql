-- 요청 제한 카운터 함수(hit_rate_limit) 보강. 공개 인증 엔드포인트에 더해 사용자당 AI 질의 한도도 이 함수를 쓴다.
-- 1) SECURITY DEFINER의 search_path를 pg_catalog, pg_temp로 고정하고 테이블은 스키마를 붙여 부른다.
--    pg_temp를 명시하지 않으면 임시 스키마가 먼저 검색되어, 호출 세션이 만든 같은 이름의 임시 테이블로 카운터를 우회할 수 있다.
-- 2) 입력 검증을 넓힌다: NULL·빈 키, 1일을 넘는 창(정리 주기보다 길면 창 중간에 지워진다), 비정상적으로 큰 한도.
-- 테이블 권한(앱 역할 직접 접근 불가)은 0015 그대로다.

CREATE OR REPLACE FUNCTION hit_rate_limit(p_key text, p_window_seconds integer, p_limit integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  v_window timestamptz;
  v_hits integer;
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 OR length(p_key) > 200
     OR p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400
     OR p_limit IS NULL OR p_limit < 1 OR p_limit > 1000000 THEN
    RAISE EXCEPTION 'invalid rate limit arguments' USING ERRCODE = '22023';
  END IF;
  v_window := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  INSERT INTO public.rate_limits AS r (key, window_start, hits) VALUES (p_key, v_window, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET hits = r.hits + 1
    RETURNING hits INTO v_hits;
  -- 가끔 지난 창을 정리해 테이블이 커지지 않게 한다. 창은 최대 1일이므로 1일이 지난 창은 더 쓰이지 않는다.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
  END IF;
  RETURN v_hits <= p_limit;
END $$;

REVOKE ALL ON FUNCTION hit_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hit_rate_limit(text, integer, integer) TO miceplans_app;
