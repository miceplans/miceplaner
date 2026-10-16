'use client';

import { useEffect } from 'react';

const A = '/assets/schedule';

const PROPS = [
  { icon: 'f7145', label: '기간', value: '6월 13일 (금) · 오후 2:00 ~ 오후 3:30' },
  { icon: '5b17e', label: '장소', value: '메인 스테이지 · 음향 감독 구역' },
] as const;

const LINKS = [
  { icon: '04dda', name: '사운드 세팅 시트', meta: 'Google Sheets' },
  { icon: '7197f', name: '스테이지 도면.pdf', meta: '2.4 MB' },
] as const;

const MEMO = '메인 스테이지 전체 사운드 밸런싱 작업입니다. 음향 업체와 협의한 세팅 시트를 참고해 진행하세요.';

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-[12px]">
      <p className="h-[16.433px] whitespace-nowrap text-md font-bold tracking-[0.4695px] text-fg-strong">{label}</p>
      {children}
    </div>
  );
}

function TextBlock({ children }: { children: string }) {
  return (
    <div className="flex w-full items-center justify-center rounded-md bg-surface-subtle px-[16.433px] py-[12.912px]">
      <p className="w-full text-lg text-fg-strong">{children}</p>
    </div>
  );
}

export function SidePeekPanel({
  title,
  date,
  period,
  place,
  onClose,
}: {
  title: string;
  date?: string;
  period?: string;
  place?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const props = PROPS.map((p) => (p.label === '기간' && period ? { ...p, value: period } : p.label === '장소' && place ? { ...p, value: place } : p));

  return (
    <>
      <div className="fixed inset-0 z-30 bg-transparent" onClick={onClose} aria-hidden />
      <aside
        aria-label="일정 상세"
        className="side-peek-in fixed right-[24px] top-[96px] z-40 flex h-[694px] max-h-[calc(100vh-112px)] w-[498px] max-w-full flex-col gap-[24px] rounded-2xl bg-surface p-[40px] leading-[normal] shadow-card"
      >
        <div className="flex min-h-0 w-full flex-1 flex-col items-start gap-[32px] overflow-y-auto">
          <div className="flex flex-col gap-[4px]">
            <h2 className="text-3xl font-bold text-fg-strong">{title}</h2>
            {date ? <p className="text-sm text-fg-tertiary">{date}</p> : null}
          </div>
          <div className="flex w-full flex-col items-start gap-[24px]">
            <div className="flex flex-col gap-[1.379px]">
              {props.map((p) => (
                <div key={p.label} className="flex h-[30px] w-full items-center gap-[8.465px] py-[4.699px] text-xs text-fg-strong">
                  <div className="flex w-[71.653px] shrink-0 items-center gap-[8.223px]">
                    <img alt="" src={`${A}/${p.icon}.svg`} className="size-[14.108px]" />
                    <span className="whitespace-nowrap">{p.label}</span>
                  </div>
                  <span className="whitespace-nowrap">{p.value}</span>
                </div>
              ))}
              <div className="flex h-[30px] w-full items-center gap-[8.465px] py-[4.699px] text-xs text-fg-strong">
                <div className="flex w-[71.653px] shrink-0 items-center gap-[8.223px]">
                  <img alt="" src={`${A}/dd62d.svg`} className="size-[14.108px]" />
                  <span className="whitespace-nowrap">담당자</span>
                </div>
                <div className="flex items-center gap-[8px]">
                  <div className="flex items-center gap-[4px]">
                    <span className="flex size-[20.691px] items-center justify-center rounded-lg bg-success-solid text-2xs font-bold text-fg-inverse">MN</span>
                    <span className="whitespace-nowrap">민준</span>
                  </div>
                  <button type="button" aria-label="담당자 추가" className="flex size-[18.81px] items-center justify-center rounded-md hover:bg-surface-chip">
                    <img alt="" src={`${A}/1d729.svg`} className="size-[9.405px]" />
                  </button>
                </div>
              </div>
            </div>
            <Section label="설명">
              <TextBlock>{MEMO}</TextBlock>
            </Section>
            <Section label="클라이언트 메모">
              <TextBlock>{MEMO}</TextBlock>
            </Section>
            <Section label="관련 링크 및 첨부">
              <div className="flex w-full flex-col gap-[2px]">
                {LINKS.map((l) => (
                  <a key={l.name} href="#" className="flex w-full items-center gap-[10.564px] rounded-md p-[8.217px] hover:bg-surface-muted">
                    <img alt="" src={`${A}/${l.icon}.svg`} className="size-[15.26px]" />
                    <span className="whitespace-nowrap text-md text-fg-strong">{l.name}</span>
                    <span className="h-[1.174px] min-w-px flex-1" />
                    <span className="whitespace-nowrap text-sm text-fg-tertiary">{l.meta}</span>
                  </a>
                ))}
              </div>
            </Section>
          </div>
        </div>
        <button type="button" className="mt-auto flex h-[56px] w-full shrink-0 items-center justify-center rounded-xl bg-surface-muted text-lg font-bold text-fg-strong hover:bg-surface-cell">
          편집
        </button>
      </aside>
    </>
  );
}
