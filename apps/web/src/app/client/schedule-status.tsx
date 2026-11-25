import type { ReactNode } from 'react';
import { ClientIcon, StatusTag } from '@miceplans/ui';
import type { ScheduleState } from './portal';

const A = '/assets/client';

/** 포털 일정 상태 필. Figma 상태 태그(200:17892)의 성공·진행중·확인중 톤을 완료·진행중·예정에 쓴다. */
export function ScheduleStatus({ state }: { state: ScheduleState }): ReactNode {
  if (state === '완료') {
    return <StatusTag status="success" label="완료" icon={<img alt="" src={`${A}/dashboard/vector.svg`} className="size-[14.333px]" />} />;
  }
  if (state === '진행중') {
    // 원 아이콘은 선 두께만큼 12px 자리 밖으로 나간다(Figma inset -5.83%).
    return <StatusTag status="progress" icon={<img alt="" src={`${A}/dashboard/ellipse24.svg`} className="m-[-0.7px] size-[13.4px] max-w-none" />} />;
  }
  return <StatusTag status="review" label="예정" icon={<ClientIcon src={`${A}/shared/calendar.svg`} className="size-[13px] text-warning" />} />;
}
