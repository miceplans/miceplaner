import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';
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

/** 환경 변수에서 저장소를 고른다. S3_BUCKET이 있으면 S3, FILES_DIR이 있으면 로컬, 둘 다 없으면 null(업로드는 503). */
export function storeFromEnv(env: NodeJS.ProcessEnv = process.env): ObjectStore | null {
  if (env.S3_BUCKET) return s3Store({ bucket: env.S3_BUCKET, region: env.S3_REGION, endpoint: env.S3_ENDPOINT });
  if (env.FILES_DIR) return fsStore(env.FILES_DIR);
  return null;
}
