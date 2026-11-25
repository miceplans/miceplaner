-- 외부 협력사 목록을 브라우저 저장에서 서버로 옮긴다 (명세 F-14, 2026-11-25).
-- 행사와 무관한 회사 공용 주소록이라 내부 직원 전원이 보고 고치며, Client는 접근할 수 없다.

CREATE TABLE partner_fields (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40 AND name <> '전체'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX partner_fields_name_uniq ON partner_fields (name) WHERE deleted_at IS NULL;

CREATE TABLE partners (
  id         uuid PRIMARY KEY,
  name       text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  -- 분야 태그 이름. 태그를 지워도 협력사에 적힌 값은 남는다.
  field      text NOT NULL DEFAULT '' CHECK (char_length(field) <= 40),
  manager    text NOT NULL DEFAULT '' CHECK (char_length(manager) <= 100),
  phone      text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 100),
  email      text NOT NULL DEFAULT '' CHECK (char_length(email) <= 200),
  memo       text NOT NULL DEFAULT '' CHECK (char_length(memo) <= 2000),
  created_by uuid NOT NULL REFERENCES users (id),
  updated_by uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE FUNCTION partners_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.created_by <> OLD.created_by THEN
    RAISE EXCEPTION '협력사를 만든 사람은 바꿀 수 없다' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER partners_guard BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION partners_guard();

ALTER TABLE partner_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_fields FORCE ROW LEVEL SECURITY;
CREATE POLICY partner_fields_select ON partner_fields FOR SELECT USING (is_internal() AND deleted_at IS NULL);
CREATE POLICY partner_fields_insert ON partner_fields FOR INSERT WITH CHECK (is_internal() AND deleted_at IS NULL);
CREATE POLICY partner_fields_update ON partner_fields FOR UPDATE USING (is_internal() AND deleted_at IS NULL) WITH CHECK (is_internal());

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners FORCE ROW LEVEL SECURITY;
CREATE POLICY partners_select ON partners FOR SELECT USING (is_internal() AND deleted_at IS NULL);
CREATE POLICY partners_insert ON partners FOR INSERT
  WITH CHECK (is_internal() AND deleted_at IS NULL AND created_by = app_user_id() AND updated_by = app_user_id());
CREATE POLICY partners_update ON partners FOR UPDATE USING (is_internal() AND deleted_at IS NULL) WITH CHECK (is_internal() AND updated_by = app_user_id());

GRANT SELECT, INSERT, UPDATE ON partner_fields, partners TO miceplans_app;

-- soft delete. 삭제된 행은 SELECT 정책에서 빠지므로 내부 직원인지 확인한 뒤 정의자 권한으로 표시하고 감사 로그를 남긴다.
CREATE FUNCTION soft_delete_partner(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
BEGIN
  IF NOT is_internal() OR app_user_id() IS NULL THEN RETURN false; END IF;
  UPDATE partners SET deleted_at = now(), updated_by = app_user_id() WHERE id = p_id AND deleted_at IS NULL RETURNING name INTO v_name;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO audit_log (event_id, actor_id, action, detail)
    VALUES (NULL, app_user_id(), 'partner.delete', jsonb_build_object('partnerId', p_id, 'name', v_name));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION soft_delete_partner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soft_delete_partner(uuid) TO miceplans_app;

CREATE FUNCTION soft_delete_partner_field(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
BEGIN
  IF NOT is_internal() OR app_user_id() IS NULL THEN RETURN false; END IF;
  UPDATE partner_fields SET deleted_at = now() WHERE id = p_id AND deleted_at IS NULL RETURNING name INTO v_name;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO audit_log (event_id, actor_id, action, detail)
    VALUES (NULL, app_user_id(), 'partner_field.delete', jsonb_build_object('fieldId', p_id, 'name', v_name));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION soft_delete_partner_field(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soft_delete_partner_field(uuid) TO miceplans_app;

INSERT INTO partner_fields (name) VALUES ('디자인'), ('영상'), ('3D'), ('출력·인쇄'), ('음향·조명'), ('물류'), ('부스 시공');
