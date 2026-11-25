import type { PartnerDto, SavePartnerBody } from '@miceplans/contracts';

/** 서버 저장 전 이 브라우저에만 저장한 협력사. 사용자가 눌러 서버로 옮긴다. */
const FIELDS_KEY = 'miceplans.partners.fields';
const LIST_KEY = 'miceplans.partners.list';

export type LocalPartners = { fields: string[]; partners: SavePartnerBody[] };

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** 저장값을 저장 계약에 맞는 값으로 바꾼다. 업체명이 없는 행과 깨진 값은 버린다. */
export function parseLocalPartners(fields: string | null, list: string | null): LocalPartners {
  const read = (raw: string | null): unknown[] => {
    try {
      const value: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  return {
    fields: [...new Set(read(fields).map((f) => text(f, 40)).filter((f) => f && f !== '전체'))],
    partners: read(list)
      .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
      .map((p) => ({ name: text(p.name, 200), field: text(p.field, 40), manager: text(p.manager, 100), phone: text(p.phone, 100), email: text(p.email, 200), memo: text(p.memo, 2000) }))
      .filter((p) => p.name),
  };
}

/** 업체명과 연락처가 같으면 같은 협력사로 본다. */
export const samePartner = (a: Pick<PartnerDto, 'name' | 'phone'>, b: Pick<PartnerDto, 'name' | 'phone'>) =>
  a.name.trim() === b.name.trim() && a.phone.replace(/\D/g, '') === b.phone.replace(/\D/g, '');

export function readLocalPartners(): LocalPartners {
  try {
    return parseLocalPartners(window.localStorage.getItem(FIELDS_KEY), window.localStorage.getItem(LIST_KEY));
  } catch {
    return { fields: [], partners: [] };
  }
}

/** 옮기지 못한 협력사만 남긴다. 모두 옮겼으면 저장값을 지운다. */
export function keepLocalPartners(rest: SavePartnerBody[]): void {
  try {
    if (rest.length) {
      window.localStorage.setItem(LIST_KEY, JSON.stringify(rest));
      return;
    }
    window.localStorage.removeItem(LIST_KEY);
    window.localStorage.removeItem(FIELDS_KEY);
  } catch {
    /* 저장할 수 없는 환경에서는 화면에서만 바꾼다. */
  }
}
