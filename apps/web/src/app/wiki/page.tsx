import { Suspense } from 'react';
import { WikiEditor } from './wiki-editor';

/** 정적 export라 문서 id는 쿼리(`/wiki?doc=<id>`)로 받는다. */
export default function WikiPage() {
  return (
    <Suspense fallback={<p className="p-[24px] text-base text-fg-secondary">불러오는 중…</p>}>
      <WikiEditor />
    </Suspense>
  );
}
