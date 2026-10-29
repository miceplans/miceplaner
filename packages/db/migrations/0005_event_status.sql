-- 행사 상태를 진행중·완료·입찰준비중·진행협의중 4종으로 바꾼다.
ALTER TABLE events DROP CONSTRAINT events_status_check;

UPDATE events SET status = CASE status
  WHEN '성공' THEN '완료'
  WHEN '만료' THEN '완료'
  WHEN '제출' THEN '입찰준비중'
  WHEN '확인중' THEN '진행협의중'
  WHEN '보류중' THEN '진행협의중'
  ELSE status
END;

ALTER TABLE events ADD CONSTRAINT events_status_check CHECK (status IN ('진행중', '완료', '입찰준비중', '진행협의중'));
