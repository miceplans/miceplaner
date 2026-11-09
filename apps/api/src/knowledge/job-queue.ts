import { Injectable, Logger, ServiceUnavailableException, type OnModuleDestroy } from '@nestjs/common';
import type { EmbedDocJob, ParseFileJob } from '@miceplans/contracts';
import { openProducer, type Producer } from '@miceplans/queue';
import { config } from '../config';

/**
 * pg-boss 작업 큐 생산자. 처음 쓸 때 연결하므로 큐를 쓰지 않는 요청과 테스트는 pgboss 스키마 없이도 동작한다.
 * 스키마는 배포 때 `migrateQueue`로 만든다.
 */
@Injectable()
export class JobQueue implements OnModuleDestroy {
  private readonly log = new Logger(JobQueue.name);
  private producer?: Promise<Producer>;

  private open(): Promise<Producer> {
    this.producer ??= openProducer(config.databaseUrl).catch((error) => {
      this.producer = undefined; // 다음 요청에서 다시 시도한다
      throw error;
    });
    return this.producer;
  }

  /** 파일 변환 작업. 큐에 넣지 못하면 업로드를 성공으로 보여 줄 수 없어 503이다. */
  async parseFile(job: ParseFileJob): Promise<void> {
    try {
      await (await this.open()).enqueueParseFile(job);
    } catch (error) {
      this.log.error(`변환 작업을 큐에 넣지 못했다: ${String(error)}`);
      throw new ServiceUnavailableException('[503] 작업 큐에 연결하지 못했습니다.');
    }
  }

  /** 임베딩 작업. 본문 저장은 이미 끝났으므로 실패해도 저장을 되돌리지 않는다(청크의 임베딩이 비어 있을 뿐 lexical 검색은 된다). */
  async embedDoc(job: EmbedDocJob): Promise<void> {
    if (!config.teiUrl) return;
    try {
      await (await this.open()).enqueueEmbedDoc(job);
    } catch (error) {
      this.log.warn(`임베딩 작업을 큐에 넣지 못했다: ${String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.producer) await (await this.producer.catch(() => undefined))?.stop();
  }
}
