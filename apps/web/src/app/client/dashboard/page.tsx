import { ClientHeader, ClientStatusPill, type PrepStatus } from '@miceplans/ui';

const A = '/assets/client/dashboard';

const PREP: { name: string; status: PrepStatus }[] = [
  { name: '홈페이지 오픈', status: '성공' },
  { name: '초청장 발송', status: '진행중' },
  { name: '브로슈어 인쇄', status: '확인중' },
  { name: '브로슈어 인쇄', status: '확인중' },
];

const SCHEDULES = [
  { date: '3/10', title: '견적 안건 협의 미팅', meta: '14:00 · 코엑스 사무실 3F 회의실', dday: 'D-5', hot: true },
  { date: '3/10', title: '견적 안건 협의 미팅', meta: '14:00 · 코엑스 사무실 3F 회의실', dday: 'D-7', hot: false },
  { date: '3/10', title: '견적 안건 협의 미팅', meta: '14:00 · 코엑스 사무실 3F 회의실', dday: 'D-7', hot: false },
];

const STEPS = [
  { label: '입찰', state: 'done' },
  { label: '업로드', state: 'current', n: 2 },
  { label: '업로드', state: 'todo', n: 3 },
  { label: '업로드', state: 'todo', n: 3 },
  { label: '업로드', state: 'todo', n: 3 },
] as const;

const CONTACTS = [
  { name: '박서연', role: 'PM' },
  { name: '최민준', role: 'AM' },
];

const MEMOS = [
  { text: '최종 견적서 안내드렸습니다 — 검토 후 회신 부탁드립니다', by: '최민준 / 03.29', fresh: true },
  { text: '초청장 디자인 시안 2안 업로드되었습니다', by: '최민준 / 03.29', fresh: false },
  { text: '3월 둘째 주 주간 일정 안내', by: '최민준 / 03.29', fresh: false },
];

