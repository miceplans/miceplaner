'use client';

import type { PortalEventDto, PortalProgramDto } from '@miceplans/contracts/portal';
import { usePortalEvents, usePortalPrograms } from '../../lib/api/generated/endpoints';

export type PortalData = {
  events: PortalEventDto[] | null;
  programs: PortalProgramDto[] | null;
  /** 조회 실패 메시지. 실패를 "지정된 행사 없음"으로 오인하지 않도록 빈 목록과 구분한다. */
  error: string | null;
};

const message = (e: unknown): string => (e instanceof Error && e.message ? e.message : '포털 데이터를 불러오지 못했습니다.');

/**
 * 지정된 행사와 공개 Program 일정을 함께 조회한다 (명세 F-07).
 * TanStack Query 캐시를 써서 포털 페이지를 오갈 때 같은 요청을 반복하지 않는다.
 */
export function usePortalData(): PortalData {
  const eventsQuery = usePortalEvents();
  const programsQuery = usePortalPrograms();
  // 조회 실패는 빈 목록으로 대신해 화면이 로딩 표시에 머무르지 않게 한다.
  const events = eventsQuery.data ?? (eventsQuery.isError ? [] : null);
  const programs = programsQuery.data ?? (programsQuery.isError ? [] : null);
  const failure = eventsQuery.error ?? programsQuery.error;
  return { events, programs, error: failure ? message(failure) : null };
}

/** 행사 상세 주소. 정적 export라 행사 UUID별 경로를 미리 만들 수 없어 쿼리로 넘긴다. */
export const eventDetailHref = (eventId: string): string => `/client/events/detail?id=${encodeURIComponent(eventId)}`;
