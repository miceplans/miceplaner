'use client';

import { countLeaves, type CheckItem, type Progress } from './event-checklist';

type Leaf = { done: boolean; late: boolean; owner?: string };

function leavesOf(items: CheckItem[], inheritedOwner?: string, inheritedLate = false): Leaf[] {
  return items.flatMap((item) => {
    const owner = item.owner ?? inheritedOwner;
    const late = item.late ?? inheritedLate;
    return item.children?.length ? leavesOf(item.children, owner, late) : [{ done: item.done, late, owner }];
  });
}

const CARD = 'rounded-xl border border-solid border-border-soft bg-surface p-[16px]';

function Kpi({ label, value, caption, tone = 'text-fg' }: { label: string; value: string; caption: string; tone?: string }) {
  return (
    <div className={CARD}>
      <p className="m-0 text-sm text-fg-secondary">{label}</p>
      <p className={`m-0 mt-[4px] text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="m-0 mt-[2px] text-xs text-fg-tertiary">{caption}</p>
    </div>
  );
}

function Bar({ label, done, total, color = 'bg-success-solid' }: { label: string; done: number; total: number; color?: string }) {
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div className="flex items-center gap-[10px]">
      <span className="w-[96px] shrink-0 truncate text-sm text-fg">{label}</span>
      <div className="h-[8px] min-w-0 flex-1 overflow-hidden rounded-full bg-surface-chip">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-[34px] shrink-0 text-right text-xs tabular-nums text-fg-secondary">{done}/{total}</span>
    </div>
  );
}

export function EventStats({ schedule, tasks }: { schedule: CheckItem[]; tasks: CheckItem[] }) {
  const sp: Progress = countLeaves(schedule);
  const tp: Progress = countLeaves(tasks);
  const all = [...leavesOf(schedule), ...leavesOf(tasks)];
  const total = all.length;
  const done = all.filter((l) => l.done).length;
  const late = all.filter((l) => !l.done && l.late).length;
  const open = total - done - late;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const owners = new Map<string, Progress>();
  for (const l of all) {
    const key = l.owner ?? '미지정';
    const cur = owners.get(key) ?? { done: 0, total: 0 };
    owners.set(key, { done: cur.done + (l.done ? 1 : 0), total: cur.total + 1 });
  }

  const doneDeg = total ? (done / total) * 360 : 0;
  const lateDeg = total ? (late / total) * 360 : 0;
  const donut = `conic-gradient(var(--color-success-solid) 0deg ${doneDeg}deg, var(--color-error-brand) ${doneDeg}deg ${doneDeg + lateDeg}deg, var(--color-surface-chip) ${doneDeg + lateDeg}deg 360deg)`;

  return (
    <div className="flex w-full flex-col gap-[16px] py-[16px]">
      <div className="grid grid-cols-4 gap-[12px] max-lg:grid-cols-2 max-sm:grid-cols-1">
        <Kpi label="전체 진행률" value={`${pct}%`} caption={`${done}/${total} 항목 완료`} />
        <Kpi label="스케줄" value={`${sp.done}/${sp.total}`} caption="완료 / 전체" />
        <Kpi label="할 일" value={`${tp.done}/${tp.total}`} caption="완료 / 전체" />
        <Kpi label="지연" value={`${late}건`} caption={late ? '확인이 필요해요' : '지연된 항목이 없어요'} tone={late ? 'text-error-delay' : 'text-fg'} />
      </div>

      <div className="grid grid-cols-3 gap-[12px] max-lg:grid-cols-1">
        <section className={CARD}>
          <h3 className="m-0 mb-[14px] text-base font-semibold text-fg">상태 분포</h3>
          <div className="flex items-center gap-[20px]">
            <div className="relative size-[120px] shrink-0 rounded-full" style={{ background: donut }} role="img" aria-label={`완료 ${done}, 지연 ${late}, 진행 예정 ${open}`}>
              <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-surface">
                <span className="text-xl font-bold tabular-nums text-fg">{pct}%</span>
                <span className="text-2xs text-fg-tertiary">완료</span>
              </div>
            </div>
            <ul className="m-0 flex list-none flex-col gap-[8px] p-0 text-sm">
              <li className="flex items-center gap-[8px]"><span className="size-[8px] rounded-full bg-success-solid" />완료 <b className="tabular-nums">{done}</b></li>
              <li className="flex items-center gap-[8px]"><span className="size-[8px] rounded-full bg-error-brand" />지연 <b className="tabular-nums">{late}</b></li>
              <li className="flex items-center gap-[8px]"><span className="size-[8px] rounded-full bg-surface-chip ring-1 ring-inset ring-border" />예정 <b className="tabular-nums">{open}</b></li>
            </ul>
          </div>
        </section>

        <section className={CARD}>
          <h3 className="m-0 mb-[14px] text-base font-semibold text-fg">담당자별 진행</h3>
          <div className="flex flex-col gap-[10px]">
            {[...owners.entries()].map(([name, p]) => (
              <Bar key={name} label={name} done={p.done} total={p.total} color="bg-brand" />
            ))}
          </div>
        </section>

        <section className={CARD}>
          <h3 className="m-0 mb-[14px] text-base font-semibold text-fg">할 일 항목별</h3>
          <div className="flex flex-col gap-[10px]">
            {tasks.map((t) => {
              const p = countLeaves([t]);
              return <Bar key={t.id} label={t.title} done={p.done} total={p.total} />;
            })}
          </div>
        </section>
      </div>

      <section className={CARD}>
        <h3 className="m-0 mb-[14px] text-base font-semibold text-fg">스케줄별 진행</h3>
        <div className="grid grid-cols-2 gap-x-[32px] gap-y-[10px] max-md:grid-cols-1">
          {schedule.map((s) => {
            const p = countLeaves([s]);
            return <Bar key={s.id} label={s.title} done={p.done} total={p.total} color={s.late && !s.done ? 'bg-error-brand' : 'bg-success-solid'} />;
          })}
        </div>
      </section>
    </div>
  );
}
