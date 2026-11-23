-- 대표(Super Admin)의 직원 가입·퇴사 및 관리자 역할 관리 (명세 F-01).
-- 계정은 감사와 과거 업무 연결을 위해 삭제하지 않고 재직 상태만 바꾼다.

ALTER TABLE users
  ADD COLUMN employment_status text NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'departed')),
  ADD COLUMN joined_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN departed_at timestamptz;

ALTER TABLE users ADD CONSTRAINT users_departed_at_matches_status CHECK (
  (employment_status = 'active' AND departed_at IS NULL) OR
  (employment_status = 'departed' AND departed_at IS NOT NULL)
);

CREATE FUNCTION manage_staff_account(p_user_id uuid, p_role text, p_employment_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before users;
  v_role text;
  v_status text;
BEGIN
  IF app_role() <> 'super_admin' OR app_user_id() IS NULL THEN
    RAISE EXCEPTION '직원 계정 관리는 Super Admin만 할 수 있다' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_before FROM users WHERE id = p_user_id AND role <> 'client' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '직원 계정을 찾을 수 없다' USING ERRCODE = 'no_data_found'; END IF;

  v_role := coalesce(p_role, v_before.role);
  v_status := coalesce(p_employment_status, v_before.employment_status);
  IF v_role NOT IN ('super_admin', 'staff') OR v_status NOT IN ('active', 'departed') THEN
    RAISE EXCEPTION '직원 역할 또는 재직 상태가 올바르지 않다' USING ERRCODE = 'check_violation';
  END IF;
  IF p_user_id = app_user_id() AND (v_role <> 'super_admin' OR v_status <> 'active') THEN
    RAISE EXCEPTION '자기 자신의 관리자 권한이나 재직 상태는 해제할 수 없다' USING ERRCODE = 'check_violation';
  END IF;
  IF v_before.role = 'super_admin' AND v_before.employment_status = 'active'
     AND (v_role <> 'super_admin' OR v_status <> 'active')
     AND NOT EXISTS (SELECT 1 FROM users WHERE id <> p_user_id AND role = 'super_admin' AND employment_status = 'active') THEN
    RAISE EXCEPTION '최소 한 명의 재직 중인 Super Admin이 필요하다' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE users SET role = v_role, employment_status = v_status,
    departed_at = CASE WHEN v_status = 'departed' THEN coalesce(departed_at, now()) ELSE NULL END
  WHERE id = p_user_id;
  INSERT INTO audit_log (actor_id, action, detail) VALUES (
    app_user_id(), 'staff.account.change',
    jsonb_build_object('userId', p_user_id, 'beforeRole', v_before.role, 'role', v_role,
      'beforeEmploymentStatus', v_before.employment_status, 'employmentStatus', v_status)
  );
END $$;

GRANT EXECUTE ON FUNCTION manage_staff_account(uuid, text, text) TO miceplans_app;

-- 요청된 기존 jizero 내부 계정을 대표 권한으로 승격한다.
UPDATE users SET role = 'super_admin'
WHERE role <> 'client' AND lower(split_part(email, '@', 1)) = 'jizero';
