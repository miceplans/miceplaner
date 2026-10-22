export const PARTNER_FIELDS = ['디자인', '영상', '3D', '출력·인쇄', '음향·조명', '물류', '부스 시공'] as const;

export type PartnerField = (typeof PARTNER_FIELDS)[number];

export type Partner = {
  id: string;
  name: string;
  field: PartnerField;
  manager: string;
  phone: string;
  email: string;
  events: string;
  memo: string;
};

/** 분야 뱃지 스타일 — 분야별 색 구분 없이 공통 무채색으로 표시. */
export const PARTNER_FIELD_BADGE = 'bg-surface-chip text-fg-secondary';

export const PARTNERS: Partner[] = [
  { id: 'p1', name: '모어디자인랩', field: '디자인', manager: '배수진 실장', phone: '02-541-0287', email: 'sujin.bae@moredesign.kr', events: '제54회 KIMES 2025 · 글로벌 AI 서밋 2025', memo: '키비주얼·브로슈어 담당. 시안 회신 평균 2일, 급건은 당일 오전 요청 필요.' },
  { id: 'p2', name: '그라피카 스튜디오', field: '디자인', manager: '최유나 팀장', phone: '02-6954-1180', email: 'yna@graphica.kr', events: 'K-데모데이 2025', memo: '등록 폼·랜딩페이지 UI. 월 단위 패키지 계약, 소스 파일 원본 인도.' },
  { id: 'p3', name: '루멘픽처스', field: '영상', manager: '오현석 프로듀서', phone: '02-3445-7710', email: 'hs.oh@lumenpictures.kr', events: '글로벌 AI 서밋 2025', memo: '오프닝·하이라이트 영상. 4K 원본 보관 6개월, 납품 전 2회 수정 포함.' },
  { id: 'p4', name: '필름레이커스', field: '영상', manager: '강민호 감독', phone: '010-5517-9032', email: 'mh.kang@filmakers.kr', events: 'K-데모데이 2025 · 브랜드 갤라 나이트', memo: '행사 실황 촬영·인터뷰 클립. 2인 1팀, 원본 데이터 행사 다음 날 전달.' },
  { id: 'p5', name: '디멘션랩', field: '3D', manager: '김태훈 대표', phone: '010-8821-4456', email: 'dim.lab3d@gmail.com', events: '제54회 KIMES 2025 · 프랜차이즈 엑스포 2025', memo: '부스 3D 렌더링 전문. 코엑스·킨텍스 규격 도면 보유, 앵글 3컷 기본 제공.' },
  { id: 'p6', name: '태흥인쇄', field: '출력·인쇄', manager: '윤정미 과장', phone: '02-2264-9083', email: 'jm.yoon@taeheung.co.kr', events: '제54회 KIMES 2025 · 브랜드 갤라 나이트', memo: '대형 출력·현수막. 당일 오후 3시 전 주문 시 익일 새벽 배송 가능.' },
  { id: 'p7', name: '프린트온', field: '출력·인쇄', manager: '정해인 실장', phone: '02-2270-5466', email: 'hi.jung@printon.co.kr', events: '제54회 KIMES 2025', memo: '초청장·명찰 소량 인쇄. 시안 확정 후 3영업일 납품, 샘플 1부 제공.' },
  { id: 'p8', name: '사운드웨이브', field: '음향·조명', manager: '신동철 팀장', phone: '02-548-6621', email: 'dc.shin@soundwave.kr', events: '글로벌 AI 서밋 2025 · 브랜드 갤라 나이트', memo: '세미나룸~대형 홀 장비 세팅. 현장 엔지니어 2인 상주 기준 견적.' },
  { id: 'p9', name: '라이팅코리아', field: '음향·조명', manager: '박서윤 대표', phone: '02-1644-7789', email: 'lightingkorea@naver.com', events: '프랜차이즈 엑스포 2025', memo: '야외 특수조명·트러스 렌탈. 안전검사 리스트 사전 협의 필수.' },
  { id: 'p10', name: '이지로지스틱스', field: '물류', manager: '한아름 대리', phone: '02-2107-3355', email: 'ar.han@easylogi.kr', events: '제54회 KIMES 2025', memo: '전시물 자체통관·현장 반입. 도면 승인 후 5영업일 전 입고 스케줄 확정.' },
  { id: 'p11', name: '스페이스솔루션', field: '부스 시공', manager: '이종민 소장', phone: '031-479-2248', email: 'jm.lee@spacesolution.kr', events: '제54회 KIMES 2025 · 프랜차이즈 엑스포 2025', memo: '목재·시스템 부스 시공. 코엑스 지정업체, 설치 면허증 구비.' },
  { id: 'p12', name: '엑스포빌더', field: '부스 시공', manager: '문준영 이사', phone: '02-508-9912', email: 'jy.moon@expobuilder.kr', events: '글로벌 AI 서밋 2025', memo: '모듈러 부스·LED 월 시공. 킨텍스 2전시장 반입 경험 다수.' },
];
