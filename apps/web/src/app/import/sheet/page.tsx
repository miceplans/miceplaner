import { Button, FlowTopbar, ImportStepper, PageFrame } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';
import { SheetForm } from './sheet-form';

export default function ImportSheetPage() {
  return (
    <AppShell active="events">
      <PageFrame topbar={<FlowTopbar showToggle breadcrumb={['행사', 'Excel 가져오기']} />} mainClassName="items-center px-[40px] py-[60px]">
        <div className="flex w-[760px] shrink-0 flex-col items-start gap-[64px]">
          <div className="flex w-full flex-col items-start gap-[48px]">
            <div className="flex w-full flex-col items-start gap-[24px]">
              <h1 className="m-0 text-xl font-bold whitespace-nowrap text-fg">Excel에서 행사 가져오기</h1>
              <ImportStepper current={2} />
            </div>
            <SheetForm />
          </div>
          <div className="flex w-full items-center gap-[8px]">
            <Button variant="secondary" href="/import/upload">취소</Button>
            <div className="h-px min-w-px flex-1" />
            <Button variant="primary" href="/import/mapping">
              다음
            </Button>
          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}
