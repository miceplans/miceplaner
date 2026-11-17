'use client';

import { useSearchParams } from 'next/navigation';
import { Button } from '@miceplans/ui';
import { useImportGet } from '../../../lib/api/generated/endpoints';

const A = '/assets/import';

const fmt = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

function IssueList({ title, items, truncated, tone }: { title: string; items: { row: number; message: string }[]; truncated: boolean; tone: 'fail' | 'warn' }) {
  const shown = items.slice(0, 5);
  return (
    <div className="flex flex-col items-start gap-[6px]">
      <p className={`m-0 font-semibold ${tone === 'fail' ? 'text-danger' : 'text-fg'}`}>
        {title} {items.length}건{truncated ? '+' : ''}
      </p>
      {shown.length === 0 ? (
        <p className="m-0 text-fg-secondary">없음</p>
      ) : (
        <div className="flex flex-col items-start gap-[6px] text-fg-secondary">
          {shown.map((f, i) => (
            <p key={i} className="m-0">{f.row}행: {f.message}</p>
          ))}
          {items.length > shown.length && <p className="m-0 text-fg-tertiary">외 {items.length - shown.length}건</p>}
        </div>
      )}
    </div>
  );
}

export function DoneView() {
  const jobId = useSearchParams().get('job') ?? '';
  const job = useImportGet(jobId, { query: { enabled: jobId !== '' } });

  if (!jobId || job.isError) {
    return (
      <div className="flex w-full flex-col items-center gap-[20px]">
        <div className="flex h-[200px] w-full flex-col items-center justify-center rounded-lg bg-surface px-[24px] shadow-card">
          <p className="m-0 text-base text-fg">{!jobId ? '먼저 파일을 업로드해 주세요.' : '가져오기 작업을 찾을 수 없습니다.'}</p>
        </div>
        <Button variant="primary" href="/import/upload">파일 업로드로 돌아가기</Button>
      </div>
    );
  }
  if (job.isPending || !job.data) {
    return <div className="flex h-[313px] w-full items-center justify-center rounded-lg bg-surface text-base text-fg-secondary shadow-card">불러오는 중…</div>;
  }

  const data = job.data;
  if (data.status === 'failed') {
    return (
      <div className="flex w-full flex-col items-center gap-[20px]">
        <div className="flex h-[313px] w-full flex-col items-center justify-center gap-[12px] rounded-lg bg-surface px-[24px] shadow-card">
          <p className="m-0 text-xl font-bold text-fg">가져오기 실패</p>
          <p className="m-0 text-base text-fg-secondary">{data.error ?? '알 수 없는 오류'}</p>
        </div>
        <Button variant="primary" href="/import/upload">다시 시도하기</Button>
      </div>
    );
  }
  const result = data.result;
  if (data.status !== 'done' || !result) {
    return (
      <div className="flex w-full flex-col items-center gap-[20px]">
        <div className="flex h-[313px] w-full items-center justify-center rounded-lg bg-surface text-base text-fg-secondary shadow-card">실행 결과가 아직 없습니다.</div>
        <Button variant="secondary" href={`/import/preview?job=${jobId}`}>미리보기로 돌아가기</Button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-[20px]">
      <div className="flex h-[313px] w-full flex-col items-center rounded-lg bg-surface px-[24px] py-[44px] shadow-card">
        <div className="flex w-[515px] flex-col items-center">
          <div className="flex flex-col items-center">
            <div className="flex size-[64px] items-center justify-center rounded-full bg-success-bg">
              <img alt="" src={`${A}/success-icon.svg`} className="size-[30px]" />
            </div>
            <div className="flex flex-col items-center gap-[6px] py-[16px] whitespace-nowrap">
              <p className="m-0 text-xl font-bold text-fg">가져오기 완료</p>
              <p className="m-0 text-base text-fg-secondary">
                {result.created.toLocaleString()}행 생성 완료 · {fmt.format(new Date(result.finishedAt))}
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-[12px] bg-surface-subtle p-[12px] text-xs whitespace-nowrap">
            <IssueList title="실패 행" items={result.failed} truncated={result.failedTruncated} tone="fail" />
            <IssueList title="유의 사항" items={result.warnings} truncated={result.warningsTruncated} tone="warn" />
          </div>
        </div>
      </div>
      <Button variant="primary" href="/">행사 보기</Button>
    </div>
  );
}
