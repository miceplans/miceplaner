'use client';

import { useState } from 'react';

const A = '/assets/task-board';

type Avatar = '한' | '최' | '박' | '이' | '김';
const AVATAR: Record<Avatar, string> = {
  한: 'bg-notice-bg text-notice',
  최: 'bg-success-bg text-success-deep',
  박: 'bg-info-bg text-brand-blue',
  이: 'bg-surface-chip text-fg-secondary',
  김: 'bg-submit-bg text-brand-soft',
};

type Task = { event: string; schedule: string; title: string; due: string; late?: boolean; who: Avatar };
type Column = { name: string; dot: string; done?: boolean; tasks: Task[] };

const COLUMNS: Column[] = [
  {
    name: '할 일',
    dot: 'dot-todo',
    tasks: [
      { event: 'KIMES', schedule: '브로슈어 인쇄', title: '브로슈어 인쇄 견적 3사 비교', due: '03.04', late: true, who: '한' },
      { event: 'KIMES', schedule: '리허설', title: '리허설 장비 체크리스트 작성', due: '03.10', who: '최' },
      { event: 'KIMES', schedule: '행사 당일 운영', title: '스태프 배치도 초안', due: '03.08', who: '박' },
      { event: '파트너스 데이', schedule: '초청장 발송', title: '파트너스 데이 초청 명단 확정', due: '04.01', who: '이' },
    ],
  },
  {
    name: '진행 중',
    dot: 'dot-progress',
    tasks: [
      { event: 'KIMES', schedule: '디자인 승인', title: 'KIMES 부스 3D 렌더링 수정', due: '03.05', late: true, who: '박' },
      { event: 'AI 서밋', schedule: '홈페이지 오픈', title: 'AI서밋 등록 폼 API 연동', due: '03.12', who: '김' },
      { event: 'KIMES', schedule: '초청장 발송', title: '초청장 수신처 리스트 정리', due: '03.02', who: '최' },
    ],
  },
  {
    name: '검토 대기',
    dot: 'dot-review',
    tasks: [
      { event: 'KIMES', schedule: '디자인 승인', title: 'KIMES 메인 키비주얼 v3', due: '03.05', who: '박' },
      { event: 'AI 서밋', schedule: '홈페이지 오픈', title: 'AI서밋 발표 자료 템플릿', due: '03.09', who: '김' },
    ],
  },
  {
    name: '완료',
    dot: 'dot-done',
    done: true,
    tasks: [
      { event: 'KIMES', schedule: '홈페이지 오픈', title: 'KIMES 홈페이지 워크플로우 설정', due: '02.20', who: '박' },
      { event: 'KIMES', schedule: '초청장 발송', title: '초청장 디자인 시안 1안', due: '02.26', who: '최' },
      { event: 'KIMES', schedule: '리허설', title: '행사장 실사 예약', due: '02.28', who: '한' },
    ],
  },
];

const TABS = [
  { key: 'board', label: 'Board', icon: 'tab-board' },
  { key: 'list', label: 'List', icon: 'tab-list' },
  { key: 'mine', label: '내 Tasks', icon: 'tab-mine' },
] as const;

function TaskCard({ task, done }: { task: Task; done?: boolean }) {
  return (
    <article className="flex h-[100px] w-full shrink-0 flex-col items-start gap-[8px] rounded-md bg-surface p-[12px]">
      <div className="flex items-start gap-[6px]">
        <span className="flex h-[20px] items-center justify-center rounded-xs bg-brand-tint px-[7px] text-2xs font-medium whitespace-nowrap text-brand">
          {task.event}
        </span>
        <span className="flex h-[20px] items-center justify-center rounded-xs bg-surface-chip px-[7px] text-2xs whitespace-nowrap text-fg-secondary">
          {task.schedule}
        </span>
      </div>
      <p className={`min-w-full text-base font-medium leading-[1.35] ${done ? 'text-fg-secondary' : 'text-fg'}`}>{task.title}</p>
      <div className="flex w-full items-center gap-[6px]">
        <img alt="" src={`${A}/${task.late ? 'due-late' : 'due'}.svg`} className="size-[12px]" />
        <span className={`text-xs whitespace-nowrap ${task.late ? 'text-error-delay' : 'text-fg-secondary'}`}>{task.due}</span>
        {task.late ? <span className="text-2xs font-medium whitespace-nowrap text-error-delay">지연</span> : null}
        <div className="h-px min-w-px flex-1" />
        <span className={`flex size-[22px] items-center justify-center rounded-lg text-2xs font-semibold ${AVATAR[task.who]}`}>
          {task.who}
        </span>
      </div>
    </article>
  );
}

