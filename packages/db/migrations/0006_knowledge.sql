-- 위키 파생 본문 색인, AI 제안, AI 호출 로그 (명세 F-10, F-11).
-- 한국어 검색은 형태소 분석기 없이 `simple` tsvector 접두 일치와 pg_trgm으로 처리한다 (서버 비용 최소화).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Markdown은 검색·AI용 파생본이다. Yjs 원본 저장은 협업 단계(Hocuspocus)에서 추가하고, 그 전까지는 이 열이 본문이다.
ALTER TABLE event_docs
  ADD COLUMN body_md    text NOT NULL DEFAULT '',
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT event_docs_id_event_key UNIQUE (id, event_id);

-- 권한이 달린 청크. event_id를 유지하고 열람 범위는 event_docs RLS를 그대로 따른다.
CREATE TABLE knowledge_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id      uuid NOT NULL,
  event_id    uuid NOT NULL,
  chunk_index integer NOT NULL,
  heading     text NOT NULL DEFAULT '',
  content     text NOT NULL,
  tsv         tsvector GENERATED ALWAYS AS (to_tsvector('simple', heading || ' ' || content)) STORED,
  FOREIGN KEY (doc_id, event_id) REFERENCES event_docs (id, event_id) ON DELETE CASCADE,
  UNIQUE (doc_id, chunk_index)
);
CREATE INDEX knowledge_chunks_tsv_idx ON knowledge_chunks USING gin (tsv);
CREATE INDEX knowledge_chunks_trgm_idx ON knowledge_chunks USING gin (content gin_trgm_ops);
CREATE INDEX knowledge_chunks_event_idx ON knowledge_chunks (event_id);

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks FORCE ROW LEVEL SECURITY;
-- 문서를 볼 수 없으면 청크도 볼 수 없다. 서브쿼리에도 event_docs RLS가 적용된다.
CREATE POLICY knowledge_chunks_select ON knowledge_chunks FOR SELECT USING (EXISTS (SELECT 1 FROM event_docs d WHERE d.id = doc_id));
CREATE POLICY knowledge_chunks_insert ON knowledge_chunks FOR INSERT WITH CHECK (can_edit_event(event_id));
CREATE POLICY knowledge_chunks_delete ON knowledge_chunks FOR DELETE USING (can_edit_event(event_id));
GRANT SELECT, INSERT, DELETE ON knowledge_chunks TO miceplans_app;

-- 위키 삭제는 soft delete다. 청크는 색인에서 지운다.
CREATE FUNCTION soft_delete_doc(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event uuid;
BEGIN
  SELECT event_id INTO v_event FROM event_docs WHERE id = p_id AND deleted_at IS NULL;
  IF v_event IS NULL OR NOT can_edit_event(v_event) THEN RETURN false; END IF;
  UPDATE event_docs SET deleted_at = now(), version = version + 1 WHERE id = p_id;
  DELETE FROM knowledge_chunks WHERE doc_id = p_id;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION soft_delete_doc(uuid) TO miceplans_app;

-- AI 제안. 승인 전에는 원본 데이터를 바꾸지 않는다. 승인 반영은 승인자의 권한으로 서버 API가 실행한다.
CREATE TABLE ai_proposals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events (id),
  kind       text NOT NULL CHECK (kind IN ('task_drafts', 'notification', 'wiki_edit')),
  summary    text NOT NULL DEFAULT '',
  payload    jsonb NOT NULL,
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES users (id),
  decided_at timestamptz,
  CHECK ((status = 'pending') = (decided_by IS NULL))
);
CREATE INDEX ai_proposals_event_idx ON ai_proposals (event_id, status, created_at DESC);

ALTER TABLE ai_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_proposals FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_proposals_select ON ai_proposals FOR SELECT USING (is_internal() AND (created_by = app_user_id() OR can_edit_event(event_id)));
CREATE POLICY ai_proposals_insert ON ai_proposals FOR INSERT WITH CHECK (is_internal() AND created_by = app_user_id() AND status = 'pending');
-- 승인·반려는 PM·AM만 한다. 이미 결정된 제안은 다시 바꿀 수 없다.
CREATE POLICY ai_proposals_update ON ai_proposals FOR UPDATE USING (can_edit_event(event_id) AND status = 'pending') WITH CHECK (can_edit_event(event_id) AND decided_by = app_user_id());
GRANT SELECT, INSERT, UPDATE ON ai_proposals TO miceplans_app;

-- 호출별 프롬프트, 도구 호출, 토큰, 지연 기록 (명세 F-11). 본인 기록과 Super Admin만 본다.
CREATE TABLE ai_calls (
  id                bigserial PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES users (id),
  event_id          uuid REFERENCES events (id),
  model             text NOT NULL,
  messages          jsonb NOT NULL,
  tool_calls        jsonb NOT NULL DEFAULT '[]',
  prompt_tokens     integer,
  completion_tokens integer,
  latency_ms        integer NOT NULL,
  error             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ai_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_calls FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_calls_select ON ai_calls FOR SELECT USING (user_id = app_user_id() OR app_role() = 'super_admin');
CREATE POLICY ai_calls_insert ON ai_calls FOR INSERT WITH CHECK (user_id = app_user_id() AND is_internal());
GRANT SELECT, INSERT ON ai_calls TO miceplans_app;
GRANT USAGE ON SEQUENCE ai_calls_id_seq TO miceplans_app;
