-- Excel 일괄 가져오기(F-08)의 작업 표와 행사 생성 정책.
-- 결정 사항: 가져오기는 행사와 행사 위키를 함께 만든다. 실패한 행은 걸러내고 행별 사유를 남긴다.
-- 원본 파일은 실행(처리) 완료 시 bytea에서 즉시 지운다 (원본 보관 정책: 처리 후 즉시 파기, 명세 6절 확정).

CREATE TABLE import_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name     text NOT NULL,
  -- 원본 파일 바이트. 실행(실패 포함)이 끝나는 즉시 NULL로 지운다 (처리 후 즉시 파기).
  file          bytea,
  sheets        jsonb NOT NULL DEFAULT '[]',
  status        text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'parsed', 'previewed', 'executing', 'done', 'failed')),
  sheet         text,
  has_header    boolean,
  header_row    integer,
  columns       jsonb,
  -- 파싱된 원본 그리드(문자열 2차원 배열)와 각 행의 원본 시트 행 번호. 실행 완료 시 함께 지운다.
  rows          jsonb,
  row_numbers   integer[],
  data_row_count integer,
  mapping       jsonb,
  validation    jsonb,
  result        jsonb,
  error         text,
  created_by    uuid NOT NULL REFERENCES users (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX import_jobs_created_by_idx ON import_jobs (created_by, created_at DESC);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs FORCE ROW LEVEL SECURITY;

-- 가져오기 작업은 만든 사람만 본다. 업로드·실행 모두 낮은 권한 이상이고 본인 것만 다룬다.
CREATE POLICY import_jobs_select ON import_jobs FOR SELECT USING (is_internal() AND created_by = app_user_id());
CREATE POLICY import_jobs_insert ON import_jobs FOR INSERT WITH CHECK (is_internal() AND created_by = app_user_id());
CREATE POLICY import_jobs_update ON import_jobs FOR UPDATE USING (is_internal() AND created_by = app_user_id()) WITH CHECK (is_internal() AND created_by = app_user_id());

-- ── 행사 생성 ───────────────────────────────────────────────────────────────
-- 가져오기로 행사를 만들 수 있어야 해서 INSERT 정책이 필요하다. 일반 생성 API 노출 여부는 별도 미확정(명세 6절)이고,
-- 이 정책은 가져오기 범위만큼만 연다: 낮은 권한 이상이고 생성 주체를 created_by에 남긴다.
CREATE POLICY events_insert ON events FOR INSERT WITH CHECK (is_internal() AND created_by = app_user_id());

-- 고객사 이름을 찾지 못하면 가져오기 안에서 새 고객사를 만든다. 정책은 낮은 권한 이상으로 제한한다.
CREATE POLICY clients_insert ON clients FOR INSERT WITH CHECK (is_internal());

-- 새 행사의 첫 멤버(실행 주체를 PM으로)는 멤버가 아직 없어 can_manage_members를 통과하지 못하므로
-- soft_delete 함수와 같은 방식의 소유자 권한 함수로 둔다. 낮은 권한만 검사한다.
CREATE FUNCTION import_add_event_creator(p_event_id uuid, p_user_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_internal() THEN RETURN false; END IF;
  INSERT INTO event_members (event_id, user_id, role) VALUES (p_event_id, p_user_id, 'pm');
  RETURN true;
END $$;

GRANT SELECT, INSERT, UPDATE ON import_jobs TO miceplans_app;
GRANT INSERT ON events TO miceplans_app;
GRANT INSERT ON clients TO miceplans_app;
GRANT EXECUTE ON FUNCTION import_add_event_creator(uuid, uuid) TO miceplans_app;
