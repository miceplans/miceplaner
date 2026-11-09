import { Button, FlowTopbar, ImportStepper, PageFrame, StatusPill } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';

const A = '/assets/import';

type Status = '진행중' | '성공';
const ROWS: { name: string; start: string; end: string; client: string; pm: string; status: Status; place: string }[] = [
  { name: '제54회 KIMES 2025', start: '03.13', end: '03.16', client: '메디코리아', pm: '박서연', status: '진행중', place: '코엑스 Hall A·B' },
  { name: '글로벌 AI 서밋 2025', start: '04.02', end: '04.03', client: '테크노웨이', pm: '김도현', status: '성공', place: '인터컨티넨탈' },
  { name: '서울 ESG 포럼 2025', start: '06.05', end: '06.06', client: '그린퓨처', pm: '정유나', status: '진행중', place: '포시즌스 호텔' },
  { name: '제12회 프랜차이즈 엑스포', start: '05.08', end: '05.10', client: '프랜차이즈협회', pm: '정유나', status: '진행중', place: '일산 킨텍스' },
  { name: '로진컴퍼니 킥오프', start: '07.11', end: '07.12', client: '로진컴퍼니', pm: '박서연', status: '진행중', place: '제주 신화월드' },
];
// 열 너비(px). 장소는 남는 폭.
const COLS: { label: string; w?: number }[] = [
  { label: '행사명', w: 168 },
  { label: '시작', w: 62 },
  { label: '끝', w: 62 },
  { label: 'Client', w: 104 },
  { label: 'PM', w: 62 },
  { label: '상태', w: 90 },
  { label: '장소' },
  { label: '비고', w: 52 },
];

function Cell({ w, className = '', children }: { w?: number; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex h-full items-center px-[8px] ${w ? 'shrink-0' : 'min-w-px flex-1'} ${className}`} style={w ? { width: w } : undefined}>
      {children}
    </div>
  );
}

export default function ImportPreviewPage() {
  return (
    <AppShell active="events">
      <PageFrame
        topbar={<FlowTopbar showToggle showKbd={false} breadcrumb={['행사', 'Excel 가져오기']} />}
        fab={
          <div className="absolute top-[782px] left-[1134.5px] flex h-[60.328px] w-[59.594px] items-center justify-center">
            <div className="flex-none rotate-[-62.45deg]">
              <div className="flex items-center">
                <div className="flex h-[43.577px] w-[45.31px] shrink-0 items-center justify-center">
                  <div className="flex-none rotate-[-117.55deg]">
                    <div className="relative h-[34.985px] w-[30.899px]">
                      <div className="absolute inset-[0_-25.71%_-12.93%_0]">
                        <img alt="AI 채팅" src={`${A}/group15.svg`} className="block size-full max-w-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
        mainClassName="items-center"
      >
        <div className="flex shrink-0 flex-col items-start gap-[168px]">
          <div className="flex w-[760px] flex-col items-start py-[60px]">
            <h1 className="m-0 w-[209px] text-xl font-bold whitespace-nowrap text-fg">Excel에서 행사 가져오기</h1>
            <div className="flex flex-col items-start gap-[28px]">
              <ImportStepper current={4} />
              <div className="flex h-[296px] w-[760px] flex-col items-start rounded-lg bg-surface p-[24px] shadow-card">
                <div className="flex w-full flex-col items-start" role="table" aria-label="가져오기 미리보기">
                  <div role="row" className="flex h-[32px] w-full items-start border-b border-solid border-border bg-surface">
                    {COLS.map((c) => (
                      <Cell key={c.label} w={c.w} className="text-2xs font-medium whitespace-nowrap text-fg-secondary">
                        {c.label}
                      </Cell>
                    ))}
                  </div>
                  {ROWS.map((r, i) => (
                    <div
                      key={r.name}
                      role="row"
                      className={`flex h-[38px] w-full items-start border-x border-b border-solid border-border-soft bg-surface text-xs whitespace-nowrap ${
                        i === ROWS.length - 1 ? 'rounded-b-md' : ''
                      }`}
                    >
                      <Cell w={168} className="text-fg">{r.name}</Cell>
                      <Cell w={62} className="text-fg-secondary">{r.start}</Cell>
                      <Cell w={62} className="text-fg-secondary">{r.end}</Cell>
                      <Cell w={104} className="text-fg">{r.client}</Cell>
                      <Cell w={62} className="text-fg">{r.pm}</Cell>
                      <Cell w={90}>
                        <StatusPill status={r.status} />
                      </Cell>
                      <Cell className="text-fg">{r.place}</Cell>
                      <Cell w={52} className="text-fg-tertiary">-</Cell>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex w-[760px] items-center justify-between py-[16px]">
            <Button variant="secondary" href="/import/mapping">취소</Button>
            <Button variant="primary" href="/import/done">
              가져오기 시작
            </Button>
          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}
