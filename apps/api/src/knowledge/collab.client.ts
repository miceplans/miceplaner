import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { config } from '../config';

/** 협업 서버의 내부 변경 API 클라이언트. Yjs가 기준인 문서의 본문은 반드시 Yjs 트랜잭션으로 바꾼다 (명세 F-09, F-11). */
@Injectable()
export class CollabClient {
  /** 승인자·편집자의 권한으로 본문을 Markdown 내용으로 교체한다. 접속 중인 편집자에게 그대로 전파된다. */
  async replaceBody(userId: string, docId: string, markdown: string): Promise<void> {
    const collab = config.collab;
    if (!collab) throw new ServiceUnavailableException('[503] 협업 서버가 설정되지 않아 협업 편집 문서의 본문을 바꿀 수 없습니다.');
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
      throw new ServiceUnavailableException('[502] 협업 서버에 연결하지 못했습니다.');
    }
    if (status !== 200) throw new ServiceUnavailableException(`[502] 협업 서버가 변경을 거부했습니다 (HTTP ${status}).`);
  }

  /**
   * API가 같은 PostgreSQL 트랜잭션으로 Yjs 상태를 커밋한 뒤, 열려 있는 협업 문서에 그 상태를 전파한다.
   * 전파 실패는 이미 커밋된 승인 결과를 되돌릴 수 없으므로 재접속 시 DB 기준 상태로 회복된다.
   */
  async syncCommittedBody(userId: string, docId: string): Promise<void> {
    const collab = config.collab;
    if (!collab) return;
    try {
      await fetch(`${collab.url}/internal/docs/${docId}/sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-secret': collab.secret },
        body: JSON.stringify({ userId }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // DB가 원본이다. 다음 연결에서 저장된 Yjs 상태를 읽으므로 여기서는 승인 결과를 실패시키지 않는다.
    }
  }

  /** 행사 멤버·역할 변경 뒤, 열린 위키 연결이 새 권한으로 다시 인증되게 한다. 협업 서버가 없는 배포에서는 RLS 저장 검사가 최후 방어선이다. */
  async revalidateEventAccess(eventId: string, userId: string): Promise<void> {
    const collab = config.collab;
    if (!collab) return;
    let status: number;
    try {
      const res = await fetch(`${collab.url}/internal/access/revalidate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-secret': collab.secret },
        body: JSON.stringify({ eventId, userId }),
        signal: AbortSignal.timeout(15_000),
      });
      status = res.status;
    } catch {
      throw new ServiceUnavailableException('[502] 협업 서버에 연결하지 못했습니다.');
    }
    if (status !== 204) throw new ServiceUnavailableException(`[502] 협업 서버가 권한 갱신을 거부했습니다 (HTTP ${status}).`);
  }
}
