import { AppShell } from '@miceplans/ui';
import { TaskBoard } from './task-board';

export default function TaskBoardPage() {
  return (
    <AppShell active="tasks">
      <TaskBoard />
    </AppShell>
  );
}
