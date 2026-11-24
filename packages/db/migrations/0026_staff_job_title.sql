-- 대표(Super Admin)가 직원 관리 화면에서 직급(job_title)을 입력한다 (명세 F-01, 결정 2026-11-24).
-- 직급은 하이웍스 공개 API에 없어 MICEPLANNER에서 관리한다. users_update 정책은 본인 행만 허용하므로
-- 기존 manage_staff_account에 직급 인자를 더해 같은 검증·감사 경로로 바꾼다.

DROP FUNCTION manage_staff_account(uuid, text, text);

CREATE FUNCTION manage_staff_account(p_user_id uuid, p_role text, p_employment_status text, p_job_title text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before users;
  v_role text;
  v_status text;
  v_job_title text;
BEGIN
  IF app_role() <> 'super_admin' OR app_user_id() IS NULL THEN
    RAISE EXCEPTION '직원 계정 관리는 Super Admin만 할 수 있다' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_before FROM users WHERE id = p_user_id AND role <> 'client' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '직원 계정을 찾을 수 없다' USING ERRCODE = 'no_data_found'; END IF;

  v_role := coalesce(p_role, v_before.role);
  v_status := coalesce(p_employment_status, v_before.employment_status);
  v_job_title := coalesce(btrim(p_job_title), v_before.job_title);
  IF v_role NOT IN ('super_admin', 'staff') OR v_status NOT IN ('active', 'departed') THEN
    RAISE EXCEPTION '직원 역할 또는 재직 상태가 올바르지 않다' USING ERRCODE = 'check_violation';
  END IF;
  IF char_length(v_job_title) > 50 THEN
    RAISE EXCEPTION '직급은 50자 이하여야 한다' USING ERRCODE = 'check_violation';
  END IF;
  IF p_user_id = app_user_id() AND (v_role <> 'super_admin' OR v_status <> 'active') THEN
    RAISE EXCEPTION '자기 자신의 관리자 권한이나 재직 상태는 해제할 수 없다' USING ERRCODE = 'check_violation';
  END IF;
  IF v_before.role = 'super_admin' AND v_before.employment_status = 'active'
     AND (v_role <> 'super_admin' OR v_status <> 'active')
     AND NOT EXISTS (SELECT 1 FROM users WHERE id <> p_user_id AND role = 'super_admin' AND employment_status = 'active') THEN
    RAISE EXCEPTION '최소 한 명의 재직 중인 Super Admin이 필요하다' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE users SET role = v_role, employment_status = v_status, job_title = v_job_title,
    departed_at = CASE WHEN v_status = 'departed' THEN coalesce(departed_at, now()) ELSE NULL END
  WHERE id = p_user_id;
  INSERT INTO audit_log (actor_id, action, detail) VALUES (
    app_user_id(), 'staff.account.change',
    jsonb_build_object('userId', p_user_id, 'beforeRole', v_before.role, 'role', v_role,
      'beforeEmploymentStatus', v_before.employment_status, 'employmentStatus', v_status,
      'beforeJobTitle', v_before.job_title, 'jobTitle', v_job_title)
  );
END $$;

GRANT EXECUTE ON FUNCTION manage_staff_account(uuid, text, text, text) TO miceplans_app;
