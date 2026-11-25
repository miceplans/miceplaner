'use client';

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@miceplans/ui';
import { ApiError, getToken } from '../../lib/api';
import { getLeaveWeekendWorkQueryKey, useLeaveSetWeekendWork, useLeaveWeekendWork } from '../../lib/api/generated/endpoints';

/** 서버가 준 사유를 그대로 보여 주되, 중복 신청처럼 DB 원문이 오는 경우만 바꾼다. */
export function leaveErrorText(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  return error.status === 409 && error.message.includes('duplicate key') ? '[409] 이미 같은 형태로 신청한 날짜가 있습니다.' : error.message;
}

/** 휴가·주말 근무가 바뀌면 목록과 연차 현황을 함께 다시 받는다. */
export function useRefreshLeave(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('/leave') });
  }, [queryClient]);
}

/** 로그인 사용자가 직접 체크한 주말 근무 (명세 F-12). 서버에 저장하며 본인만 조회·변경한다. */
export function useWorkCheck() {
  const queryClient = useQueryClient();
  const refresh = useRefreshLeave();
  const query = useLeaveWeekendWork({ query: { enabled: getToken() !== null } });
  const save = useLeaveSetWeekendWork();
  const weekendWork = useMemo(() => query.data?.dates ?? [], [query.data]);

  const toggleWeekendWork = (date: string) => {
    // 목록을 받기 전이나 저장 중에는 체크 여부를 알 수 없어 반대로 저장할 수 있다.
    if (!query.isSuccess || save.isPending) return;
    save.mutate(
      { data: { date, worked: !weekendWork.includes(date) } },
      {
        onSuccess: (dto) => {
          queryClient.setQueryData(getLeaveWeekendWorkQueryKey(), dto);
          refresh();
        },
        onError: (error) => toast.error(leaveErrorText(error, '[500] 주말 근무를 저장하지 못했습니다.')),
      },
    );
  };

  return { weekendWork, toggleWeekendWork };
}
