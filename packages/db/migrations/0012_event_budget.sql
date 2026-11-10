-- 행사 생성 화면에서 입력하는 예산(원). 비워 두면 미정이다. 견적·마진은 여전히 모델 미확정(명세 6절).
ALTER TABLE events ADD COLUMN budget bigint CHECK (budget IS NULL OR budget >= 0);
