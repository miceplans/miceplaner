import { ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { authSessionDto, userDto } from '@miceplans/contracts';
import type { ChangePasswordBody, LoginBody, RegisterBody } from '@miceplans/contracts';
import {
  findUserByEmail, getPasswordHash, getUserById, insertUser, setInitialPasswordHash, setPasswordHash, withContext, type UserRow,
} from '@miceplans/db';
import { randomUUID } from 'node:crypto';
import type { Pool } from '@miceplans/db';
import { config } from '../config';
import { DB_POOL } from '../tokens';
import { HiworksService } from './hiworks';
import { signSession } from './jwt';
import { hashPassword, verifyPassword } from './password';

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
    return userDto.parse(user);
  }

  private async session(user: UserRow) {
    const accessToken = await signSession({ id: user.id, role: user.role });
    return authSessionDto.parse({ accessToken, user: userDto.parse(user) });
  }
}
