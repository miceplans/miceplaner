import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config';

const secret = () => new TextEncoder().encode(config.jwtSecret);

/** 로그인 세션 토큰을 만든다. 역할은 페이로드에 넣지만, API는 매 요청 DB 역할로 덮어 쓴다. */
export const signSession = (user: { id: string; role: string }) =>
  new SignJWT({ role: user.role }).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime('12h').sign(secret());

export const verifySession = async (token: string) => {
  const { payload } = await jwtVerify(token, secret());
  return payload;
};
