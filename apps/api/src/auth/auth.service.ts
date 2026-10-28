import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { authSessionDto, userDto } from '@miceplans/contracts';
import { findUserByEmail, getUserById, insertUser, updateUserName, withContext, type UserRow } from '@miceplans/db';
import { randomUUID } from 'node:crypto';
import type { Pool } from '@miceplans/db';
import { config } from '../config';
import { DB_POOL } from '../tokens';
import { verifyGoogleIdToken } from './google';
import { signSession } from './jwt';

@Injectable()
export class AuthService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  /** Google ID 토큰으로 로그인한다. 처음이면 staff 사용자를 만들고, 역할은 DB 값을 그대로 쓴다. */
  async loginWithGoogle(idToken: string) {
    const { email, name } = await verifyGoogleIdToken(idToken);
    const newId = randomUUID();
    const user = await withContext(this.pool, { workspaceId: config.workspaceId, userId: newId, role: 'staff' }, async (db) => {
      const existing = await findUserByEmail(db, email);
      if (!existing) return insertUser(db, { id: newId, name, email });
      if (existing.name !== name) return (await updateUserName(db, existing.id, name)) ?? existing;
      return existing;
    });
    const accessToken = await signSession({ id: user.id, role: user.role });
    return authSessionDto.parse({ accessToken, user: this.toDto(user) });
  }

  /** 세션 주체의 현재 프로필. 권한 회수 뒤에도 갱신된 값이 날아간다. */
  async me(userId: string) {
    const user = await withContext(this.pool, { workspaceId: config.workspaceId, userId, role: 'staff' }, (db) => getUserById(db, userId));
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없다');
    return this.toDto(user);
  }

  private toDto(user: UserRow) {
    return userDto.parse(user);
  }
}
