import { Buffer } from 'node:buffer';

export class UnsupportedFileError extends Error {}

export type ParsedFile = { markdown: string; format: 'text' | 'markdown' | 'csv' | 'xlsx' | 'docx' | 'pdf' };

const MAX_ROWS = 5000;

function format(name: string, mime: string): ParsedFile['format'] {
  const dot = name.lastIndexOf('.');
  // 클라이언트가 보내는 MIME은 믿지 않는다. 확장자가 기준이고, 확장자가 없을 때만 MIME을 본다.
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : mime === 'text/plain' ? 'txt' : mime === 'text/csv' ? 'csv' : mime === 'application/pdf' ? 'pdf' : '';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'txt') return 'text';
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx') return 'xlsx';
  if (ext === 'docx') return 'docx';
  if (ext === 'pdf') return 'pdf';
  throw new UnsupportedFileError(`지원하지 않는 파일 형식이다: ${name}`);
}

export const SUPPORTED_EXTENSIONS = ['txt', 'md', 'markdown', 'csv', 'xlsx', 'docx', 'pdf'] as const;

const decode = (bytes: Uint8Array) => new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');

/** 따옴표와 줄바꿈이 든 셀을 처리하는 최소 CSV 파서. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const esc = (c: string) => c.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();

/** 첫 행을 머리글로 보고 Markdown 표로 바꾼다. 행이 많으면 잘라 낸다. */
export function rowsToMarkdown(rows: string[][]): string {
  if (rows.length === 0) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => esc(r[i] ?? ''));
  const [head, ...body] = rows;
  const lines = [`| ${pad(head!).join(' | ')} |`, `| ${Array(width).fill('---').join(' | ')} |`];
  for (const r of body.slice(0, MAX_ROWS)) lines.push(`| ${pad(r).join(' | ')} |`);
  if (body.length > MAX_ROWS) lines.push(`\n(이하 ${body.length - MAX_ROWS}행 생략)`);
  return lines.join('\n');
}

async function parseXlsx(bytes: Uint8Array): Promise<string> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  const parts: string[] = [];
  wb.eachSheet((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = (row.values as unknown[]).slice(1);
      rows.push(values.map((v) => (v == null ? '' : typeof v === 'object' ? ('text' in v ? String((v as { text: unknown }).text) : 'result' in v ? String((v as { result: unknown }).result ?? '') : v instanceof Date ? v.toISOString().slice(0, 10) : '') : String(v))));
    });
    if (rows.length > 0) parts.push(`## ${sheet.name}\n\n${rowsToMarkdown(rows)}`);
  });
  return parts.join('\n\n');
}

type Md = (input: { buffer: Buffer }) => Promise<{ value: string }>;

async function parseDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = (await import('mammoth')) as unknown as { convertToMarkdown?: Md; default?: { convertToMarkdown: Md } };
  // 타입 정의에는 없지만 런타임에는 있는 API다. 제목 스타일을 Markdown 제목으로 보존한다.
  const convert = mammoth.convertToMarkdown ?? mammoth.default!.convertToMarkdown;
  const { value } = await convert({ buffer: Buffer.from(bytes) });
  return value.replace(/\\([.\-()#*_>[\]!])/g, '$1').trim();
}

async function parsePdf(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}

/** 업로드 파일을 검색용 Markdown으로 바꾼다. 지원하지 않거나 읽을 수 없으면 던진다. */
export async function parseFile(file: { name: string; mime?: string; bytes: Uint8Array }): Promise<ParsedFile> {
  const kind = format(file.name, file.mime ?? '');
  const markdown = await (async () => {
    switch (kind) {
      case 'text': case 'markdown': return decode(file.bytes).trim();
      case 'csv': return rowsToMarkdown(parseCsv(decode(file.bytes)));
      case 'xlsx': return parseXlsx(file.bytes);
      case 'docx': return parseDocx(file.bytes);
      case 'pdf': return parsePdf(file.bytes);
    }
  })();
  if (!markdown) throw new UnsupportedFileError('파일에서 읽을 수 있는 텍스트가 없다 (스캔 이미지는 지원하지 않는다)');
  return { markdown, format: kind };
}
