import { FlowTopbar, ImportStepper, PageFrame } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';
import { Dropzone } from './dropzone';

export default function ImportUploadPage() {
  return (
    <AppShell active="events">
      <PageFrame topbar={<FlowTopbar showToggle breadcrumb={['행사', 'Excel 가져오기']} />} mainClassName="items-center">
        <div className="flex w-[760px] shrink-0 flex-col items-start gap-[48px] py-[60px]">
          <div className="flex w-full flex-col items-start gap-[48px]">
            <div className="flex w-full flex-col items-start gap-[24px]">
              <h1 className="m-0 text-xl font-bold whitespace-nowrap text-fg">Excel에서 행사 가져오기</h1>
              <ImportStepper current={1} />
            </div>
            <div className="flex w-full flex-col items-start rounded-lg bg-surface p-[24px] shadow-card">
              <Dropzone />
            </div>
          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}
