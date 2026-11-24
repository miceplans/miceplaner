'use client';

import { useEffect, useRef, useState } from 'react';
import { getLocalStore } from '../../../lib/local-store';

type Grid = string[][];

const MIN_ROWS = 20;
const MIN_COLS = 8;
const lsKey = (eventId: string) => `miceplans.eventInfo.${eventId}`;

/** 0 → A, 25 → Z, 26 → AA */
function colLabel(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function normalize(grid: Grid): Grid {
  const cols = Math.max(MIN_COLS, ...grid.map((r) => r.length));
  const rows = Math.max(MIN_ROWS, grid.length);
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => grid[r]?.[c] ?? ''));
}

function parseCsv(text: string): Grid {
  const rows: Grid = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function readFile(file: File): Promise<Grid> {
  if (file.name.toLowerCase().endsWith('.csv')) return parseCsv(await file.text());
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const sheets = await readXlsxFile(file);
  const rows = (Array.isArray(sheets) ? (sheets[0] as { data?: unknown[][] })?.data ?? sheets : []) as unknown[][];
  return rows.map((r) => r.map((v) => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v))));
}

function validGrid(raw: unknown): Grid | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : []));
}

/** 엑셀로 올린 행사 정보를 엑셀 모양 표에서 바로 고친다. 편집은 잠시 멈추면 저장된다. */
export function EventInfoSheet({ eventId, canEdit = true }: { eventId: string; canEdit?: boolean }) {
  const store = getLocalStore<Grid>({ key: lsKey(eventId), fallback: normalize([]), validate: validGrid });
  const [grid, setGrid] = useState<Grid>(() => normalize([]));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const refs = useRef(new Map<string, HTMLInputElement>());

  // 저장값은 hydration 이후에 적용해 서버 렌더 결과와 맞춘다. 행사 id가 없으면 저장 자체를 건드리지 않는다.
  useEffect(() => {
    if (!eventId) {
      setGrid(normalize([]));
      setReady(false);
      return;
    }
    setGrid(normalize(store.get()));
    setReady(true);
  }, [store, eventId]);

  // 키 입력마다 디스크를 직접 쓰지 않고 저장소에 맡겨 지연 저장·pagehide 비우기를 쓴다.
  useEffect(() => {
    if (!ready || !eventId) return;
    store.set(grid);
  }, [grid, ready, store, eventId]);

  const set = (r: number, c: number, v: string) =>
    setGrid((g) => g.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? v : x)) : row)));

  const focus = (r: number, c: number) => refs.current.get(`${r}:${c}`)?.focus();

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    let nr = r;
    let nc = c;
    if (e.key === 'Enter') nr = e.shiftKey ? r - 1 : r + 1;
    else if (e.key === 'ArrowDown') nr = r + 1;
    else if (e.key === 'ArrowUp') nr = r - 1;
    else if (e.key === 'Tab') nc = e.shiftKey ? c - 1 : c + 1;
    else if (e.key === 'ArrowRight' && e.currentTarget.selectionEnd === e.currentTarget.value.length) nc = c + 1;
    else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) nc = c - 1;
    else return;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) return;
    e.preventDefault();
    focus(nr, nc);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(text)) return;
    e.preventDefault();
    const block = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
    setGrid((g) => {
      const next = g.map((row) => [...row]);
      block.forEach((line, i) => line.forEach((v, j) => {
        if (!next[r + i]) next[r + i] = Array(next[0].length).fill('');
        if (c + j < next[0].length) next[r + i][c + j] = v;
      }));
      return normalize(next);
    });
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      const parsed = await readFile(file);
      if (!parsed.length) return setError('[400] 빈 파일임');
      setGrid(normalize(parsed));
    } catch {
      setError('[400] 파일을 읽지 못했음. .xlsx 또는 .csv만 가능함');
    }
  };

  const btn = 'h-[28px] rounded-[6px] border border-solid border-border bg-surface px-[10px] text-sm text-fg hover:bg-surface-sunken';
  const cols = grid[0]?.length ?? MIN_COLS;

  return (
    <div className="mt-[24px] flex w-full flex-col gap-[12px]">
      <div className="flex items-center gap-[8px]">
        <p className="m-0 mr-auto text-sm text-fg-secondary">셀을 눌러 바로 편집. 엑셀에서 복사한 내용 붙여넣기 가능. 입력을 멈추면 자동 저장됨.</p>
        {canEdit && (
          <>
            <input ref={input} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
            <button type="button" className={btn} onClick={() => input.current?.click()}>Excel 업로드</button>
            <button type="button" className={btn} onClick={() => setGrid((g) => [...g, Array(cols).fill('')])}>행 추가</button>
            <button type="button" className={btn} onClick={() => setGrid((g) => g.map((r) => [...r, '']))}>열 추가</button>
          </>
        )}
      </div>
      {error && <p role="alert" className="m-0 text-sm text-error-delay">{error}</p>}
      <div className="max-h-[560px] w-full overflow-auto rounded-md border border-solid border-border bg-surface">
        <table className="border-separate border-spacing-0 text-sm" aria-label="행사 정보">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 h-[26px] w-[40px] min-w-[40px] border-r border-b border-solid border-border bg-surface-sunken" />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className="sticky top-0 z-10 h-[26px] min-w-[120px] border-r border-b border-solid border-border bg-surface-sunken text-xs font-medium text-fg-secondary">
                  {colLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => (
              <tr key={r}>
                <th className="sticky left-0 z-10 h-[28px] border-r border-b border-solid border-border bg-surface-sunken text-xs font-normal text-fg-secondary">{r + 1}</th>
                {row.map((v, c) => (
                  <td key={c} className="h-[28px] border-r border-b border-solid border-border p-0">
                    <input
                      ref={(el) => { if (el) refs.current.set(`${r}:${c}`, el); else refs.current.delete(`${r}:${c}`); }}
                      value={v}
                      readOnly={!canEdit}
                      aria-label={`${colLabel(c)}${r + 1}`}
                      onChange={(e) => set(r, c, e.target.value)}
                      onKeyDown={(e) => onKey(e, r, c)}
                      onPaste={(e) => canEdit && onPaste(e, r, c)}
                      className="h-full w-full min-w-[120px] border-0 bg-transparent px-[8px] text-fg outline-none focus:bg-surface focus:ring-2 focus:ring-inset focus:ring-brand"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
