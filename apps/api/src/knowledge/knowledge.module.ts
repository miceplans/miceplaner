import { Module } from '@nestjs/common';
import { teiEmbedder } from '@miceplans/knowledge/embed';
import { storeFromEnv } from '@miceplans/storage';
import { config } from '../config';
import { EMBEDDER, OBJECT_STORE } from '../tokens';
import { CollabClient } from './collab.client';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { JobQueue } from './job-queue';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

const QUERY_EMBED_TIMEOUT_MS = 3_000;

@Module({
  controllers: [KnowledgeController, FilesController],
  providers: [
    KnowledgeService,
    CollabClient,
    FilesService,
    JobQueue,
    // 설정이 없으면 null이다. 자격 증명·서버 주소는 서버 런타임에서만 읽는다.
    { provide: OBJECT_STORE, useFactory: () => storeFromEnv() },
    // 질의 임베딩은 검색·AI 응답 경로에 있으므로 짧게 끊고, 실패하면 검색은 lexical만 쓴다.
    { provide: EMBEDDER, useFactory: () => (config.teiUrl ? teiEmbedder(config.teiUrl, { apiKey: config.teiApiKey, timeoutMs: QUERY_EMBED_TIMEOUT_MS }) : null) },
  ],
  exports: [KnowledgeService, CollabClient, JobQueue, EMBEDDER],
})
export class KnowledgeModule {}
