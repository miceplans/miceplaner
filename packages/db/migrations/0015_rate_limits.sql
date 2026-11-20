-- 공개 인증 엔드포인트(가입·로그인·Client 신청) 요청 제한. 별도 캐시 없이 PostgreSQL 고정 창 카운터를 쓴다.
-- 서버리스 인스턴스가 여러 개여도 같은 카운터를 공유한다. 테이블은 앱 역할이 직접 읽거나 쓸 수 없고
-- 고정된 입력만 받는 SECURITY DEFINER 함수로만 증가시킨다. 키는 해시된 값이라 이메일·IP 원문을 저장하지 않는다.

CREATE TABLE rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits FORCE ROW LEVEL SECURITY;
REVOKE ALL ON rate_limits FROM PUBLIC;
REVOKE ALL ON rate_limits FROM miceplans_app;

-- 반환: 이번 창에서 허용되면 true, 한도를 넘으면 false. 한도를 넘긴 요청도 카운트하지만 상한을 두지 않아 오래 두드릴수록 같은 창에서 계속 거부된다.
CREATE FUNCTION hit_rate_limit(p_key text, p_window_seconds integer, p_limit integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_window timestamptz := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
BEGIN
  IF p_window_seconds < 1 OR p_limit < 1 OR length(p_key) > 200 THEN
    RAISE EXCEPTION 'invalid rate limit arguments';
  END IF;
  INSERT INTO rate_limits (key, window_start, hits) VALUES (p_key, v_window, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET hits = rate_limits.hits + 1
    RETURNING hits INTO v_hits;
  -- 가끔 지난 창을 정리해 테이블이 커지지 않게 한다.
  IF random() < 0.01 THEN
    DELETE FROM rate_limits WHERE window_start < now() - interval '1 day';
  END IF;
  RETURN v_hits <= p_limit;
END $$;

REVOKE ALL ON FUNCTION hit_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hit_rate_limit(text, integer, integer) TO miceplans_app;
