import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;
// OWASP 권장 하한(N=2^17, r=8, p=1)에 맞춘다. 메모리 128 MiB가 필요해 maxmem을 올린다.
const PARAMS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

const derive = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => scrypt(password, salt, KEYLEN, PARAMS, (e, key) => (e ? reject(e) : resolve(key))));

/** `scrypt$<salt>$<hash>` 형식. 의존성 없이 node:crypto만 쓴다. */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${(await derive(password, salt)).toString('base64')}`;
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