export function TaskBoard() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('board');
  const tasks = COLUMNS.flatMap((column) => column.tasks.map((task) => ({ ...task, column: column.name, done: column.done })));
  const visibleTasks = tab === 'mine' ? tasks.filter((task) => task.who === '박') : tasks;
  return (
    <>
      <div role="tablist" className="flex h-[52px] w-full shrink-0 items-center overflow-x-auto border-b border-solid border-border px-[24px] max-md:px-[8px]">
        <div className="flex h-full min-w-max items-start gap-[2px]">
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className={`flex h-full items-center gap-[7px] px-[12px] text-base whitespace-nowrap ${
                  on ? 'border-b-2 border-solid border-brand font-medium text-brand' : 'text-fg-secondary hover:text-fg'
                }`}
              >
                <img alt="" src={`${A}/${t.icon}.svg`} className="size-[15px]" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      {tab === 'board' ? (
        <div className="flex flex-1 items-stretch gap-[16px] overflow-x-auto p-[24px] max-md:p-[12px]">
          {COLUMNS.map((c) => (
          <section key={c.name} className="flex w-[276px] shrink-0 flex-col items-start gap-[10px] rounded-lg bg-surface-sidebar p-[10px]">
            <div className="flex h-[26px] w-full items-center gap-[7px]">
              <img alt="" src={`${A}/${c.dot}.svg`} className="size-[8px]" />
              <h2 className="m-0 text-base font-semibold whitespace-nowrap text-fg">{c.name}</h2>
              <span className="flex h-[18px] items-center justify-center rounded-md bg-border-strong px-[6px] text-2xs font-medium text-fg-secondary">
                {c.tasks.length}
              </span>
              <div className="h-px min-w-px flex-1" />
              <button type="button" aria-label={`${c.name} 카드 추가`} className="flex shrink-0">
                <img alt="" src={`${A}/add.svg`} className="size-[14px]" />
              </button>
            </div>
            {c.tasks.map((t) => (
              <TaskCard key={t.title} task={t} done={c.done} />
            ))}
            <button type="button" className="flex h-[32px] w-full items-center gap-[6px] px-[4px] text-sm whitespace-nowrap text-fg-tertiary">
              <img alt="" src={`${A}/add.svg`} className="size-[14px]" />
              추가
            </button>
          </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-[8px] p-[24px] max-md:p-[12px]" role="tabpanel">
          <p className="text-base text-fg-secondary">{tab === 'mine' ? '내가 담당한 Tasks' : '모든 Tasks'}</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <div className="min-w-[680px]">
              {visibleTasks.map((task) => (
                <div key={task.title} className="flex min-h-[56px] items-center gap-[16px] border-b border-border px-[16px] text-base last:border-b-0">
                  <span className="w-[100px] shrink-0 text-fg-secondary">{task.column}</span>
                  <span className="min-w-0 flex-1 font-medium text-fg">{task.title}</span>
                  <span className="w-[100px] shrink-0 text-fg-secondary">{task.due}</span>
                  <span className={`flex size-[22px] shrink-0 items-center justify-center rounded-lg text-2xs font-semibold ${AVATAR[task.who]}`}>{task.who}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
