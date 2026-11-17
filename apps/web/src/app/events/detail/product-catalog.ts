export type ProductCatalogItem = {
  category: string;
  name: string;
  size: string;
  material: string;
  vendor: string;
  contact: string;
  tags: string;
};

/** 제작물 카테고리 식별 칩 색상(카테고리 데이터). */
export const CAT_COLORS: Record<string, string> = {
  '현장 제작물': 'bg-[#eef4ff] text-[#2563eb]',
  '종이 인쇄물': 'bg-[#fff4e5] text-[#b45309]',
  웹: 'bg-[#e8f8f0] text-[#059669]',
  '무대': 'bg-[#f5edff] text-[#7c3aed]',
  부스: 'bg-[#fdeef4] text-[#db2777]',
  제작물: 'bg-[#eef2f7] text-[#334155]',
  간지: 'bg-[#fffbe5] text-[#a16207]',
};

export const PRODUCT_CATALOG: ProductCatalogItem[] = [];
