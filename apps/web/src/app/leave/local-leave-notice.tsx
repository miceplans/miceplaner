'use client';

import { useEffect, useState } from 'react';
import { Button, ConfirmDialog, toast } from '@miceplans/ui';
import { leaveRequest, leaveSetWeekendWork } from '../../lib/api/generated/endpoints';
import { readLocalLeave, writeLocalLeave, type LocalLeave } from './local-leave';
import { leaveErrorText, useRefreshLeave } from './use-work-check';

const EMPTY: LocalLeave = { weekendWork: [], comp: [] };

/** 예전에 이 브라우저에만 저장된 주말 근무·대휴를 본인이 확인하고 서버에 등록하거나 지운다. */
export function LocalLeaveNotice() {
  const [local, setLocal] = useState<LocalLeave>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const refresh = useRefreshLeave();
  useEffect(() => setLocal(readLocalLeave()), []);

  if (!local.weekendWork.length && !local.comp.length) return null;

  const keep = (rest: LocalLeave) => {
    writeLocalLeave(rest);
    setLocal(rest);
  };

  const register = async () => {
    setSaving(true);
    const rest: LocalLeave = { weekendWork: [], comp: [] };
    let reason = '';
    // 대휴 한도는 주말 근무 일수로 정해지므로 주말 근무를 먼저 등록한다.
    for (const date of local.weekendWork) {
      try {
        await leaveSetWeekendWork({ date, worked: true });
      } catch (error) {
        rest.weekendWork.push(date);
        reason = leaveErrorText(error, '[500] 등록하지 못했습니다.');
      }
    }
    for (const date of local.comp) {
      try {
        await leaveRequest({ kind: 'comp', startDate: date, endDate: date, reason: '', substituteId: null });
      } catch (error) {
        rest.comp.push(date);
        reason = leaveErrorText(error, '[500] 등록하지 못했습니다.');
      }
    }
    keep(rest);
    refresh();
    setSaving(false);
    const failed = rest.weekendWork.length + rest.comp.length;
    if (failed) toast.error(`${failed}건을 등록하지 못했습니다. ${reason}`);
    else toast.info('이 브라우저에 있던 기록을 등록했습니다.');
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-[12px] rounded-lg bg-notice-bg px-[16px] py-[12px]">
      <p className="m-0 min-w-[200px] flex-1 text-sm text-fg">
        이 브라우저에만 저장된 기록이 있습니다. 본인의 기록이면 등록해 주세요.
        {local.weekendWork.length ? ` 주말 근무: ${local.weekendWork.join(', ')}.` : ''}
        {local.comp.length ? ` 대휴: ${local.comp.join(', ')}.` : ''}
      </p>
      <Button variant="secondary" disabled={saving} onClick={() => setConfirming(true)}>지우기</Button>
      <Button disabled={saving} onClick={() => void register()}>{saving ? '등록 중…' : '내 기록으로 등록'}</Button>
      {confirming && (
        <ConfirmDialog
          title="이 브라우저의 기록을 지울까요?"
          body="서버에 등록하지 않은 주말 근무·대휴 기록이 지워지며 복구할 수 없습니다."
          confirmLabel="지우기"
          onConfirm={() => {
            keep(EMPTY);
            setConfirming(false);
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
