import { AppShell, FlowTopbar, PageFrame } from '@miceplans/ui';
import { TaskBoard } from './task-board';

export default function TaskBoardPage() {
  return (
    <AppShell active="tasks">
      <PageFrame topbar={<FlowTopbar title="Tasks" />}>
        <TaskBoard />
      </PageFrame>
    </AppShell>
  );
}
