'use client';

import { avatarTone, fmtDue, type Task } from './task-board-model';

const A = '/assets/task-board';

export function TaskCard({
  task,
  dim,
  strike,
  canEdit,
  canComplete,
  onEdit,
  onComplete,
  onDelete,
}: {
  task: Task;
  dim?: boolean;
  strike?: boolean;
  canEdit: boolean;
  canComplete: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      onDoubleClick={canEdit ? onEdit : undefined}
      className={`flex w-full shrink-0 flex-col items-start gap-[8px] rounded-md bg-surface p-[12px] ${canEdit ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start gap-[6px]">
        <span className="flex h-[20px] items-center justify-center rounded-xs bg-brand-tint px-[7px] text-2xs font-medium whitespace-nowrap text-brand">
          {task.event}
        </span>
        <span className="flex h-[20px] items-center justify-center rounded-xs bg-surface-chip px-[7px] text-2xs whitespace-nowrap text-fg-secondary">
          {task.schedule}
        </span>
      </div>
      <p className={`min-w-full text-base font-medium leading-[1.35] ${dim ? 'text-fg-secondary' : 'text-fg'} ${strike ? 'line-through' : ''}`}>
        {task.title}
      </p>
      <div className="flex w-full items-center gap-[6px]">
        {task.due ? (
          <>
            <img alt="" src={`${A}/${task.late ? 'due-late' : 'due'}.svg`} className="size-[12px]" />
            <span className={`text-xs whitespace-nowrap ${task.late ? 'text-error-delay' : 'text-fg-secondary'}`}>{fmtDue(task.due)}</span>
            {task.late ? <span className="text-2xs font-medium whitespace-nowrap text-error-delay">지연</span> : null}
          </>
        ) : (
          <span className="text-2xs whitespace-nowrap text-fg-secondary">마감일 없음</span>
        )}
        <div className="h-px min-w-px flex-1" />
        <span className={`flex h-[22px] items-center justify-center rounded-lg px-[6px] text-2xs font-semibold whitespace-nowrap ${avatarTone(task.who || '?')}`}>
          {task.who || '미배정'}
        </span>
      </div>
      {canEdit || canComplete ? (
        <div className="flex w-full items-center gap-[6px] border-t border-solid border-border pt-[6px]">
          {canComplete ? (
            <button
              type="button"
              onClick={onComplete}
              className="flex h-[20px] items-center rounded-xs bg-brand-tint px-[8px] text-2xs font-medium whitespace-nowrap text-brand hover:opacity-80"
            >
              완료
            </button>
          ) : null}
          <div className="h-px min-w-px flex-1" />
          {canEdit ? (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="flex h-[20px] items-center rounded-xs bg-surface-chip px-[8px] text-2xs whitespace-nowrap text-fg-secondary hover:text-fg"
              >
                수정
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex h-[20px] items-center rounded-xs bg-surface-chip px-[8px] text-2xs whitespace-nowrap text-fg-secondary hover:text-error-delay"
              >
                삭제
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
