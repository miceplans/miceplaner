import { FlowTopbar, PageFrame } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';
import { NewEventForm } from './new-event-form';

export default function NewEventPage() {
  return (
    <AppShell active="events">
      <PageFrame topbar={<FlowTopbar breadcrumb={['행사', '행사 추가']} />} mainClassName="items-center">
        <div className="flex w-[760px] max-w-full shrink-0 flex-col items-start gap-[32px] py-[60px] max-md:px-[16px]">
          <h1 className="m-0 text-xl font-bold whitespace-nowrap text-fg">행사 추가</h1>
          <NewEventForm />
        </div>
      </PageFrame>
    </AppShell>
  );
}
