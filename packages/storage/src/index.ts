import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/** 업로드 원본 저장소. 자격 증명은 서버 런타임에만 있고 브라우저에는 키도 서명 URL도 내려가지 않는다(다운로드는 API가 대신 읽어 준다). */
export type ObjectStore = {
  put: (key: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  get: (key: string) => Promise<Uint8Array | undefined>;
  delete: (key: string) => Promise<void>;
};

export function s3Store(opts: { bucket: string; region?: string; endpoint?: string }): ObjectStore {
  const client = new S3Client({ region: opts.region ?? 'ap-northeast-2', endpoint: opts.endpoint, forcePathStyle: Boolean(opts.endpoint) });
  return {
    put: async (key, bytes, contentType) => {
      await client.send(new PutObjectCommand({ Bucket: opts.bucket, Key: key, Body: bytes, ContentType: contentType, ServerSideEncryption: opts.endpoint ? undefined : 'AES256' }));
    },
    get: async (key) => {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: opts.bucket, Key: key }));
        return await res.Body?.transformToByteArray();
      } catch (error) {
        if ((error as { name?: string }).name === 'NoSuchKey') return undefined;
        throw error;
      }
    },
    delete: async (key) => { await client.send(new DeleteObjectCommand({ Bucket: opts.bucket, Key: key })); },
  };
}

/** 로컬 개발·테스트용 파일 시스템 저장소. 키가 디렉터리 밖으로 나가지 못하게 막는다. */
export function fsStore(dir: string): ObjectStore {
  const root = normalize(dir) + sep;
  const path = (key: string) => {
    const p = normalize(join(dir, key));
    if (!p.startsWith(root)) throw new Error('잘못된 저장소 키');
    return p;
  };
  return {
    put: async (key, bytes) => { await mkdir(dirname(path(key)), { recursive: true }); await writeFile(path(key), bytes); },
    get: async (key) => { try { return new Uint8Array(await readFile(path(key))); } catch (e) { if ((e as { code?: string }).code === 'ENOENT') return undefined; throw e; } },
    delete: async (key) => { await rm(path(key), { force: true }); },
  };
}

const isGzip = (bytes: Uint8Array) => bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

/**
 * 저장 용량을 줄이려고 모든 원본을 gzip으로 저장하고 읽을 때 푼다. 호출자에게는 원본 바이트만 보인다.
 * 압축 도입 전에 올린 객체는 gzip 매직 바이트가 없어 그대로 돌려준다(지원 형식은 모두 이 바이트로 시작하지 않는다).
 */
export function gzipStore(inner: ObjectStore): ObjectStore {
  return {
    put: (key, bytes, contentType) => inner.put(key, gzipSync(bytes), contentType),
    get: async (key) => {
      const bytes = await inner.get(key);
      if (!bytes || !isGzip(bytes)) return bytes;
      try {
        return new Uint8Array(gunzipSync(bytes));
      } catch {
        return bytes;
      }
    },
    delete: (key) => inner.delete(key),
  };
}

/** 환경 변수에서 저장소를 고른다. S3_BUCKET이 있으면 S3, FILES_DIR이 있으면 로컬, 둘 다 없으면 null(업로드는 503). 둘 다 gzip으로 감싼다. */
export function storeFromEnv(env: NodeJS.ProcessEnv = process.env): ObjectStore | null {
  if (env.S3_BUCKET) return gzipStore(s3Store({ bucket: env.S3_BUCKET, region: env.S3_REGION, endpoint: env.S3_ENDPOINT }));
  if (env.FILES_DIR) return gzipStore(fsStore(env.FILES_DIR));
  return null;
}
