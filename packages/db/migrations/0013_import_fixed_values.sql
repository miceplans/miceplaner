-- Excel 가져오기: 엑셀에 없는 값(PM 등)을 매핑 단계에서 직접 입력해 모든 행에 쓰는 고정값.
ALTER TABLE import_jobs ADD COLUMN fixed_values jsonb;
