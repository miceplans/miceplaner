-- 위키 협업 편집 저장소 (명세 F-09). Yjs 상태가 본문의 기준이고 event_docs.body_md는 검색·AI용 파생본이다.
-- 상태는 문서당 하나의 병합된 스냅샷이다. wiki_revisions는 명시적 버전 생성·AI 제안 승인·되돌리기에서만 만든다.
CREATE TABLE wiki_ydoc (
  doc_id     uuid PRIMARY KEY,
  event_id   uuid NOT NULL,
  state      bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (doc_id, event_id) REFERENCES event_docs (id, event_id) ON DELETE CASCADE
);
ALTER TABLE wiki_ydoc ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_ydoc FORCE ROW LEVEL SECURITY;
-- 문서를 볼 수 있어야 상태를 읽는다. 쓰기는 PM·AM(과 Super Admin)만이다.
CREATE POLICY wiki_ydoc_select ON wiki_ydoc FOR SELECT USING (EXISTS (SELECT 1 FROM event_docs d WHERE d.id = doc_id));
CREATE POLICY wiki_ydoc_insert ON wiki_ydoc FOR INSERT WITH CHECK (can_edit_event(event_id));
CREATE POLICY wiki_ydoc_update ON wiki_ydoc FOR UPDATE USING (can_edit_event(event_id)) WITH CHECK (can_edit_event(event_id));
GRANT SELECT, INSERT, UPDATE ON wiki_ydoc TO miceplans_app;

CREATE TABLE wiki_revisions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id     uuid NOT NULL,
  event_id   uuid NOT NULL,
  version    integer NOT NULL,
  title      text NOT NULL,
  body_md    text NOT NULL,
  reason     text NOT NULL CHECK (reason IN ('manual', 'ai_proposal', 'restore')),
  created_by uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (doc_id, event_id) REFERENCES event_docs (id, event_id) ON DELETE CASCADE
);
CREATE INDEX wiki_revisions_doc_idx ON wiki_revisions (doc_id, created_at DESC);
ALTER TABLE wiki_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_revisions FORCE ROW LEVEL SECURITY;
CREATE POLICY wiki_revisions_select ON wiki_revisions FOR SELECT USING (EXISTS (SELECT 1 FROM event_docs d WHERE d.id = doc_id));
CREATE POLICY wiki_revisions_insert ON wiki_revisions FOR INSERT WITH CHECK (can_edit_event(event_id) AND created_by = app_user_id());
GRANT SELECT, INSERT ON wiki_revisions TO miceplans_app;
