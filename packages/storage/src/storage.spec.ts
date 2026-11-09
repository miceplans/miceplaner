import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gzipSync } from 'node:zlib';
import { fsStore, gzipStore, s3Store, storeFromEnv, type ObjectStore } from './index';

const bytes = new TextEncoder().encode('안녕 파일');

async function roundTrip(store: ObjectStore) {
  await store.put('events/e1/a.txt', bytes, 'text/plain');
  expect(new TextDecoder().decode(await store.get('events/e1/a.txt'))).toBe('안녕 파일');
  await store.delete('events/e1/a.txt');
  expect(await store.get('events/e1/a.txt')).toBeUndefined();
}

const dir = mkdtempSync(join(tmpdir(), 'miceplans-store-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('fsStore', () => {
  it('저장·조회·삭제', () => roundTrip(fsStore(dir)));
  it('디렉터리 밖 키는 거부한다', async () => {
    await expect(fsStore(dir).put('../evil', bytes, '')).rejects.toThrow('잘못된');
    await expect(fsStore(dir).get('/etc/passwd')).resolves.toBeUndefined();
  });
});

describe('gzipStore', () => {
  it('저장·조회·삭제', () => roundTrip(gzipStore(fsStore(dir))));
  it('내부에는 압축본이 저장되고 큰 반복 텍스트는 작아진다', async () => {
    const inner = fsStore(dir);
    const big = new TextEncoder().encode('행사 운영 문서 '.repeat(5000));
    await gzipStore(inner).put('events/e1/big', big, 'text/plain');
    const raw = await inner.get('events/e1/big');
    expect(raw!.length).toBeLessThan(big.length / 10);
    expect(await gzipStore(inner).get('events/e1/big')).toEqual(big);
  });
  it('압축 도입 전 원본은 그대로 읽는다', async () => {
    const inner = fsStore(dir);
    await inner.put('events/e1/legacy', bytes, 'text/plain');
    expect(await gzipStore(inner).get('events/e1/legacy')).toEqual(bytes);
  });
  it('깨진 gzip은 원본 그대로 돌려준다', async () => {
    const inner = fsStore(dir);
    const broken = new Uint8Array(gzipSync(bytes).subarray(0, 12));
    await inner.put('events/e1/broken', broken, '');
    expect(await gzipStore(inner).get('events/e1/broken')).toEqual(broken);
  });
});

describe('storeFromEnv', () => {
  it('설정이 없으면 null', () => expect(storeFromEnv({})).toBeNull());
  it('FILES_DIR이면 로컬 저장소', () => expect(storeFromEnv({ FILES_DIR: dir })).not.toBeNull());
});

// S3 호환 서버(MinIO 등)가 있을 때만: S3_TEST_ENDPOINT=http://127.0.0.1:9000 S3_TEST_BUCKET=t AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=…
describe.skipIf(!process.env.S3_TEST_ENDPOINT)('s3Store (S3 호환 서버)', () => {
  it('저장·조회·삭제', () => roundTrip(s3Store({ bucket: process.env.S3_TEST_BUCKET!, endpoint: process.env.S3_TEST_ENDPOINT })));
});
