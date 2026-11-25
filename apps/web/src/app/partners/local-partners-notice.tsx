'use client';

import { useEffect, useState } from 'react';
import { Button, toast } from '@miceplans/ui';
import type { PartnerDto, SavePartnerBody } from '@miceplans/contracts';
import { ApiError } from '../../lib/api';
import { partnersCreateField, partnersSave } from '../../lib/api/generated/endpoints';
import { keepLocalPartners, readLocalPartners, samePartner, type LocalPartners } from './local-partners';

/** 이 브라우저에만 저장된 협력사를 서버로 옮기는 안내. 서버에 이미 있는 협력사는 건너뛴다. */
export function LocalPartnersNotice({ partners, fields, onMoved }: { partners: PartnerDto[]; fields: string[]; onMoved: () => void }) {
  const [local, setLocal] = useState<LocalPartners>({ fields: [], partners: [] });
  const [moving, setMoving] = useState(false);
  useEffect(() => setLocal(readLocalPartners()), []);

  if (!local.partners.length) return null;

  const move = async () => {
    setMoving(true);
    const rest: SavePartnerBody[] = [];
    let reason = '';
    // 협력사에 쓰인 태그 중 서버에 없는 것만 만든다. 그새 다른 사람이 만들었으면(409) 그대로 쓴다.
    const used = new Set(local.partners.map((p) => p.field));
    for (const name of local.fields.filter((f) => used.has(f) && !fields.includes(f))) {
      try {
        await partnersCreateField({ name });
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 409)) reason = error instanceof ApiError ? error.message : '[500] 태그를 만들지 못했습니다.';
      }
    }
    const known: Pick<PartnerDto, 'name' | 'phone'>[] = [...partners];
    for (const p of local.partners) {
      if (known.some((k) => samePartner(k, p))) continue;
      try {
        await partnersSave(crypto.randomUUID(), p);
        known.push(p);
      } catch (error) {
        rest.push(p);
        reason = error instanceof ApiError ? error.message : '[500] 협력사를 옮기지 못했습니다.';
      }
    }
    keepLocalPartners(rest);
    setLocal({ ...local, partners: rest });
    setMoving(false);
    onMoved();
    if (rest.length) toast.error(`${rest.length}곳을 옮기지 못했습니다. ${reason}`);
    else toast.info('이 브라우저의 협력사를 서버로 옮겼습니다.');
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-[12px] rounded-lg bg-notice-bg px-[16px] py-[12px]">
      <p className="m-0 min-w-[200px] flex-1 text-sm text-fg">이 브라우저에만 저장된 협력사 {local.partners.length}곳이 있습니다. 서버로 옮기면 모든 직원이 함께 봅니다.</p>
      <Button disabled={moving} onClick={() => void move()}>{moving ? '옮기는 중…' : '서버로 옮기기'}</Button>
    </div>
  );
}
