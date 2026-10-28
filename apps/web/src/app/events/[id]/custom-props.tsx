'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog, Dialog } from '@miceplans/ui';

/** 표에 사용자가 추가하는 속성(컬럼). 노션처럼 이름과 유형을 정하고 이름 변경·삭제를 할 수 있다. */
export type PropType = 'text' | 'number' | 'date' | 'checkbox';
export type CustomProp = { id: string; name: string; type: PropType };

export const PROP_TYPES: { value: PropType; label: string; mark: string }[] = [
  { value: 'text', label: '텍스트', mark: 'Aa' },
  { value: 'number', label: '숫자', mark: '#' },
  { value: 'date', label: '날짜', mark: '▦' },
  { value: 'checkbox', label: '체크박스', mark: '☑' },
];

const markOf = (type: PropType) => PROP_TYPES.find((t) => t.value === type)!.mark;

/** 속성 컬럼 하나가 차지하는 너비(w-[120px] + 간격 12px). 표 최소 너비 계산에 쓴다. */
export const PROP_COL_WIDTH = 132;

type Store = { props: CustomProp[]; values: Record<string, Record<string, string>> };

const EMPTY: Store = { props: [], values: {} };
const CHANGE_EVENT = 'miceplans:table-props:change';
const keyOf = (scope: string) => `miceplans.table-props.${scope}`;

function read(scope: string): Store {
  try {
    const raw = window.localStorage.getItem(keyOf(scope));
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* 목업: 저장값이 깨져 있으면 빈 상태로 돌아간다. */
  }
  return EMPTY;
}

/**
 * 표별 사용자 정의 속성과 셀 값을 다루는 훅. scope는 행사·표 단위 식별자다.
 * 저장은 localStorage(목업)이며, 같은 scope를 쓰는 다른 표 인스턴스에도 바로 반영된다.
 * TODO: API와 RLS가 정해지면 서버 저장으로 바꾸고, 속성 변경은 권한·감사 로그 대상으로 다룬다.
 */
