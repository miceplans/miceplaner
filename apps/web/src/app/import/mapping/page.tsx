import { Button, FlowTopbar, ImportStepper, PageFrame } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';
import { MappingForm } from './mapping-form';

export default function ImportMappingPage() {
  return (
    <AppShell active="events">
      <PageFrame topbar={<FlowTopbar showToggle breadcrumb={['행사', 'Excel 가져오기']} />} mainClassName="items-center">
        <div className="flex w-[760px] shrink-0 flex-col items-start py-[60px]">
          <div className="flex w-[760px] shrink-0 flex-col items-start gap-[6px]">
            <h1 className="m-0 text-xl font-bold whitespace-nowrap text-fg">Excel에서 행사가져오기</h1>
            <ImportStepper current={3} />
          </div>
          <MappingForm />
          <div className="flex h-[64px] w-[760px] shrink-0 items-center justify-between py-[16px]">
            <Button variant="secondary" href="/import/sheet">이전</Button>
            <Button variant="primary" href="/import/preview">
              다음
            </Button>
          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}
