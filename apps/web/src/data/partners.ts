export const PARTNER_FIELDS: string[] = ['디자인', '영상', '3D', '출력·인쇄', '음향·조명', '물류', '부스 시공'];

export type PartnerField = string;

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
export const PARTNER_FIELD_BADGE = 'text-fg-secondary';

export const PARTNERS: Partner[] = [];