export function useCustomProps(scope: string) {
  const [store, setStore] = useState<Store>(EMPTY);

  useEffect(() => {
    const reload = () => setStore(read(scope));
    reload();
    window.addEventListener(CHANGE_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(CHANGE_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, [scope]);

  const commit = useCallback(
    (fn: (s: Store) => Store) => {
      const next = fn(read(scope));
      try {
        window.localStorage.setItem(keyOf(scope), JSON.stringify(next));
      } catch {
        /* 저장 실패 시 세션 동안만 유지 */
      }
      setStore(next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [scope],
  );

  return {
    props: store.props,
    getValue: (rowId: string, propId: string) => store.values[rowId]?.[propId] ?? '',
    addProp: (name: string, type: PropType) =>
      commit((s) => ({ ...s, props: [...s.props, { id: `p${Date.now()}`, name: name.trim(), type }] })),
    renameProp: (id: string, name: string) =>
      commit((s) => ({ ...s, props: s.props.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)) })),
    removeProp: (id: string) =>
      commit((s) => ({
        props: s.props.filter((p) => p.id !== id),
        values: Object.fromEntries(Object.entries(s.values).map(([row, v]) => [row, Object.fromEntries(Object.entries(v).filter(([k]) => k !== id))])),
      })),
    setValue: (rowId: string, propId: string, value: string) =>
      commit((s) => ({ ...s, values: { ...s.values, [rowId]: { ...s.values[rowId], [propId]: value } } })),
  };
}

const INPUT = 'h-[34px] w-full rounded-sm border border-solid border-border bg-surface px-[10px] text-base text-fg outline-none focus:border-brand';

/** 표 제목 옆의 + 버튼. 눌러서 속성 이름과 유형을 정해 추가한다. */
export function AddPropertyButton({ onAdd }: { onAdd: (name: string, type: PropType) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<PropType>('text');

  const close = () => {
    setOpen(false);
    setName('');
    setType('text');
  };

  return (
    <>
      <button
        type="button"
        aria-label="속성 추가"
        title="속성 추가"
        onClick={() => setOpen(true)}
        className="flex size-[24px] items-center justify-center rounded-md text-lg leading-none text-fg-secondary hover:bg-surface-chip"
      >
        +
      </button>
      {open && (
        <Dialog onClose={close}>
          <form
            role="dialog"
            aria-label="속성 추가"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              onAdd(name, type);
              close();
            }}
            className="flex w-[400px] max-w-full flex-col overflow-hidden rounded-xl border border-solid border-border bg-surface shadow-card"
          >
            <div className="border-b border-solid border-border px-[20px] py-[17px]">
              <p className="m-0 text-xs font-medium text-fg-tertiary">표 설정</p>
              <h2 className="m-[3px_0_0] text-lg font-semibold text-fg">새 속성</h2>
            </div>
            <div className="flex flex-col gap-[16px] px-[20px] py-[18px]">
              <label className="flex flex-col gap-[7px] text-sm font-medium text-fg">
                속성 이름
                <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 작업 우선순위" className="h-[40px] w-full rounded-md border border-solid border-border bg-surface px-[11px] text-base font-normal text-fg outline-none placeholder:text-fg-tertiary focus:border-brand focus:ring-2 focus:ring-brand/15" />
              </label>
              <fieldset className="m-0 border-0 p-0">
                <legend className="mb-[7px] text-sm font-medium text-fg">유형</legend>
                <div role="radiogroup" aria-label="속성 유형" className="grid grid-cols-2 gap-[8px]">
                  {PROP_TYPES.map((t) => {
                    const selected = type === t.value;
                    return <button key={t.value} type="button" role="radio" aria-checked={selected} onClick={() => setType(t.value)} className={`flex h-[42px] items-center gap-[8px] rounded-md border px-[10px] text-sm font-medium ${selected ? 'border-brand bg-brand-tint text-brand' : 'border-border text-fg hover:bg-surface-subtle'}`}><span className="w-[18px] text-center text-xs">{t.mark}</span>{t.label}</button>;
                  })}
                </div>
              </fieldset>
              <p className="m-0 text-xs leading-[18px] text-fg-tertiary">추가한 뒤에는 속성 유형을 바꿀 수 없습니다.</p>
            </div>
            <div className="flex justify-end gap-[8px] border-t border-solid border-border px-[20px] py-[14px]">
              <button type="button" onClick={close} className="h-[34px] rounded-md px-[13px] text-sm font-medium text-fg-secondary hover:bg-surface-subtle">
                취소
              </button>
              <button type="submit" className="h-[34px] rounded-md bg-brand px-[14px] text-sm font-semibold text-fg-inverse hover:opacity-90">
                추가
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

/** 속성 헤더 칸. 눌러서 이름을 바꾸거나 속성을 삭제한다. className은 표의 헤더 칸 스타일을 받는다. */
export function PropHeaderCell({ prop, className, onRename, onRemove }: { prop: CustomProp; className: string; onRename: (name: string) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(prop.name);
  const [confirming, setConfirming] = useState(false);

  const close = () => setEditing(false);

  return (
    <>
      <button type="button" title="속성 수정" aria-label={`${prop.name} 속성 수정`} onClick={() => { setName(prop.name); setEditing(true); }} className={`${className} w-[120px] gap-[6px] text-left hover:bg-surface-chip`}>
        <span className="shrink-0 text-xs text-fg-tertiary">{markOf(prop.type)}</span>
        <span className="min-w-0 truncate">{prop.name}</span>
      </button>
      {editing && (
        <Dialog onClose={close}>
          <form
            role="dialog"
            aria-label="속성 수정"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && name.trim() !== prop.name) onRename(name);
              close();
            }}
            className="flex w-[320px] max-w-full flex-col gap-[14px] rounded-lg bg-surface p-[20px] shadow-card"
          >
            <h2 className="m-0 text-lg font-semibold text-fg">속성 수정</h2>
            <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} aria-label="속성 이름" className={INPUT} />
            <p className="m-0 text-sm text-fg-tertiary">유형: {PROP_TYPES.find((t) => t.value === prop.type)!.label} (추가한 뒤에는 바꿀 수 없습니다)</p>
            <div className="flex items-center gap-[8px]">
              <button type="button" onClick={() => { close(); setConfirming(true); }} className="h-[32px] rounded-sm px-[10px] text-base text-error-delay hover:bg-surface-subtle">
                속성 삭제
              </button>
              <span className="flex-1" />
              <button type="button" onClick={close} className="h-[32px] rounded-sm border border-solid border-border bg-surface px-[14px] text-base font-medium text-fg-secondary">
                취소
              </button>
              <button type="submit" className="h-[32px] rounded-sm bg-brand px-[14px] text-base font-medium text-fg-inverse">
                저장
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {confirming && (
        <ConfirmDialog
          title={`'${prop.name}' 속성을 삭제할까요?`}
          body="모든 행에 입력한 이 속성의 값도 함께 삭제되며 복구할 수 없습니다."
          onClose={() => setConfirming(false)}
          onConfirm={() => { onRemove(); setConfirming(false); }}
        />
      )}
    </>
  );
}

/** 속성 값 칸. 유형에 맞는 입력창을 바로 보여주고 값이 바뀌면 저장한다. 텍스트·숫자·날짜는 포커스를 잃거나 Enter에서 저장한다. */
export function PropCell({ prop, value, onChange }: { prop: CustomProp; value: string; onChange: (value: string) => void }) {
  const base = 'h-[40px] w-[120px] shrink-0 rounded-lg border border-solid border-transparent bg-transparent px-[8px] text-[15px] text-fg outline-none hover:border-border focus:border-brand';

  if (prop.type === 'checkbox') {
    return (
      <span className="flex h-[40px] w-[120px] shrink-0 items-center px-[8px]">
        <input type="checkbox" aria-label={prop.name} checked={value === 'true'} onChange={(e) => onChange(e.target.checked ? 'true' : '')} className="size-[16px] accent-brand" />
      </span>
    );
  }
  return (
    // key로 저장된 값이 바뀌면(다른 표 인스턴스 갱신 등) 입력창을 새로 그린다.
    <input
      key={value}
      type={prop.type === 'text' ? 'text' : prop.type}
      aria-label={prop.name}
      defaultValue={value}
      onBlur={(e) => { if (e.target.value !== value) onChange(e.target.value); }}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur(); }}
      className={base}
    />
  );
}
