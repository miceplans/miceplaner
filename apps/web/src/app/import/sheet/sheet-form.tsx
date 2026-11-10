'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Select, toast, Toggle } from '@miceplans/ui';
import { useImportGet, useImportParse } from '../../../lib/api/generated/endpoints';
import { ApiError } from '../../../lib/api';

const A = '/assets/import';
const HEADER_ROWS = ['1행', '2행', '3행', '4행', '5행', '6행', '7행', '8행', '9행', '10행'];

export function SheetForm() {
  const router = useRouter();
  const jobId = useSearchParams().get('job') ?? '';
  const job = useImportGet(jobId, { query: { enabled: jobId !== '' } });
  const parse = useImportParse();
  const [sheet, setSheet] = useState(0);
  const [useHeader, setUseHeader] = useState(true);
  const [row, setRow] = useState('1행');

  // 이미 선택한 시트가 있으면 그대로 보여 준다.
  useEffect(() => {
    const data = job.data;
    if (!data) return;
    const idx = data.sheets.findIndex((s) => s.name === data.sheet);
    if (idx >= 0) setSheet(idx);
    if (data.hasHeader !== null) setUseHeader(data.hasHeader);
    if (data.headerRow !== null) setRow(`${data.headerRow}행`);
  }, [job.data]);

  if (!jobId || job.isError) {
    return (
      <div className="flex w-full flex-col items-start gap-[16px] rounded-lg bg-surface p-[24px] shadow-card">
        <p className="m-0 text-base text-fg">{!jobId ? '먼저 파일을 업로드해 주세요.' : '가져오기 작업을 찾을 수 없습니다.'}</p>
        <Button variant="secondary" href="/import/upload">파일 업로드로 돌아가기</Button>
      </div>
    );
  }
  if (job.isPending || !job.data) {
    return <div className="flex h-[398px] w-full items-center justify-center rounded-lg bg-surface p-[24px] text-base text-fg-secondary shadow-card">불러오는 중…</div>;
  }

  const data = job.data;
  const submit = async () => {
    try {
      await parse.mutateAsync({ id: jobId, data: { sheet: data.sheets[sheet]?.name ?? '', hasHeader: useHeader, headerRow: Number(row.replace('행', '')) } });
      router.push(`/import/mapping?job=${jobId}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : '[500] 시트를 읽지 못했습니다.');
    }
  };

  return (
    <div className="flex w-full flex-col items-start gap-[64px]">
      <div className="flex h-[398px] w-full flex-col items-start gap-[20px] rounded-lg bg-surface p-[24px] shadow-card">
        <div className="flex h-[68px] w-full shrink-0 items-center gap-[12px] rounded-md bg-surface-subtle p-[14px]">
          <img alt="" src={`${A}/excel.png`} className="h-[26.648px] w-[25.899px] shrink-0 object-cover" />
          <div className="flex flex-col items-start gap-[2px] whitespace-nowrap">
            <p className="m-0 text-md font-semibold text-fg">{data.fileName}</p>
            <p className="m-0 text-xs text-fg-secondary">시트 {data.sheets.length}개</p>
          </div>
        </div>
        <div className="flex w-full flex-col items-start gap-[12px]">
          <p className="m-0 text-base font-semibold whitespace-nowrap text-fg">시트 선택</p>
          <div role="radiogroup" aria-label="시트 선택" className="flex w-full flex-col items-start gap-[4px]">
            {data.sheets.map((s, i) => {
              const on = i === sheet;
              return (
                <button
                  key={s.name}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSheet(i)}
                  className={`flex h-[52px] w-full items-center gap-[12px] rounded-md px-[14px] py-[8px] text-left ${on ? 'bg-brand-tint' : 'bg-surface-subtle'}`}
                >
                  {on ? (
                    <img alt="" src={`${A}/radio.svg`} className="size-[18px] shrink-0" />
                  ) : (
                    <span className="size-[18px] shrink-0 rounded-md border border-solid border-border-placeholder bg-surface" />
                  )}
                  <span className="flex flex-col items-start gap-px whitespace-nowrap">
                    <span className="text-md font-medium text-fg">{s.name}</span>
                    <span className="text-xs text-fg-secondary">{s.rowCount}행</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex w-full items-center gap-[12px] py-[4px]">
          <div className="flex flex-col items-start gap-[2px] whitespace-nowrap">
            <p className="m-0 text-base font-semibold text-fg">헤더 행</p>
            <p className="m-0 text-xs text-fg-secondary">열 이름이 담긴 행을 헤더로 사용합니다</p>
          </div>
          <div className="h-px min-w-px flex-1" />
          <Toggle checked={useHeader} onChange={setUseHeader} ariaLabel="헤더 행 사용" />
          <Select
            aria-label="헤더 행"
            value={row}
            disabled={!useHeader}
            onChange={(e) => setRow(e.target.value)}
            options={HEADER_ROWS.map((r) => ({ value: r, label: r }))}
            className="shrink-0 disabled:cursor-default disabled:text-fg-tertiary"
          />
        </div>
      </div>
      <div className="flex w-full items-center gap-[8px]">
        <Button variant="secondary" href="/import/upload">취소</Button>
        <div className="h-px min-w-px flex-1" />
        <Button variant="primary" disabled={parse.isPending} onClick={() => void submit()}>
          {parse.isPending ? '읽는 중…' : '다음'}
        </Button>
      </div>
    </div>
  );
}
