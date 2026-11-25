import type { PortalNotificationDto } from '@miceplans/contracts/portal';

const ICON: Record<PortalNotificationDto['kind'], { src: string; bg: string }> = {
  schedule_changed: { src: 'type1', bg: 'bg-notice-bg' },
  program_published: { src: 'icon5', bg: 'bg-surface-section' },
};

/** 알림 종류 아이콘 칩(34px). Figma 221:26866 일정 변경, 221:26988 공지. */
export function KindIcon({ kind }: { kind: PortalNotificationDto['kind'] }) {
  return (
    <span className={`flex size-[34px] shrink-0 items-center justify-center rounded-md ${ICON[kind].bg}`}>
      <img alt="" src={`/assets/client/inbox/${ICON[kind].src}.svg`} className="size-[16px]" />
    </span>
  );
}
