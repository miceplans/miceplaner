import { Suspense } from 'react';
import { FlowTopbar, ImportStepper, PageFrame } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';
import { PreviewClient } from './preview-client';

const A = '/assets/import';

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
              <Suspense fallback={<div className="h-[296px] w-[760px] rounded-lg bg-surface shadow-card" />}>
                <PreviewClient />
              </Suspense>
            </div>
          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}
