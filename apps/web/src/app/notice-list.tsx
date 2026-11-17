'use client';

/** 공지 목록. pinned 공지는 목록 최상단에 고정 표시한다. */
const NOTICES: { id: string; pinned?: boolean; title: string; body: string; author: string; date: string }[] = [];

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
