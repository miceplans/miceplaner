import { z } from 'zod';
import { userDto } from './user';

/** 웹이 Google OIDC + PKCE로 받은 ID 토큰을 서버에 넘겨 세션을 만든다 (명세 F-01). */
export const googleLoginBody = z.object({ idToken: z.string().min(1) });
export type GoogleLoginBody = z.infer<typeof googleLoginBody>;

export const authSessionDto = z.object({ accessToken: z.string(), user: userDto });
export type AuthSessionDto = z.infer<typeof authSessionDto>;
