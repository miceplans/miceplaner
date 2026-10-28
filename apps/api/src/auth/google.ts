import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

/** Google OIDC ID 토큰을 검증해 워크스페이스 로그인에 필요한 정볼만 돌려준다 (명세 F-01). */
export const verifyGoogleIdToken = async (idToken: string): Promise<{ email: string; name: string }> => {
  if (!config.googleClientId) throw new ServiceUnavailableException('GOOGLE_CLIENT_ID이 설정되지 않아 로그인할 수 없다');
  jwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS));
  const { payload } = await jwtVerify(idToken, jwks, { issuer: GOOGLE_ISSUERS, audience: config.googleClientId });
  if (config.googleWorkspaceDomain && payload.hd !== config.googleWorkspaceDomain) {
    throw new ForbiddenException('허용된 워크스페이스 계정이 아니다');
  }
  if (typeof payload.email !== 'string' || payload.email_verified !== true) {
    throw new ForbiddenException('검증된 이메일이 아니다');
  }
  return { email: payload.email, name: typeof payload.name === 'string' && payload.name ? payload.name : payload.email };
};
