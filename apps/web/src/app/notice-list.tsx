'use client';

/** 목업 공지 데이터. pinned 공지는 목록 최상단에 고정 표시한다. */
const NOTICES: { id: string; pinned?: boolean; title: string; body: string; author: string; date: string }[] = [
  { id: 'n1', pinned: true, title: '10월 정기 점검 안내', body: '10월 26일 새벽 2시부터 4시까지 시스템 점검이 진행됩니다. 점검 시간에는 저장이 지연될 수 있어요.', author: '시스템 관리자', date: '2026.10.20' },
  { id: 'n2', pinned: true, title: 'KIMES 2025 현장 운영 지침 업데이트', body: '부스 설치 시간대와 자재 반입 동선이 변경됐습니다. 현장 담당자는 반드시 확인해 주세요.', author: '박서연', date: '2026.10.15' },
  { id: 'n3', title: '신규 협력사 등록 절차 변경', body: '협력사 등록 시 사업자등록증 외에 계좌 사본이 추가로 필요합니다. 협력사 페이지 담당자 권한 신청도 함께 받습니다.', author: '황지영', date: '2026.10.08' },
  { id: 'n4', title: '견적서 양식 개정 안내', body: '11월 행사부터 새 견적서 양식이 적용됩니다. 템플릿은 행사 상세 문서 탭에서 받을 수 있어요.', author: '정유나', date: '2026.09.30' },
  { id: 'n5', title: '연차 사용 현황 페이지 오픈', body: '사이드바 연차 메뉴에서 팀 전체의 연차 사용 현황을 확인할 수 있습니다.', author: '시스템 관리자', date: '2026.09.22' },
];

export function NoticeList() {
  return (
    <div className="flex w-full flex-col items-start px-[20px] max-md:px-0">
      {NOTICES.map((n) => (
        <article key={n.id} className="flex w-full flex-col items-start gap-[6px] border-b border-solid border-border px-[10px] py-[16px] first:border-t hover:bg-surface-sunken">
          <div className="flex w-full items-center gap-[8px]">
            {n.pinned ? (
              <span className="flex h-[18px] items-center justify-center whitespace-nowrap rounded-sm bg-brand-tint px-[6px] text-2xs font-bold text-brand">고정</span>
            ) : null}
            <h3 className="m-0 whitespace-nowrap text-base font-semibold text-fg">{n.title}</h3>
            <div className="h-px min-w-px flex-1" />
            <span className="whitespace-nowrap text-2xs text-fg-tertiary">{n.date}</span>
          </div>
          <p className="m-0 text-base text-fg-secondary">{n.body}</p>
          <span className="whitespace-nowrap text-2xs text-fg-tertiary">{n.author}</span>
        </article>
      ))}
    </div>
  );
}
