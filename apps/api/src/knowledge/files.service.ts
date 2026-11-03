import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Inject, Injectable, PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common';
import { fileDto, MAX_FILE_BYTES, type ListFilesQuery, type MoveFileBody } from '@miceplans/contracts';
import { canEditWiki } from '@miceplans/domain';
import { eventRole, getFile, getItem, insertFile, listFiles, moveFile, softDeleteFile, withContext, type Pool, type PoolClient } from '@miceplans/db';
import { SUPPORTED_EXTENSIONS } from '@miceplans/knowledge/parse';
import type { ObjectStore } from '@miceplans/storage';
import { AuthUser, requireInternal } from '../common/auth';
import { assertFound, assertOk, mapDbError } from '../common/http';
import { DB_POOL, OBJECT_STORE } from '../tokens';
import { JobQueue } from './job-queue';

export type Upload = { originalname: string; mimetype: string; size: number; buffer: Buffer };

/** multer는 파일명을 latin1로 해석하므로 UTF-8로 되돌리고, 경로 구분자와 제어 문자를 없앤다. */
export const cleanFileName = (raw: string): string =>
  [...Buffer.from(raw, 'latin1').toString('utf8')].map((c) => (c === '/' || c === '\\' || c.charCodeAt(0) < 32 ? '_' : c)).join('').trim().slice(0, 200);

/**
 * 파일 업로드와 목록·다운로드·삭제 (명세 F-10). 원본은 저장소에 두고, 변환은 worker가 비동기로 한다.
 * 변환 결과는 위키와 같은 event_docs·청크 RLS를 따르므로 검색과 출처가 권한을 우회하지 않는다.
 */
@Injectable()
export class FilesService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(OBJECT_STORE) private readonly store: ObjectStore | null,
    @Inject(JobQueue) private readonly queue: JobQueue,
  ) {}

  private run<T>(user: AuthUser, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    return withContext(this.pool, user, fn).catch((error) => mapDbError(error));
  }

  private requireStore(): ObjectStore {
    if (!this.store) throw new ServiceUnavailableException('파일 저장소가 설정되지 않았다 (S3_BUCKET 또는 FILES_DIR)');
    return this.store;
  }

  async upload(user: AuthUser, eventId: string, file: Upload | undefined, itemId: string | null) {
    requireInternal(user);
    if (!file) throw new BadRequestException('file 필드로 파일을 보내야 한다');
    if (file.size > MAX_FILE_BYTES) throw new PayloadTooLargeException(`파일은 ${MAX_FILE_BYTES / 1024 / 1024}MB를 넘을 수 없다`);
    const name = cleanFileName(file.originalname);
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (!name.includes('.') || !(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) throw new BadRequestException(`지원하는 형식: ${SUPPORTED_EXTENSIONS.join(', ')}`);
    const store = this.requireStore();

    // 권한(PM·AM)은 행 삽입 전에 확인한다. 원본은 권한 확인 뒤에만 저장소에 올린다.
    await this.run(user, async (db) => {
      if (!canEditWiki(await eventRole(db, eventId))) throw new ForbiddenException('파일 업로드는 PM·AM만 할 수 있다');
      if (itemId) assertFound(await getItem(db, itemId), '첨부 대상 항목');
    });
    const storageKey = `events/${eventId}/${randomUUID()}`;
    await store.put(storageKey, file.buffer, file.mimetype);
    let created;
    try {
      created = await this.run(user, (db) => insertFile(db, { eventId, itemId, name, mime: file.mimetype, sizeBytes: file.size, storageKey, uploadedBy: user.userId }));
      await this.queue.parseFile({ fileId: created.id, ctx: { workspaceId: user.workspaceId, userId: user.userId, role: user.role } });
    } catch (error) {
      await store.delete(storageKey).catch(() => undefined); // 고아 객체를 남기지 않는다
      if (created) await this.run(user, (db) => softDeleteFile(db, user.userId, created!.id)).catch(() => undefined);
      throw error;
    }
    return fileDto.parse(created);
  }

  async list(user: AuthUser, eventId: string, query: ListFilesQuery) {
    requireInternal(user);
    return (await this.run(user, (db) => listFiles(db, eventId, query))).map((f) => fileDto.parse(f));
  }

  /** 첨부 대상 항목 이동은 PM·AM만 한다. 같은 행사의 항목이어야 한다 (DB 트리거가 검사). */
  async move(user: AuthUser, id: string, body: MoveFileBody) {
    requireInternal(user);
    const row = await this.run(user, async (db) => {
      const file = assertFound(await getFile(db, id), '파일');
      if (!canEditWiki(await eventRole(db, file.eventId))) throw new ForbiddenException('파일 이동은 PM·AM만 할 수 있다');
      if (body.itemId) assertFound(await getItem(db, body.itemId), '첨부 대상 항목');
      return assertFound(await moveFile(db, id, body.itemId), '파일');
    });
    return fileDto.parse(row);
  }

  async get(user: AuthUser, id: string) {
    requireInternal(user);
    return fileDto.parse(assertFound(await this.run(user, (db) => getFile(db, id)), '파일'));
  }

  async download(user: AuthUser, id: string): Promise<{ name: string; mime: string; bytes: Uint8Array }> {
    requireInternal(user);
    const file = assertFound(await this.run(user, (db) => getFile(db, id)), '파일');
    const bytes = assertFound(await this.requireStore().get(file.storageKey), '원본 파일');
    return { name: file.name, mime: file.mime || 'application/octet-stream', bytes };
  }

  /** soft delete다. 변환 문서와 색인은 내리고 원본 객체는 보존 정책이 정해질 때까지 남긴다. */
  async remove(user: AuthUser, id: string): Promise<void> {
    requireInternal(user);
    await this.run(user, async (db) => {
      const file = assertFound(await getFile(db, id), '파일');
      if (!canEditWiki(await eventRole(db, file.eventId))) throw new ForbiddenException('파일 삭제는 PM·AM만 할 수 있다');
      assertOk(await softDeleteFile(db, user.userId, id), '파일');
    });
  }
}
