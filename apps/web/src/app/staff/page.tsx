import { AppShell } from '@miceplans/ui/sidebar';
import { StaffManagementView } from './staff-management-view';

export default function StaffPage() {
  return <AppShell active="staff"><StaffManagementView /></AppShell>;
}
