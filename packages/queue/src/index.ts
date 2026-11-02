import { PgBoss } from 'pg-boss';
import { embedDocJob, JOB_EMBED_DOC, JOB_PARSE_FILE, parseFileJob, type EmbedDocJob, type ParseFileJob } from '@miceplans/contracts';

/** pg-boss 스키마 이름. 앱 테이블과 분리되어 있고 RLS 대상 데이터(본문 등)는 담지 않는다. 작업 입력에는 ID와 주체만 있다. */
const SCHEMA = 'pgboss';
/** 실패한 작업을 다시 시도하는 횟수. 마지막 시도에서도 던지면 작업은 failed로 남는다. */
const RETRY_LIMIT = 3;
const QUEUES = [JOB_PARSE_FILE, JOB_EMBED_DOC] as const;

/**
 * 스키마와 큐를 만들고 앱 역할에 권한을 준다. 스키마 생성 권한이 필요하므로 마이그레이션 소유자 역할로 배포 때 한 번 실행한다.
 * 앱·worker 역할(miceplans_app)은 DDL 권한 없이 이 스키마의 작업 테이블만 읽고 쓴다.
 */
export async function migrateQueue(adminUrl: string, appRole = 'miceplans_app'): Promise<void> {
  const boss = new PgBoss({ connectionString: adminUrl, schema: SCHEMA, supervise: false, schedule: false });
  boss.on('error', () => {});
  await boss.start();
  try {
    for (const name of QUEUES) await boss.createQueue(name, { retryLimit: RETRY_LIMIT, retryBackoff: true, deleteAfterSeconds: 7 * 24 * 3600 });
    const role = `"${appRole.replace(/"/g, '""')}"`;
    await boss.getDb().executeSql(
      `GRANT USAGE ON SCHEMA ${SCHEMA} TO ${role}; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${SCHEMA} TO ${role}; GRANT USAGE ON ALL SEQUENCES IN SCHEMA ${SCHEMA} TO ${role}; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${SCHEMA} TO ${role};`,
    );
  } finally {
    await boss.stop({ graceful: false });
  }
}

export type Producer = {
  enqueueParseFile: (job: ParseFileJob) => Promise<void>;
  enqueueEmbedDoc: (job: EmbedDocJob) => Promise<void>;
  stop: () => Promise<void>;
};

/** API·협업 서버처럼 작업을 넣기만 하는 쪽. 유지보수 작업은 worker가 한다. */
export async function openProducer(url: string): Promise<Producer> {
  const boss = new PgBoss({ connectionString: url, schema: SCHEMA, migrate: false, supervise: false, schedule: false, max: 2 });
  boss.on('error', (e) => console.error('[queue]', e));
  await boss.start();
  return {
    enqueueParseFile: async (job) => { await boss.send(JOB_PARSE_FILE, parseFileJob.parse(job)); },
    // 같은 문서의 임베딩 요청은 짧은 시간 안에 하나로 합친다(협업 저장이 잦다).
    enqueueEmbedDoc: async (job) => { await boss.send(JOB_EMBED_DOC, embedDocJob.parse(job), { singletonKey: job.docId, singletonSeconds: 30 }); },
    stop: () => boss.stop({ graceful: true, timeout: 5000 }),
  };
}

/** final이 true면 더 이상 재시도하지 않는다. 처리 쪽은 이때 실패를 사용자에게 보이게 기록한다. */
export type Attempt = { final: boolean };
export type WorkerHandlers = {
  parseFile: (job: ParseFileJob, attempt: Attempt) => Promise<void>;
  embedDoc: (job: EmbedDocJob, attempt: Attempt) => Promise<void>;
};

/** 작업을 받아 처리한다. 처리가 던지면 pg-boss가 재시도 정책에 따라 다시 실행한다. */
export async function runWorker(url: string, handlers: WorkerHandlers): Promise<{ stop: () => Promise<void> }> {
  const boss = new PgBoss({ connectionString: url, schema: SCHEMA, migrate: false, max: 4 });
  boss.on('error', (e) => console.error('[queue]', e));
  await boss.start();
  await boss.work(JOB_PARSE_FILE, { batchSize: 1 }, async ([job]) => { await handlers.parseFile(parseFileJob.parse(job!.data), { final: job!.retryCount >= RETRY_LIMIT }); });
  await boss.work(JOB_EMBED_DOC, { batchSize: 1 }, async ([job]) => { await handlers.embedDoc(embedDocJob.parse(job!.data), { final: job!.retryCount >= RETRY_LIMIT }); });
  return { stop: () => boss.stop({ graceful: true, timeout: 10_000 }) };
}
