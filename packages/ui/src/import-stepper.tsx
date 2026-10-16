import type { ReactNode } from 'react';

const STEPS = ['업로드', '시트 선택', '컬럼 매핑', '미리보기', '완료'] as const;
// 디자인 좌표: 각 단계 열(24px)의 left. 커넥터는 y=21, 폭 160.
const LEFTS = [0, 181, 365, 549, 733] as const;
const CONNECTOR_LEFTS = [21, 205, 389, 573] as const;

/**
 * Excel 가져오기 5단계 스테퍼(757px).
 * `current`는 1부터 시작하는 진행 단계이며, 그보다 앞선 단계는 완료(체크)로 표시한다.
 */
export function ImportStepper({ current = 2 }: { current?: 1 | 2 | 3 | 4 | 5 }): ReactNode {
  return (
    <ol className="relative m-0 h-[69px] w-[757px] list-none p-0" aria-label="가져오기 단계">
      {CONNECTOR_LEFTS.map((left, i) => (
        <li
          key={left}
          aria-hidden
          className={`absolute top-[21px] h-[2px] w-[160px] rounded-xs ${i + 1 < current ? 'bg-brand' : 'bg-border-placeholder'}`}
          style={{ left }}
        />
      ))}
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className="absolute flex w-[24px] flex-col items-center"
            style={{ left: LEFTS[i], top: active ? 0 : 10, gap: active ? 10 : done ? 4 : 12, paddingTop: active ? 10 : 0 }}
          >
            <span
              className={`flex size-[24px] shrink-0 items-center justify-center rounded-full text-2xs font-semibold ${
                done || active ? 'bg-brand text-fg-inverse' : 'border border-solid border-border-placeholder bg-surface text-fg-secondary'
              }`}
            >
              {done ? <img alt="" src="/assets/import/check.svg" className="size-[12px]" /> : n}
            </span>
            <span
              className={`whitespace-nowrap text-sm ${
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
