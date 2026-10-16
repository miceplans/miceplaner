'use client';

import { useState } from 'react';
import { AgentFab } from '@miceplans/ui';

const A = '/assets/client-list';
const SHADOW = 'shadow-card';

type Client = {
  name: string;
  manager: string;
  phone: string;
  event: string;
  eventMeta: string;
  recent: string;
  status: '진행' | '계약 완료';
};

const CLIENTS: Client[] = [
  { name: '메디코리아', manager: '김민석 차장', phone: '02-1234-5678', event: '제54회 KIMES 2025', eventMeta: '03.13 – 03.16 · 코엑스 Hall A·B', recent: '오늘', status: '진행' },
  { name: '글로벌AI서밋 조직위', manager: '이준호 팀장', phone: '02-3456-7890', event: '글로벌 AI 서밋 2025', eventMeta: '05.21 – 05.23 · 코엑스 Hall C', recent: '어제', status: '진행' },
  { name: '삼성전자', manager: '박지연 과장', phone: '02-5678-1234', event: 'K-데모데이 2025', eventMeta: '06.05 · 역삼 사옥 1F', recent: '3일 전', status: '진행' },
  { name: '한국프랜차이즈협회', manager: '최은주 부장', phone: '02-7890-3456', event: '프랜차이즈 엑스포 2025', eventMeta: '04.02 – 04.04 · 킨텍스', recent: '5일 전', status: '계약 완료' },
  { name: '로진컴퍼니', manager: '서동현 대리', phone: '02-2468-1357', event: '브랜드 갤라 나이트', eventMeta: '11.28 · 포시즌스 서울', recent: '3주 전', status: '진행' },
];

const STATUS_STYLE: Record<Client['status'], string> = {
  진행: 'bg-ai-tint text-ai',
  '계약 완료': 'bg-success-bg text-success-deep',
};

export function ClientListView() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rows = q
    ? CLIENTS.filter((c) => [c.name, c.manager, c.event].some((v) => v.toLowerCase().includes(q)))
    : CLIENTS;

  return (
    <div className="flex min-h-[900px] w-full flex-col leading-[normal]">
      <div className="flex h-[56px] shrink-0 items-center gap-[12px] border-b border-solid border-border bg-surface px-[16px]">
        <div className="flex h-full items-center">
          <span className="whitespace-nowrap text-base font-medium text-fg">Clients</span>
        </div>
        <div className="h-px min-w-px flex-1" />
      </div>
      <div className="relative flex min-h-px flex-1 flex-col bg-surface-sunken">
        <div className="flex min-h-px flex-1 flex-col items-start gap-[16px] bg-surface px-[24px] py-[20px]">
          <div className="flex w-full items-start gap-[12px]">
            <div className={`flex h-[76px] min-w-px flex-1 items-center gap-[12px] rounded-lg bg-surface px-[14px] ${SHADOW}`}>
              <img alt="" src={`${A}/frame.svg`} className="size-[17px] shrink-0" />
              <div className="flex flex-col items-start justify-center gap-[12px] whitespace-nowrap">
                <span className="text-2xs text-fg-tertiary">현재 고객사</span>
                <div className="flex items-end gap-[5px]">
                  <span className="text-xl font-semibold leading-[97.22%] text-fg">7</span>
                  <span className="text-2xs text-brand-green">+1</span>
                </div>
              </div>
            </div>
            <div className={`flex h-[76px] min-w-px flex-1 items-center gap-[12px] rounded-lg bg-surface px-[14px] ${SHADOW}`}>
              <img alt="" src={`${A}/icon.svg`} className="size-[16px] shrink-0" />
              <div className="flex flex-col items-start gap-[3px]">
                <span className="whitespace-nowrap text-2xs text-fg-tertiary">진행 행사</span>
                <span className="whitespace-nowrap text-xl font-semibold text-fg">4</span>
              </div>
            </div>
            <div className={`flex h-[76px] min-w-px flex-1 items-center gap-[12px] rounded-lg bg-surface px-[14px] ${SHADOW}`}>
              <img alt="" src={`${A}/icon1.svg`} className="size-[16px] shrink-0" />
              <div className="flex flex-col items-start gap-[3px] whitespace-nowrap">
                <span className="text-2xs text-fg-tertiary">평균 준비율</span>
                <div className="flex items-end gap-[5px]">
                  <span className="text-xl font-semibold text-fg">68%</span>
                  <span className="text-2xs text-fg-tertiary">+3%p</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex w-full items-center justify-between bg-surface">
            <label className="flex h-[30px] w-[210px] items-center gap-[8px] rounded-md bg-surface-section px-[10px]">
              <img alt="" src={`${A}/search-icon.svg`} className="size-[13px] shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="고객사 · 담당자 검색"
                className="min-w-0 flex-1 bg-transparent text-xs text-fg outline-none placeholder:text-fg-tertiary"
              />
            </label>
            <button type="button" className="flex h-[30px] items-center gap-[6px] rounded-sm bg-ai px-[12px]">
              <img alt="" src={`${A}/plus-icon.svg`} className="size-[13px]" />
              <span className="whitespace-nowrap text-sm font-medium text-fg-inverse">고객사 추가</span>
            </button>
          </div>
          <div className="flex w-full flex-col items-start rounded-lg border border-solid border-border">
            <div className="flex h-[36px] w-full shrink-0 items-center gap-[12px] border-b border-solid border-border bg-surface-sunken px-[16px] text-2xs font-semibold tracking-[0.4px] text-fg-tertiary">
              <span className="w-[180px] shrink-0">고객사</span>
              <span className="w-[100px] shrink-0">담당자</span>
              <span className="w-[480px] shrink-0">진행 행사</span>
              <span className="whitespace-nowrap">상태</span>
              <div className="h-px w-[64px] shrink-0" />
            </div>
            {rows.map((c, i) => (
              <div
                key={c.name}
                className={`flex h-[48px] w-full shrink-0 items-center gap-[12px] px-[16px] ${i < rows.length - 1 ? 'border-b border-solid border-border' : ''}`}
              >
                <div className="flex h-full w-[180px] shrink-0 items-center">
                  <span className="whitespace-nowrap text-base font-semibold text-fg">{c.name}</span>
                </div>
                <div className="flex w-[100px] shrink-0 flex-col items-start gap-[2px] whitespace-nowrap">
                  <span className="text-xs font-medium text-fg-secondary">{c.manager}</span>
                  <span className="text-2xs text-fg-tertiary">{c.phone}</span>
                </div>
                <div className="flex h-full w-[480px] shrink-0 flex-col items-start justify-center gap-[2px] whitespace-nowrap">
                  <span className="text-sm font-medium text-fg">{c.event}</span>
                  <span className="text-2xs text-fg-tertiary">{c.eventMeta}</span>
                </div>
                <div className="flex h-full w-[100px] shrink-0 items-center gap-[12px]">
                  <span className="shrink-0 whitespace-nowrap text-xs text-fg-secondary">{c.recent}</span>
                  <div className="relative h-[22px] w-[96px] shrink-0">
                    <span className={`absolute left-0 top-0 flex h-[22px] items-center justify-center whitespace-nowrap rounded-lg px-[8px] text-2xs font-semibold ${STATUS_STYLE[c.status]}`}>
                      {c.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <AgentFab className="absolute left-[1128px] top-[772px]" />
      </div>
    </div>
  );
}
