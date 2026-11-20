-- 업로드 파일(원본은 S3, 변환 결과는 event_docs)과 dense 검색용 임베딩 (명세 F-10).
-- 파일 하나는 변환된 Markdown을 가진 event_docs 행 하나로 연결되어, 청크·열람 범위·검색 RLS를 위키와 그대로 공유한다.

CREATE TABLE event_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events (id),
  doc_id      uuid,
  name        text NOT NULL,
  mime        text NOT NULL DEFAULT '',
  size_bytes  bigint NOT NULL CHECK (size_bytes >= 0),
  storage_key text NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  error       text,
  uploaded_by uuid NOT NULL REFERENCES users (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  FOREIGN KEY (doc_id, event_id) REFERENCES event_docs (id, event_id)
);
CREATE INDEX event_files_event_idx ON event_files (event_id, created_at DESC);

ALTER TABLE event_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_files FORCE ROW LEVEL SECURITY;
-- 변환된 문서를 볼 수 있거나 행사 편집자일 때만 파일 메타데이터가 보인다. Client는 is_internal()에서 막힌다.
CREATE POLICY event_files_select ON event_files FOR SELECT
  USING (is_internal() AND (can_edit_event(event_id) OR (doc_id IS NOT NULL AND EXISTS (SELECT 1 FROM event_docs d WHERE d.id = doc_id))));
CREATE POLICY event_files_insert ON event_files FOR INSERT WITH CHECK (can_edit_event(event_id) AND uploaded_by = app_user_id());
CREATE POLICY event_files_update ON event_files FOR UPDATE USING (can_edit_event(event_id)) WITH CHECK (can_edit_event(event_id));
GRANT SELECT, INSERT, UPDATE ON event_files TO miceplans_app;

-- 파일 삭제는 soft delete다. 변환 문서와 색인도 함께 내린다. 원본 보존·파기 기간은 미확정이라 S3 객체는 건드리지 않는다.
CREATE FUNCTION soft_delete_file(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event uuid; v_doc uuid;
BEGIN
  SELECT event_id, doc_id INTO v_event, v_doc FROM event_files WHERE id = p_id AND deleted_at IS NULL;
  IF v_event IS NULL OR NOT can_edit_event(v_event) THEN RETURN false; END IF;
  UPDATE event_files SET deleted_at = now() WHERE id = p_id;
  IF v_doc IS NOT NULL THEN
    UPDATE event_docs SET deleted_at = now(), version = version + 1 WHERE id = v_doc AND deleted_at IS NULL;
    DELETE FROM knowledge_chunks WHERE doc_id = v_doc;
  END IF;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION soft_delete_file(uuid) TO miceplans_app;

-- 청크 임베딩(BGE-M3 dense, 1024차원). pgvector가 설치된 서버에서만 만든다. 없으면 검색은 lexical만 쓴다.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    ALTER TABLE knowledge_chunks ADD COLUMN embedding vector(1024);
    CREATE INDEX knowledge_chunks_embedding_idx ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
    CREATE POLICY knowledge_chunks_update ON knowledge_chunks FOR UPDATE USING (can_edit_event(event_id)) WITH CHECK (can_edit_event(event_id));
    GRANT UPDATE (embedding) ON knowledge_chunks TO miceplans_app;
  END IF;
END $$;
