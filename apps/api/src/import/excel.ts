import { Readable } from 'node:stream';
import { IMPORT_FILE_EXTENSIONS, type ImportColumnDto, type ImportSheetDto } from '@miceplans/contracts';
import { UnsupportedFileError } from '@miceplans/knowledge/parse';

/** 컬럼 인덱스를 스프레드시트 문자열(A, B, …, Z, AA…)로 바꾼다. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

type Workbook = import('exceljs').Workbook;
type Worksheet = import('exceljs').Worksheet;

const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

async function loadWorkbook(bytes: Buffer, name: string): Promise<Workbook> {
  const ext = extOf(name);
  if (!(IMPORT_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new UnsupportedFileError(`[415] 지원하는 형식: ${IMPORT_FILE_EXTENSIONS.join(', ')}`);
  }
  // CommonJS default export다 (knowledge/parse.ts와 같은 방식으로 읽는다).
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  if (ext === 'csv') {
    // CSV는 시트 하나다. exceljs는 스트림으로 읽는다.
    await wb.csv.read(Readable.from(bytes));
  } else {
    // 구형 .xls(바이너리)는 지원하지 않고 xlsx만 읽는다 (명세 F-10과 같다).
    await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  }
  if (wb.worksheets.length === 0) throw new UnsupportedFileError('통합 문서에 시트가 없다');
  return wb;
}

/** 셀 값을 표시·저장용 문자열로 바꾼다. 날짜는 exceljs가 UTC 기준 Date를 주므로 ISO 날짜 부분만 쓴다. */
function cellText(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const o = value as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (typeof o.text === 'string') return o.text.trim();
    if (o.result != null) return cellText(o.result);
    if (Array.isArray(o.richText)) return o.richText.map((t) => t.text).join('').trim();
    return '';
  }
  return String(value).trim();
}

/** 모든 빈 행을 빼고 스프레드시트의 실제 행 번호와 함께 돌려준다. */
function sheetRows(ws: Worksheet): { row: number; values: string[] }[] {
  const width = Math.min(Math.max(ws.columnCount, 1), 200);
  const out: { row: number; values: string[] }[] = [];
  for (let n = 1; n <= ws.rowCount; n++) {
    const raw = (ws.getRow(n).values ?? []) as unknown[];
    const values = Array.from({ length: width }, (_, i) => cellText(raw[i + 1]));
    if (values.some((v) => v !== '')) out.push({ row: n, values });
  }
  return out;
}

/** 업로드한 통합 문서의 시트 목록과 행 수를 본다. */
export async function listWorkbookSheets(bytes: Buffer, name: string): Promise<ImportSheetDto[]> {
  const wb = await loadWorkbook(bytes, name);
  return wb.worksheets.map((ws) => ({ name: ws.name, rowCount: ws.rowCount }));
}

export type ImportGrid = { columns: ImportColumnDto[]; rows: string[][]; dataRowCount: number; rowNumbers: number[] };

/**
 * 선택한 시트를 문자열 그리드로 바꾼다. headerRow(1부터)는 시트의 실제 행 번호다.
 * hasHeader이면 그 행을 컬럼 라벨로 쓰고 아니면 A, B, C…를 쓴다. 라벨이 비면 문자열을 쓴다.
 * 반환 행 번호는 사용자에게 보이는 원본 시트 행 번호다 (빈 행은 걸러지고 번호는 유지된다).
 */
export async function parseSheetGrid(bytes: Buffer, name: string, sheetName: string, hasHeader: boolean, headerRow: number): Promise<ImportGrid> {
  const wb = await loadWorkbook(bytes, name);
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new UnsupportedFileError(`시트를 찾을 수 없다: ${sheetName}`);
  const all = sheetRows(ws);
  const header = hasHeader ? all.find((r) => r.row >= headerRow) : undefined;
  const dataStart = header ? header.row + 1 : headerRow;
  const data = all.filter((r) => r.row >= dataStart);
  const width = Math.max(header?.values.length ?? 0, ...data.map((r) => r.values.length), 1);
  const columns: ImportColumnDto[] = Array.from({ length: width }, (_, i) => ({
    index: i,
    label: hasHeader && header?.values[i] ? header.values[i]! : columnLetter(i),
  }));
  return {
    columns,
    rows: data.map((r) => r.values),
    dataRowCount: data.length,
    rowNumbers: data.map((r) => r.row),
  };
}
