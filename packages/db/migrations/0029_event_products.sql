-- 행사 상세의 디자인 요청(제작물) 표를 브라우저 저장에서 서버로 옮긴다 (명세 F-04, 2026-11-24 결정).
-- 행은 웹이 만든 uuid로 식별하고 PUT으로 통째로 저장한다(마지막 저장 우선). 내부 직원은 모두 보고, 행사 멤버만 쓴다.

CREATE TABLE event_products (
  id          uuid PRIMARY KEY,
  event_id    uuid NOT NULL REFERENCES events (id),
  name        text NOT NULL DEFAULT '' CHECK (char_length(name) <= 200),
  part        text NOT NULL CHECK (part IN ('디자인', '영상', '3D')),
  due_on      date,
  size        text NOT NULL DEFAULT '' CHECK (char_length(size) <= 200),
  qty         text NOT NULL DEFAULT '' CHECK (char_length(qty) <= 200),
  material    text NOT NULL DEFAULT '' CHECK (char_length(material) <= 200),
  vendor      text NOT NULL DEFAULT '' CHECK (char_length(vendor) <= 200),
  contact     text NOT NULL DEFAULT '' CHECK (char_length(contact) <= 200),
  note        text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  negotiating boolean NOT NULL DEFAULT false,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'success', 'reject')),
  created_by  uuid NOT NULL REFERENCES users (id),
  updated_by  uuid NOT NULL REFERENCES users (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX event_products_event_idx ON event_products (event_id, created_at) WHERE deleted_at IS NULL;

-- 행을 다른 행사로 옮겨 권한을 바꾸지 못하게 한다.
CREATE FUNCTION event_products_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_id <> OLD.event_id OR NEW.created_by <> OLD.created_by THEN
    RAISE EXCEPTION '제작물의 행사와 만든 사람은 바꿀 수 없다' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER event_products_guard BEFORE UPDATE ON event_products FOR EACH ROW EXECUTE FUNCTION event_products_guard();

ALTER TABLE event_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_products FORCE ROW LEVEL SECURITY;
CREATE POLICY event_products_select ON event_products FOR SELECT USING (is_internal() AND deleted_at IS NULL);
CREATE POLICY event_products_insert ON event_products FOR INSERT
  WITH CHECK (can_edit_event_items(event_id) AND created_by = app_user_id() AND updated_by = app_user_id());
CREATE POLICY event_products_update ON event_products FOR UPDATE
  USING (deleted_at IS NULL AND can_edit_event_items(event_id))
  WITH CHECK (can_edit_event_items(event_id) AND updated_by = app_user_id());
GRANT SELECT, INSERT, UPDATE ON event_products TO miceplans_app;

-- soft delete. 삭제된 행은 SELECT 정책에서 빠지므로 행사 멤버 확인 후 정의자 권한으로 표시한다.
CREATE FUNCTION soft_delete_event_product(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event uuid;
BEGIN
  SELECT event_id INTO v_event FROM event_products WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND OR NOT is_internal() OR NOT can_edit_event_items(v_event) THEN RETURN false; END IF;
  UPDATE event_products SET deleted_at = now(), updated_by = app_user_id() WHERE id = p_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION soft_delete_event_product(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soft_delete_event_product(uuid) TO miceplans_app;
