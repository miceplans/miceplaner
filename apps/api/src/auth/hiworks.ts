import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { config } from '../config';

export type HiworksMember = { name: string; email: string };

type OrgEntry = { name?: unknown; email?: unknown; mail_id?: unknown };
type OrgNode = { entries?: OrgEntry[]; nodes?: OrgNode[] };

const TTL_MS = 5 * 60_000;

/** 하이웍스 조직도(`GET /hrm/v2/organizations`)로 구성원 이메일을 확인한다. 별도 캐시 서버 없이 프로세스 메모리에 5분 둔다. */
@Injectable()
export class HiworksService {
  private cache: { at: number; members: Map<string, HiworksMember> } | undefined;

  /** 구성원이면 이름·이메일을, 아니면 undefined를 돌려준다. 조회에 실패하면 닫힌 채로 503이다. */
  async findMember(email: string): Promise<HiworksMember | undefined> {
    return (await this.members()).get(email.toLowerCase());
  }

  /** 목데이터 시드처럼 구성원 전체가 필요할 때 쓴다. */
  async listMembers(): Promise<HiworksMember[]> {
    return [...(await this.members()).values()];
  }

  private async members(): Promise<Map<string, HiworksMember>> {
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache.members;
    const token = config.hiworksOfficeToken;
    if (!token) throw new ServiceUnavailableException('OFFICE_TOKEN이 설정되지 않아 가입·로그인을 할 수 없다');
    let body: unknown;
    try {
      const res = await fetch(`${config.hiworksApiUrl}/hrm/v2/organizations`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
      body = await res.json();
      // 하이웍스는 오류도 HTTP 202와 {code, message}로 돌려준다.
      if (!res.ok || !body || typeof body !== 'object' || 'code' in body) throw new Error('unexpected response');
    } catch {
      throw new ServiceUnavailableException('하이웍스 구성원 확인에 실패했다. 잠시 뒤 다시 시도해 달라');
    }
    const members = new Map<string, HiworksMember>();
    const visit = (node: OrgNode) => {
      for (const e of node.entries ?? []) {
        // 조직도의 email은 대부분 비어 있어, 메일 아이디(mail_id)에 회사 메일 도메인을 붙여 쓴다.
        const domain = config.hiworksMailDomain;
        const address = typeof e.email === 'string' && e.email ? e.email : typeof e.mail_id === 'string' && e.mail_id && domain ? `${e.mail_id}@${domain}` : '';
        if (address) {
          const email = address.toLowerCase();
          members.set(email, { email, name: typeof e.name === 'string' && e.name ? e.name : email });
        }
      }
      for (const child of node.nodes ?? []) visit(child);
    };
    visit(body as OrgNode);
    this.cache = { at: Date.now(), members };
    return members;
  }
}
