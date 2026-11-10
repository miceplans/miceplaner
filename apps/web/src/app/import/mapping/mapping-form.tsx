'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Select, toast } from '@miceplans/ui';
import type { ImportTargetField } from '@miceplans/contracts';
import { useImportGet, useImportPreview } from '../../../lib/api/generated/endpoints';
import { ApiError } from '../../../lib/api';
import { guessMapping, TARGET_FIELDS } from '../fields';

const UNMAPPED = '';

export function MappingForm() {
  const router = useRouter();
  const jobId = useSearchParams().get('job') ?? '';
  const job = useImportGet(jobId, { query: { enabled: jobId !== '' } });
  const preview = useImportPreview();
  const [values, setValues] = useState<Record<string, ImportTargetField | ''>>({});

  const columns = job.data?.columns ?? [];

  // 컬럼을 불러오면 헤더 라벨로 매핑을 짐작해 둔다. 사용자가 고쳐서 저장한다.
  useEffect(() => {
    if (columns.length > 0 && Object.keys(values).length === 0) {
      const guessed = guessMapping(columns);
      setValues(Object.fromEntries(columns.map((c) => [String(c.index), guessed[String(c.index)] ?? UNMAPPED])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.length]);

  const used = useMemo(() => new Set(Object.values(values).filter((v): v is ImportTargetField => v !== UNMAPPED)), [values]);

  if (!jobId || job.isError) {
    return (
      <div className="flex w-full flex-col items-start gap-[16px] rounded-lg bg-surface p-[24px] shadow-card">
        <p className="m-0 text-base text-fg">{!jobId ? '먼저 파일을 업로드해 주세요.' : '가져오기 작업을 찾을 수 없습니다.'}</p>
        <Button variant="secondary" href="/import/upload">파일 업로드로 돌아가기</Button>
      </div>
    );
  }
  if (job.isPending || !job.data) {
    return <div className="flex h-[300px] w-full items-center justify-center rounded-lg bg-surface text-base text-fg-secondary shadow-card">불러오는 중…</div>;
  }
  if (job.data.status === 'uploaded' || columns.length === 0) {
    return (
      <div className="flex w-full flex-col items-start gap-[16px] rounded-lg bg-surface p-[24px] shadow-card">
        <p className="m-0 text-base text-fg">시트를 먼저 선택해 주세요.</p>
        <Button variant="secondary" href={`/import/sheet?job=${jobId}`}>시트 선택으로 돌아가기</Button>
      </div>
    );
  }

  const submit = async () => {
    const mapping = Object.fromEntries(Object.entries(values).filter(([, f]) => f !== UNMAPPED)) as Record<string, ImportTargetField>;
    try {
      await preview.mutateAsync({ id: jobId, data: { mapping } });
      router.push(`/import/preview?job=${jobId}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : '[500] 검증에 실패했습니다.');
    }
  };

  return (
    <div className="flex w-full flex-col items-start gap-[32px]">
      <div className="flex w-full flex-col items-start gap-[32px] rounded-lg bg-surface p-[24px] shadow-card">
        <p className="m-0 text-lg font-semibold whitespace-nowrap text-fg">각 열이 어떤 행사 정보인지 알려 주세요</p>
        <div className="flex w-full flex-col items-start gap-[16px]">
          <div className="flex h-[24px] w-full items-start text-xs font-medium whitespace-nowrap text-fg-secondary">
            <div className="flex w-[330px] items-center py-[8px]">Excel 컬럼</div>
            <div className="flex min-w-px flex-1 items-center py-[8px]">시스템 속성</div>
          </div>
          <div className="flex w-full flex-col items-center gap-[24px]">
            <div className="flex w-full flex-col items-start gap-[12px]">
              {columns.map((c) => (
                <div key={c.index} className="flex w-full items-center">
                  <div className="flex w-[330px] items-center gap-[10px] self-stretch">
                    <span className="flex size-[22px] items-center justify-center rounded-xs bg-surface-chip text-2xs font-medium text-fg-secondary">
                      {String.fromCharCode(65 + (c.index % 26))}
                    </span>
                    <span className="text-base whitespace-nowrap text-fg">{c.label}</span>
                  </div>
                  <Select
                    aria-label={`${c.label} 매핑`}
                    value={values[String(c.index)] ?? UNMAPPED}
                    onChange={(e) => setValues((v) => ({ ...v, [String(c.index)]: e.target.value as ImportTargetField | '' }))}
                    options={[
                      { value: UNMAPPED, label: '매핑 안 함 (위키 본문에 함께 저장)' },
                      ...TARGET_FIELDS.filter((f) => !used.has(f.value) || values[String(c.index)] === f.value).map((f) => ({ value: f.value, label: f.label })),
                    ]}
                    className="w-[320px] shrink-0"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex h-[64px] w-full shrink-0 items-center justify-between py-[16px]">
        <Button variant="secondary" href={`/import/sheet?job=${jobId}`}>이전</Button>
        <Button variant="primary" disabled={preview.isPending} onClick={() => void submit()}>
          {preview.isPending ? '검증 중…' : '다음'}
        </Button>
      </div>
    </div>
  );
}
