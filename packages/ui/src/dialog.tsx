import type { ReactNode } from 'react';
import { Button } from './button';

/**
 * 가울데 정렬 모달 래퍼. 어두운 오버레이 클릭 시 onClose.
 * 패널은 children이 직접 정의하며(보통 role="dialog"), 오버레이 클릭 전파를 막는다.
 */
export function Dialog({ onClose, children }: { onClose: () => void; children: ReactNode }): ReactNode {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-[16px]" onClick={onClose}>
      {children}
    </div>
  );
}

/** 삭제 등 파괴적 동작 전 확인하는 공용 확인 팝업. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel = '삭제',
  cancelLabel = '취소',
  danger = true,
  onConfirm,
  onClose,
}: {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}): ReactNode {
  return (
    <Dialog onClose={onClose}>
      <div
        role="alertdialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex w-[360px] max-w-full flex-col gap-[16px] rounded-lg bg-surface p-[20px] shadow-card"
      >
        <div className="flex flex-col gap-[6px]">
          <h2 className="m-0 text-lg font-semibold text-fg">{title}</h2>
          {body ? <p className="m-0 text-base text-fg-secondary">{body}</p> : null}
        </div>
        <div className="flex justify-end gap-[8px]">
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button className={danger ? 'bg-error-delay text-fg-inverse' : ''} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
