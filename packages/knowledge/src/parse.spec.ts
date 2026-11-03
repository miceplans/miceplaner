import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { parseCsv, parseFile, rowsToMarkdown, UnsupportedFileError } from './parse';
import { EMBEDDING_DIM, teiEmbedder, toVectorLiteral } from './embed';

const enc = (s: string) => new TextEncoder().encode(s);

async function docx(paragraphs: { style?: string; text: string }[]): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const body = paragraphs.map((p) => `<w:p>${p.style ? `<w:pPr><w:pStyle w:val="${p.style}"/></w:pPr>` : ''}<w:r><w:t>${p.text}</w:t></w:r></w:p>`).join('');
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: 'uint8array' });
}

/** 텍스트 한 줄짜리 최소 PDF. */
function pdf(text: string): Uint8Array {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${`BT /F1 12 Tf 10 50 Td (${text}) Tj ET`.length} >>\nstream\nBT /F1 12 Tf 10 50 Td (${text}) Tj ET\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return enc(out);
}

describe('parseFile', () => {
  it('텍스트와 Markdown은 BOM만 떼고 그대로 쓴다', async () => {
    expect((await parseFile({ name: 'a.txt', bytes: enc('﻿장소는 코엑스\n') })).markdown).toBe('장소는 코엑스');
    expect((await parseFile({ name: 'a.md', bytes: enc('# 제목\n\n본문') })).format).toBe('markdown');
  });

  it('CSV는 따옴표·줄바꿈·이스케이프를 지키며 표로 바꾼다', async () => {
    expect(parseCsv('a,b\n"x, y","He said ""hi"""\n')).toEqual([['a', 'b'], ['x, y', 'He said "hi"']]);
    const { markdown } = await parseFile({ name: 'budget.csv', bytes: enc('항목,금액\n케이터링,"1,200"\n') });
    expect(markdown).toBe('| 항목 | 금액 |\n| --- | --- |\n| 케이터링 | 1,200 |');
  });

  it('표의 | 와 개행은 셀 안에서 이스케이프한다', () => {
    expect(rowsToMarkdown([['a', 'b'], ['x|y', 'l1\nl2']])).toContain('| x\\|y | l1 l2 |');
  });

  it('xlsx는 시트마다 절과 표를 만든다', async () => {
    const wb = new ExcelJS.Workbook();
    const s = wb.addWorksheet('견적');
    s.addRow(['품목', '수량']);
    s.addRow(['현수막', 3]);
    wb.addWorksheet('빈 시트');
    const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
    const { markdown, format } = await parseFile({ name: '견적.xlsx', bytes });
    expect(format).toBe('xlsx');
    expect(markdown).toBe('## 견적\n\n| 품목 | 수량 |\n| --- | --- |\n| 현수막 | 3 |');
  });

  it('docx는 제목 스타일을 Markdown 제목으로 바꾼다', async () => {
    const { markdown } = await parseFile({ name: '기획서.docx', bytes: await docx([{ style: 'Heading1', text: '개요' }, { text: '행사는 3월에 열린다.' }]) });
    expect(markdown).toContain('# 개요');
    expect(markdown).toContain('행사는 3월에 열린다.');
  });

  it('pdf는 텍스트 레이어를 읽는다', async () => {
    const { markdown } = await parseFile({ name: 'a.pdf', bytes: pdf('Venue is COEX') });
    expect(markdown).toContain('Venue is COEX');
  });

  it('지원하지 않는 형식과 빈 파일은 UnsupportedFileError다', async () => {
    await expect(parseFile({ name: 'a.exe', bytes: enc('x') })).rejects.toBeInstanceOf(UnsupportedFileError);
    await expect(parseFile({ name: 'a.txt', bytes: enc('  \n') })).rejects.toBeInstanceOf(UnsupportedFileError);
    await expect(parseFile({ name: 'a.exe', mime: 'text/plain', bytes: enc('MZ') })).rejects.toBeInstanceOf(UnsupportedFileError); // MIME은 믿지 않는다
  });
});

describe('teiEmbedder', () => {
  const vec = () => Array.from({ length: EMBEDDING_DIM }, (_, i) => i / EMBEDDING_DIM);

  it('32개씩 나눠 요청하고 순서대로 합친다', async () => {
    const calls: number[] = [];
    const fake = (async (_u: unknown, init: { body: string }) => {
      const { inputs } = JSON.parse(init.body) as { inputs: string[] };
      calls.push(inputs.length);
      return new Response(JSON.stringify(inputs.map(vec)), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await teiEmbedder('http://tei/', fake)(Array.from({ length: 70 }, (_, i) => `t${i}`));
    expect(calls).toEqual([32, 32, 6]);
    expect(out).toHaveLength(70);
  });

  it('오류 응답이나 잘못된 차원은 던진다', async () => {
    await expect(teiEmbedder('http://tei', (async () => new Response('x', { status: 503 })) as unknown as typeof fetch)(['a'])).rejects.toThrow('503');
    await expect(teiEmbedder('http://tei', (async () => new Response(JSON.stringify([[1, 2]]))) as unknown as typeof fetch)(['a'])).rejects.toThrow('차원');
  });

  it('pgvector 리터럴로 직렬화한다', () => expect(toVectorLiteral([0.5, 1])).toBe('[0.5,1]'));
});
