'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button, StatusPill, toast } from '@miceplans/ui';
import { useImportExecute, useImportGet } from '../../../lib/api/generated/endpoints';
import { ApiError } from '../../../lib/api';

function Cell({ w, className = '', children }: { w?: number; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex h-full items-center px-[8px] ${w ? 'shrink-0' : 'min-w-px flex-1'} ${className}`} style={w ? { width: w } : undefined}>
      {children}
    </div>
  );
}

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

const EVENT_STATUSES = ['진행중', '성공', '확인중', '만료', '제출', '보류중'] as const;
const asStatus = (s: string): (typeof EVENT_STATUSES)[number] => EVENT_STATUSES.find((x) => x === s) ?? '진행중';

export function PreviewClient() {
  const router = useRouter();
  const jobId = useSearchParams().get('job') ?? '';
  const job = useImportGet(jobId, { query: { enabled: jobId !== '' } });
  const execute = useImportExecute();

  if (!jobId || job.isError) {
    return (
      <div className="flex w-full flex-col items-start gap-[16px] rounded-lg bg-surface p-[24px] shadow-card">
        <p className="m-0 text-base text-fg">{!jobId ? '먼저 파일을 업로드해 주세요.' : '가져오기 작업을 찾을 수 없습니다.'}</p>
        <Button variant="secondary" href="/import/upload">파일 업로드로 돌아가기</Button>
      </div>
    );
  }
  if (job.isPending || !job.data) {
    return <div className="flex h-[296px] w-full items-center justify-center rounded-lg bg-surface text-base text-fg-secondary shadow-card">불러오는 중…</div>;
  }
  const data = job.data;
  const validation = data.validation;
  if (!validation) {
    return (
      <div className="flex w-full flex-col items-start gap-[16px] rounded-lg bg-surface p-[24px] shadow-card">
        <p className="m-0 text-base text-fg">컬럼 매핑을 먼저 저장해 주세요.</p>
        <Button variant="secondary" href={`/import/mapping?job=${jobId}`}>매핑으로 돌아가기</Button>
      </div>
    );
  }

  const start = async () => {
    try {
      await execute.mutateAsync({ id: jobId });
      router.push(`/import/done?job=${jobId}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : '[500] 가져오기 실행에 실패했습니다.');
    }
  };

  return (
    <div className="flex w-full flex-col items-start gap-[28px]">
      <div className="flex w-full flex-col items-start gap-[8px]">
        <p className="m-0 text-base whitespace-nowrap text-fg">
          총 <b>{validation.total}</b>행 중 <b className="text-brand">{validation.valid}</b>행을 가져옵니다
          {validation.invalid > 0 && <span className="text-fg-secondary"> · {validation.invalid}행 실패 (아래 표의 비고 참고)</span>}
        </p>
        {validation.truncated && <p className="m-0 text-xs text-fg-tertiary">표는 처음 50행까지만 보여 줍니다.</p>}
      </div>
      <div className="flex w-full flex-col items-start rounded-lg bg-surface p-[24px] shadow-card">
        <div className="flex w-full flex-col items-start" role="table" aria-label="가져오기 미리보기">
          <div role="row" className="flex h-[32px] w-full items-start border-b border-solid border-border bg-surface">
            {COLS.map((c) => (
              <Cell key={c.label} w={c.w} className="text-2xs font-medium whitespace-nowrap text-fg-secondary">
                {c.label}
              </Cell>
            ))}
          </div>
          {validation.rows.map((r, i) => (
            <div
              key={r.row}
              role="row"
              className={`flex h-[38px] w-full items-start border-x border-b border-solid border-border-soft text-xs whitespace-nowrap ${
                i === validation.rows.length - 1 ? 'rounded-b-md' : ''
              } ${r.ok ? 'bg-surface' : 'bg-surface-sunken'}`}
            >
              <Cell w={168} className="text-fg">{r.name || '—'}</Cell>
              <Cell w={62} className="text-fg-secondary">{r.startDate || '—'}</Cell>
              <Cell w={62} className="text-fg-secondary">{r.endDate || '—'}</Cell>
              <Cell w={104} className="text-fg">{r.client || '—'}</Cell>
              <Cell w={62} className="text-fg">{r.pm || '—'}</Cell>
              <Cell w={90}>
                <StatusPill status={asStatus(r.status)} />
              </Cell>
              <Cell className="text-fg">{r.place || '—'}</Cell>
              <Cell w={52} className="text-fg-tertiary" >
                <span title={r.issues.join('\n')}>{r.ok ? '-' : '실패'}</span>
              </Cell>
            </div>
          ))}
        </div>
      </div>
      <div className="flex h-[64px] w-full shrink-0 items-center justify-between py-[16px]">
        <Button variant="secondary" href={`/import/mapping?job=${jobId}`}>취소</Button>
        <Button variant="primary" disabled={execute.isPending || validation.valid === 0} onClick={() => void start()}>
          {execute.isPending ? '가져오는 중…' : validation.valid === 0 ? '가져올 수 있는 행이 없음' : '가져오기 시작'}
        </Button>
      </div>
    </div>
  );
}
