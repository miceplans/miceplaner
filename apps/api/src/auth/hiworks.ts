import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { config } from '../config';

export type HiworksMember = { name: string; email: string; team?: string; subTeam?: string };

type OrgEntry = { name?: unknown; email?: unknown; mail_id?: unknown };
type OrgNode = { name?: unknown; entries?: OrgEntry[]; nodes?: OrgNode[] };

/** 최상위(조직 이름이 없는 루트)와 아래 세 팀을 뺀 모든 조직은 디자인팀의 소분류로 본다. */
const OWN_TEAMS = new Set(['기획팀', '행정팀', '개발팀']);
const DESIGN_TEAM = '디자인팀';

/** 조직도 노드 이름으로 팀·소분류를 정한다. 루트 직속 구성원은 팀이 없다. */
export function classifyTeam(nodeName: string | undefined): { team?: string; subTeam?: string } {
  if (!nodeName) return {};
  if (OWN_TEAMS.has(nodeName)) return { team: nodeName };
  return nodeName === DESIGN_TEAM ? { team: DESIGN_TEAM } : { team: DESIGN_TEAM, subTeam: nodeName };
}

const TTL_MS = 5 * 60_000;

/** 하이웍스 조직도(`GET /hrm/v2/organizations`)로 구성원 이메일을 확인한다. 별도 캐시 서버 없이 프로세스 메모리에 5분 둔다. */
@Injectable()
export class HiworksService {
  private cache: { at: number; members: Map<string, HiworksMember> } | undefined;

  /** 구성원이면 이름·이메일을, 아니면 undefined를 돌려준다. 조회에 실패하면 닫힌 채로 503이다. */
  async findMember(email: string): Promise<HiworksMember | undefined> {
    return (await this.members()).get(email.toLowerCase());
  }

  private async members(): Promise<Map<string, HiworksMember>> {
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache.members;
    const token = config.hiworksOfficeToken;
    if (!token) throw new ServiceUnavailableException('[503] OFFICE_TOKEN이 설정되지 않아 가입·로그인을 할 수 없습니다.');
    let body: unknown;
    try {
      const res = await fetch(`${config.hiworksApiUrl}/hrm/v2/organizations`, {
        // 하이웍스 조직도 API는 GET에도 이 정확한 media type을 요구한다.
        // 헤더를 생략하거나 charset 없이 보내면 202와 "content-type 오류입니다."를 돌려준다.
        headers: { 'Content-Type': 'application/json;charset=UTF-8', Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
      body = await res.json();
      // 하이웍스는 오류도 HTTP 202와 {code, message}로 돌려준다.
      if (!res.ok || !body || typeof body !== 'object' || 'code' in body) throw new Error('unexpected response');
    } catch {
      throw new ServiceUnavailableException('[502] 하이웍스 구성원 확인에 실패했습니다. 잠시 뒤 다시 시도해 주세요.');
    }
    const members = new Map<string, HiworksMember>();
    const visit = (node: OrgNode, nodeName?: string) => {
      const team = classifyTeam(nodeName);
      for (const e of node.entries ?? []) {
        // 조직도의 email은 대부분 비어 있어, 메일 아이디(mail_id)에 회사 메일 도메인을 붙여 쓴다.
        const domain = config.hiworksMailDomain;
        const address = typeof e.email === 'string' && e.email ? e.email : typeof e.mail_id === 'string' && e.mail_id && domain ? `${e.mail_id}@${domain}` : '';
        if (address) {
          const email = address.toLowerCase();
          members.set(email, { email, name: typeof e.name === 'string' && e.name ? e.name : email, ...team });
        }
      }
      for (const child of node.nodes ?? []) visit(child, typeof child.name === 'string' ? child.name : undefined);
    };
    visit(body as OrgNode);
    this.cache = { at: Date.now(), members };
    return members;
  }
}
