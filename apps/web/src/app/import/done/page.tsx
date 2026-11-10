import { Suspense } from 'react';
import { FlowTopbar, ImportStepper, PageFrame } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';
import { DoneView } from './done-view';

export default function ImportDonePage() {
  return (
    <AppShell active="events">
      <PageFrame topbar={<FlowTopbar showToggle breadcrumb={['행사', 'Excel 가져오기']} />} mainClassName="items-center">
        <div className="flex h-[527px] w-[760px] shrink-0 flex-col items-center justify-between">
          <div className="flex w-[760px] flex-col items-start gap-[6px] py-[36px] whitespace-nowrap">
            <h1 className="m-0 text-xl font-bold text-fg">Excel에서 행사 가져오기</h1>
            <p className="m-0 text-md text-fg-secondary">기존 스프레드시트의 행사 데이터를 mice planner로 가져옵니다</p>
          </div>
          <ImportStepper current={5} />
          <Suspense fallback={<div className="h-[313px] w-[760px] rounded-lg bg-surface shadow-card" />}>
            <DoneView />
          </Suspense>
        </div>
      </PageFrame>
    </AppShell>
  );
}
