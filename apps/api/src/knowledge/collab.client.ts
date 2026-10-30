import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { config } from '../config';

/** 협업 서버의 내부 변경 API 클라이언트. Yjs가 기준인 문서의 본문은 반드시 Yjs 트랜잭션으로 바꾼다 (명세 F-09, F-11). */
@Injectable()
export class CollabClient {
  /** 승인자·편집자의 권한으로 본문을 Markdown 내용으로 교체한다. 접속 중인 편집자에게 그대로 전파된다. */
  async replaceBody(userId: string, docId: string, markdown: string): Promise<void> {
    const collab = config.collab;
    if (!collab) throw new ServiceUnavailableException('협업 서버가 설정되지 않아 협업 편집 문서의 본문을 바꿀 수 없다');
    let status: number;
    try {
      const res = await fetch(`${collab.url}/internal/docs/${docId}/replace`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-secret': collab.secret },
        body: JSON.stringify({ userId, markdown }),
        signal: AbortSignal.timeout(15_000),
      });
      status = res.status;
    } catch {
      throw new ServiceUnavailableException('협업 서버에 연결하지 못했다');
    }
    if (status !== 200) throw new ServiceUnavailableException(`협업 서버가 변경을 거부했다 (HTTP ${status})`);
  }
}
