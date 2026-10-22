/** 행사 제작 파트. 제작물·일정·문서에 part를 붙여 파트별로 화면을 나눠 본다. */
export const PRODUCT_PARTS = ['디자인', '영상', '3D'] as const;
export type ProductPart = (typeof PRODUCT_PARTS)[number];

export const PART_FILTERS = ['전체', ...PRODUCT_PARTS] as const;
export type PartFilter = (typeof PART_FILTERS)[number];

/**
 * 파트 필터링. part가 없는 항목은 공통 항목으로 취급해 어느 파트에서든 볼 수 있다.
 * '전체'를 선택하면 모든 항목을 그대로 반환한다.
 */
export function matchPart<T extends { part?: ProductPart }>(items: T[], part: PartFilter): T[] {
  return part === '전체' ? items : items.filter((x) => !x.part || x.part === part);
}
