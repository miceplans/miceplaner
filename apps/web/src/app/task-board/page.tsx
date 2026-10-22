import { AppShell } from '@miceplans/ui/sidebar';
import { TaskBoard } from './task-board';

export default function TaskBoardPage() {
  return (
    <AppShell active="tasks">
      <TaskBoard />
    </AppShell>
  );
}
