import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { authSessionDto, clientApplicationDto, userDto } from '@miceplans/contracts';
import type { ChangePasswordBody, CreateClientApplicationBody, LoginBody, RegisterBody } from '@miceplans/contracts';
import {
  approveClientApplication, createClientApplication, findUserByEmail, getPasswordHash, getUserById, insertUser, setInitialPasswordHash, setPasswordHash, withContext, type UserRow,
} from '@miceplans/db';
import { randomUUID } from 'node:crypto';
import type { Pool } from '@miceplans/db';
import { config } from '../config';
import { DB_POOL } from '../tokens';
import { HiworksService } from './hiworks';
import { signSession } from './jwt';
import { hashPassword, verifyPassword } from './password';
import type { AuthUser } from '../common/auth';

const INVALID = '[401] 이메일 또는 비밀번호가 올바르지 않습니다.';

@Injectable()
export class AuthService {
  /** 계정이 없을 때도 같은 시간이 걸리도록 비교할 더미 해시. */
  private dummyHash: Promise<string> | undefined;

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(HiworksService) private readonly hiworks: HiworksService,
  ) {}

  private readonly ctx = (userId: string) => ({ workspaceId: config.workspaceId, userId, role: 'staff' as const });

  /** 하이웍스 구성원 이메일로만 가입한다. 비밀번호가 없는 기존 계정이면 비밀번호만 설정한다. */
  async register(body: RegisterBody) {
    const member = await this.hiworks.findMember(body.email);
    if (!member) throw new ForbiddenException('[403] 하이웍스 구성원 이메일이 아닙니다.');
    const passwordHash = await hashPassword(body.password);
    const newId = randomUUID();
    const user = await withContext(this.pool, this.ctx(newId), async (db) => {
      const existing = await findUserByEmail(db, member.email);
      if (!existing) return insertUser(db, { id: newId, name: member.name, email: member.email, passwordHash });
      if (existing.role === 'client') throw new ForbiddenException('[403] 내부 사용자 계정이 아닙니다.');
      return existing;
    }).catch((error: unknown) => {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('[409] 이미 가입된 이메일입니다.');
      throw error;
    });
    if (user.id !== newId) {
      // 이미 있던 계정: 비밀번호가 없을 때만 설정한다 (본인 행이라 RLS 통과).
      const set = await withContext(this.pool, this.ctx(user.id), (db) => setInitialPasswordHash(db, user.id, passwordHash));
      if (!set) throw new ConflictException('[409] 이미 가입된 이메일입니다.');
    }
    return this.session(user);
  }

  async login(body: LoginBody) {
    const found = await withContext(this.pool, this.ctx(randomUUID()), async (db) => {
      const user = await findUserByEmail(db, body.email);
      return user ? { user, hash: await getPasswordHash(db, user.id) } : undefined;
    });
    const hash = found?.hash ?? (await (this.dummyHash ??= hashPassword(randomUUID())));
    const ok = await verifyPassword(body.password, hash);
    if (!found?.hash || !ok) {
      throw new UnauthorizedException(INVALID);
    }
    if (found.user.role === 'client') throw new ForbiddenException('[403] 내부 사용자 계정이 아닙니다.');
    // 퇴사 등으로 하이웍스 구성원에서 빠진 계정은 로그인할 수 없다.
    if (!(await this.hiworks.findMember(found.user.email))) throw new ForbiddenException('[403] 하이웍스 구성원이 아닙니다.');
    return this.session(found.user);
  }

  /** Client는 하이웍스 검증 없이, 승인된 Client 역할 계정만 포털 전용 로그인으로 쓴다. */
  async clientLogin(body: LoginBody) {
    const found = await withContext(this.pool, this.ctx(randomUUID()), async (db) => {
      const user = await findUserByEmail(db, body.email);
      return user ? { user, hash: await getPasswordHash(db, user.id) } : undefined;
    });
    const hash = found?.hash ?? (await (this.dummyHash ??= hashPassword(randomUUID())));
    if (!found?.hash || !(await verifyPassword(body.password, hash)) || found.user.role !== 'client') throw new UnauthorizedException(INVALID);
    return this.session(found.user);
  }

  /** 공개 신청은 곧바로 계정을 만들지 않는다. 모든 Super Admin에게 내부 알림을 남긴다. */
  async createClientApplication(body: CreateClientApplicationBody) {
    const passwordHash = await hashPassword(body.password);
    const application = await withContext(this.pool, this.ctx(randomUUID()), async (db) => {
      if (await findUserByEmail(db, body.email)) throw new ConflictException('[409] 이미 사용 중인 이메일입니다.');
      const row = await createClientApplication(db, { id: randomUUID(), ...body, passwordHash });
      const admins = await db.query<{ id: string }>(`SELECT id FROM users WHERE role = 'super_admin'`);
      await Promise.all(admins.rows.map(({ id }) => db.query(
        `INSERT INTO notifications (recipient_id, event_id, kind, title) VALUES ($1, NULL, 'client_application', $2)`,
        [id, `${row.companyName}의 ${row.applicantName}님이 신청하셨습니다. [${row.id}]`],
      )));
      return row;
    }).catch((error: unknown) => {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('[409] 이미 신청했거나 사용 중인 이메일입니다.');
      throw error;
    });
    return clientApplicationDto.parse(application);
  }

  /** 승인은 Client 사용자 행 생성과 상태 변경을 같은 트랜잭션으로 처리한다. */
  async approveClientApplication(user: AuthUser, applicationId: string) {
    if (user.role !== 'super_admin') throw new ForbiddenException('[403] Client 신청 승인은 Super Admin만 할 수 있습니다.');
    const application = await withContext(this.pool, user, async (db) => {
      const approved = await approveClientApplication(db, applicationId, user.userId);
      if (!approved) throw new NotFoundException('[404] 대기 중인 Client 신청을 찾을 수 없습니다.');
      await insertUser(db, { id: randomUUID(), name: approved.applicantName, email: approved.email, passwordHash: approved.passwordHash, role: 'client' });
      await db.query(`INSERT INTO audit_log (actor_id, action, detail) VALUES ($1, 'client.application.approve', $2)`, [user.userId, JSON.stringify({ applicationId, email: approved.email, companyName: approved.companyName })]);
      return approved;
    }).catch((error: unknown) => {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('[409] 이미 사용 중인 이메일입니다.');
      throw error;
    });
    return clientApplicationDto.parse(application);
  }

  async changePassword(userId: string, body: ChangePasswordBody) {
    const current = await withContext(this.pool, this.ctx(userId), (db) => getPasswordHash(db, userId));
    if (!current || !(await verifyPassword(body.currentPassword, current))) throw new UnauthorizedException('[401] 현재 비밀번호가 올바르지 않습니다.');
    const hash = await hashPassword(body.newPassword);
    await withContext(this.pool, this.ctx(userId), (db) => setPasswordHash(db, userId, hash));
  }

  /** 세션 주체의 현재 프로필. 권한 회수 뒤에도 갱신된 값이 날아간다. */
  async me(userId: string) {
    const user = await withContext(this.pool, this.ctx(userId), (db) => getUserById(db, userId));
    if (!user) throw new UnauthorizedException('[401] 사용자를 찾을 수 없습니다.');
    return userDto.parse({ ...user, ...(await this.teamOf(user.email)) });
  }

  /** 하이웍스 소속. 조회에 실패해도 프로필은 돌려주고, 팀만 비운다(화면은 일반팀 기준). */
  private async teamOf(email: string) {
    const member = await this.hiworks.findMember(email).catch(() => undefined);
    return { team: member?.team, subTeam: member?.subTeam };
  }

  private async session(user: UserRow) {
    const accessToken = await signSession({ id: user.id, role: user.role });
    return authSessionDto.parse({ accessToken, user: userDto.parse({ ...user, ...(await this.teamOf(user.email)) }) });
  }
}
