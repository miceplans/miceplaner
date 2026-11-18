'use client';

import { useEffect, useState } from 'react';
import type { PortalEventDto, PortalProgramDto } from '@miceplans/contracts/portal';
import { listPortalEvents, listPortalPrograms } from '../../lib/api';

export type PortalData = {
  events: PortalEventDto[] | null;
  programs: PortalProgramDto[] | null;
  /** 조회 실패 메시지. 실패를 "지정된 행사 없음"으로 오인하지 않도록 빈 목록과 구분한다. */
  error: string | null;
};

const message = (e: unknown): string => (e instanceof Error && e.message ? e.message : '포털 데이터를 불러오지 못했습니다.');

/** 지정된 행사와 공개 Program 일정을 함께 조회한다 (명세 F-07). */
export function usePortalData(): PortalData {
  const [events, setEvents] = useState<PortalEventDto[] | null>(null);
  const [programs, setPrograms] = useState<PortalProgramDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fail = (e: unknown) => {
      if (alive) setError((prev) => prev ?? message(e));
    };
    listPortalEvents().then((rows) => { if (alive) setEvents(rows); }).catch((e: unknown) => { fail(e); if (alive) setEvents([]); });
    listPortalPrograms().then((rows) => { if (alive) setPrograms(rows); }).catch((e: unknown) => { fail(e); if (alive) setPrograms([]); });
    return () => { alive = false; };
  }, []);

  return { events, programs, error };
}

/** 행사 상세 주소. 정적 export라 행사 UUID별 경로를 미리 만들 수 없어 쿼리로 넘긴다. */
export const eventDetailHref = (eventId: string): string => `/client/events/detail?id=${encodeURIComponent(eventId)}`;
