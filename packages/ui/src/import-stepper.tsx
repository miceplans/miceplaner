import type { ReactNode } from 'react';

const STEPS = ['업로드', '시트 선택', '컬럼 매핑', '미리보기', '완료'] as const;
/**
 * Excel 가져오기 5단계 스테퍼. 넓은 화면에서는 757px까지, 좁은 화면에서는
 * 각 단계를 같은 폭으로 나눠 가로 넘침 없이 표시한다.
 * `current`는 1부터 시작하는 진행 단계이며, 그보다 앞선 단계는 완료(체크)로 표시한다.
 */
export function ImportStepper({ current = 2 }: { current?: 1 | 2 | 3 | 4 | 5 }): ReactNode {
  return (
    <ol className="m-0 flex w-full max-w-[757px] list-none items-start p-0" aria-label="가져오기 단계">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-[4px] text-center first:flex-none first:items-start last:flex-none last:items-end"
          >
            {i > 0 ? <span aria-hidden className={`absolute top-[11px] right-1/2 left-[-50%] h-[2px] ${i < current ? 'bg-brand' : 'bg-border-placeholder'}`} /> : null}
            <span
              className={`relative z-10 flex size-[24px] shrink-0 items-center justify-center rounded-full text-2xs font-semibold ${
                done || active ? 'bg-brand text-fg-inverse' : 'border border-solid border-border-placeholder bg-surface text-fg-secondary'
              }`}
            >
              {done ? <img alt="" src="/assets/import/check.svg" className="size-[12px]" /> : n}
            </span>
            <span
              className={`max-w-full break-keep text-sm leading-[1.25] ${
                active ? 'font-semibold text-fg' : done ? 'text-fg' : 'text-fg-secondary'
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