export default function ClientDashboardPage() {
  return (
    <div className="flex min-h-[860px] w-full min-w-[1440px] flex-col bg-surface-sunken">
      <ClientHeader active="dashboard" />
      <main className="flex min-h-px flex-1 items-start px-[40px] pb-[36px] pt-[40px]">
        <div className="flex w-[1361px] flex-col items-center gap-[22px]">
          <div className="flex w-full items-center gap-[22px]">
            <a
              href="/client/events"
              className="flex h-[260px] w-[575px] shrink-0 flex-col items-end justify-between rounded-2xl bg-brand-pink px-[53.077px] py-[35.385px]"
            >
              <p className="w-full text-3xl font-semibold text-fg-inverse">제54회 KIMES 2026</p>
              <div className="flex items-center gap-[8px]">
                <p className="whitespace-nowrap text-2xl font-semibold text-fg-inverse">바로가기</p>
                <img alt="" src={`${A}/frame133.svg`} className="size-[31.096px]" />
              </div>
            </a>

            <section className="flex h-[260px] w-[371px] shrink-0 flex-col items-start justify-between rounded-2xl bg-surface p-[24px]">
              <div className="flex items-center gap-[8px]">
                <h2 className="whitespace-nowrap text-xl font-bold text-fg">준비 항목 현황</h2>
                <a href="/client/events" className="flex items-center gap-[4px] py-[4px]">
                  <span className="whitespace-nowrap text-2xs font-medium text-brand">전체 보기</span>
                  <img alt="" src={`${A}/chevron-right.svg`} className="size-[12px]" />
                </a>
              </div>
              <ul className="flex w-full flex-col gap-[2px]">
                {PREP.map((p, i) => (
                  <li key={i} className="flex h-[36px] w-full items-center justify-between">
                    <p className="w-[100px] text-sm text-fg">{p.name}</p>
                    <ClientStatusPill status={p.status} />
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex h-[260px] w-[371px] shrink-0 flex-col items-start justify-between rounded-2xl bg-surface p-[24px]">
              <h2 className="whitespace-nowrap text-xl font-bold text-fg">전달받은 메모</h2>
              <ul className="flex w-full flex-col gap-[4px]">
                {SCHEDULES.map((s, i) => (
                  <li key={i} className="flex h-[44px] w-full items-center gap-[12px]">
                    <p className="whitespace-nowrap text-lg font-semibold text-fg">{s.date}</p>
                    <div className="flex min-w-px flex-1 flex-col gap-[2px] whitespace-nowrap">
                      <p className="text-sm text-fg">{s.title}</p>
                      <p className="text-2xs text-fg-tertiary">{s.meta}</p>
                    </div>
                    <span
                      className={`flex h-[22px] shrink-0 items-center justify-center rounded-lg px-[9px] text-2xs font-semibold ${s.hot ? 'bg-brand text-fg-inverse' : 'bg-brand-tint text-brand'}`}
                    >
                      {s.dday}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="flex w-[1347px] items-center gap-[22px]">
            <section className="flex h-[438px] w-[959px] shrink-0 flex-col items-start gap-[18.781px] rounded-2xl bg-surface px-[37.562px] py-[21.911px]">
              <h2 className="whitespace-nowrap text-3xl font-semibold text-fg">행사 진행 단계</h2>
              <div className="flex h-[68.864px] shrink-0 flex-col items-center">
                <div className="flex w-[763px] items-center">
                  {STEPS.map((s, i) => (
                    <div key={i} className="contents">
                      {i > 0 ? (
                        <div className={`h-[3.13px] min-w-px flex-1 rounded-xs ${i === 1 ? 'bg-brand' : 'bg-border-placeholder'}`} />
                      ) : null}
                      <div className="flex size-[37.562px] shrink-0 flex-col items-center gap-[6.26px]">
                        <div
                          className={`flex size-[37.562px] shrink-0 items-center justify-center rounded-2xl ${
                            s.state === 'todo' ? 'border-[1.565px] border-solid border-border-placeholder bg-surface' : 'bg-brand'
                          }`}
                        >
                          {s.state === 'done' ? (
                            <img alt="" src={`${A}/check.svg`} className="size-[18.781px]" />
                          ) : (
                            <p
                              className={`text-lg ${s.state === 'current' ? 'font-semibold text-fg-inverse' : 'text-border-placeholder'}`}
                            >
                              {s.n}
                            </p>
                          )}
                        </div>
                        <p className="whitespace-nowrap text-xl text-fg">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative h-[178.188px] w-[324.373px] shrink-0">
                <img alt="" src={`${A}/group23.svg`} className="absolute inset-0 size-full max-w-none" />
                <p className="absolute left-[106.83px] top-[107.99px] whitespace-nowrap text-center text-3xl font-bold tracking-[1.5651px] text-fg">
                  84%
                </p>
              </div>
            </section>

            <div className="flex h-[438px] w-[371px] shrink-0 flex-col items-center gap-[22px]">
              <section className="flex h-[150px] w-full shrink-0 flex-col items-start justify-between rounded-2xl bg-surface p-[24px]">
                <h2 className="whitespace-nowrap text-xl font-bold text-fg">담당자</h2>
                <ul className="flex w-full flex-col gap-[10px]">
                  {CONTACTS.map((c) => (
                    <li key={c.name} className="flex w-full items-center gap-[10px]">
                      <div className="flex min-w-px flex-1 items-start gap-[2px] whitespace-nowrap">
                        <p className="text-md font-medium text-fg">{c.name}</p>
                        <p className="font-sans text-2xs text-fg-tertiary">{c.role}&nbsp;</p>
                      </div>
                      <img alt="전화" src={`${A}/phone.svg`} className="size-[16px]" />
                      <img alt="메일" src={`${A}/mail.svg`} className="size-[16px]" />
                    </li>
                  ))}
                </ul>
              </section>
              <section className="flex h-[260px] w-full shrink-0 flex-col items-start justify-between rounded-2xl bg-surface p-[24px]">
                <h2 className="whitespace-nowrap text-xl font-bold text-fg">나에게 온 메모</h2>
                <ul className="flex w-full flex-col">
                  {MEMOS.map((m, i) => (
                    <li
                      key={i}
                      className={`flex w-full flex-col items-start gap-[6px] rounded-xs p-[8px] ${m.fresh ? 'bg-fg-inverse/40' : 'bg-surface'}`}
                    >
                      <p className="w-full text-xs leading-[1.4] text-fg">{m.text}</p>
                      <p className="whitespace-nowrap text-2xs text-fg-tertiary">{m.by}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
