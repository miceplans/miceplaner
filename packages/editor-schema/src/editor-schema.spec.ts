import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { markdownToPmJson, pmJsonToMarkdown } from './markdown';
import { markdownToYdoc, replaceYdocWithMarkdown, schema, stateToYdoc, ydocToMarkdown, ydocToState } from './schema';

const SAMPLE = `# 킥오프 회의록

3월 13일 **행사**를 시작한다. *담당자*에게 \`일정\`을 공유하고 [링크](https://example.com)를 확인한다.

## 할 일

- 케이터링 견적 비교
- 현수막 제작
  - 시안 확인
  - 인쇄 발주

1. 리허설
2. 본 행사

> 인용문 한 줄

\`\`\`ts
const a = 1;
\`\`\`

---

마지막 문단`;

describe('Markdown ↔ ProseMirror', () => {
  it('샘플 문서는 왕복해도 같다', () => {
    expect(pmJsonToMarkdown(markdownToPmJson(SAMPLE))).toBe(SAMPLE);
  });
  it('파싱 결과는 에디터 스키마에 맞는다', () => {
    expect(() => schema.nodeFromJSON(markdownToPmJson(SAMPLE)).check()).not.toThrow();
  });
  it('마크가 겹쳐도 보존한다', () => {
    expect(pmJsonToMarkdown(markdownToPmJson('***굵은 기울임*** 과 ~~취소~~')).trim()).toBe('***굵은 기울임*** 과 ~~취소~~');
  });
  it('빈 문서와 공백만 있는 문서는 빈 Markdown이다', () => {
    expect(pmJsonToMarkdown(markdownToPmJson(''))).toBe('');
    expect(pmJsonToMarkdown(markdownToPmJson('  \n\n'))).toBe('');
  });
  it('줄 끝 공백 두 칸은 줄바꿈이고 일반 줄바꿈은 공백이다', () => {
    const doc = markdownToPmJson('첫 줄  \n둘째 줄\n셋째 줄');
    expect(JSON.stringify(doc)).toContain('hardBreak');
    expect(pmJsonToMarkdown(doc).trim()).toBe('첫 줄  \n둘째 줄 셋째 줄');
  });
  it('이상한 입력에도 예외 없이 스키마에 맞는 문서를 만든다', () => {
    for (const md of ['#', '- ', '> ', '```', '**', '[](', '1.', '* * *', '    들여쓰기', '- a\n\n  b\n- c']) {
      expect(() => schema.nodeFromJSON(markdownToPmJson(md)).check(), md).not.toThrow();
    }
  });
});

describe('Yjs', () => {
  it('Markdown → Yjs → Markdown', () => {
    expect(ydocToMarkdown(markdownToYdoc(SAMPLE)).trim()).toBe(SAMPLE);
  });
  it('상태를 저장했다 복원해도 같다', () => {
    const restored = stateToYdoc(ydocToState(markdownToYdoc(SAMPLE)));
    expect(ydocToMarkdown(restored).trim()).toBe(SAMPLE);
  });
  it('본문 교체는 같은 문서의 트랜잭션이라 접속 중인 사본과 병합된다 (중복 없음)', () => {
    const server = markdownToYdoc('# 제목\n\n옛 내용');
    const client = stateToYdoc(ydocToState(server));
    // 서버가 AI 제안을 반영하고, 그 사이 클라이언트도 편집한다.
    server.on('update', (u: Uint8Array) => Y.applyUpdate(client, u));
    replaceYdocWithMarkdown(server, '# 제목\n\n새 내용');
    expect(ydocToMarkdown(client).trim()).toBe('# 제목\n\n새 내용');
    expect(ydocToMarkdown(server)).toBe(ydocToMarkdown(client));
  });
});
