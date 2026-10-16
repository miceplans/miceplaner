import type { ReactNode } from 'react';
import type { StatusToneKey } from './tokens';
import { statusTones } from './tokens';

/** 상태 필(알약). Figma 표준: px 8·py 5·rounded-sm, 라벨 Pretendard 12/700. 아이콘은 호출측 슬롯으로 전달한다. */
export function StatusTag({ status, icon }: { status: StatusToneKey; icon?: ReactNode }): ReactNode {
  const tone = statusTones[status];
  return (
    <span
      className="flex h-[24px] shrink-0 items-center gap-[4px] rounded-sm px-[8px]"
      style={{ background: tone.bg }}
    >
      {icon}
      <span className="whitespace-nowrap text-xs font-bold" style={{ color: tone.fg }}>
        {tone.label}
      </span>
    </span>
  );
}
