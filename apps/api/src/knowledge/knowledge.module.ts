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

@Module({
  controllers: [KnowledgeController, FilesController],
  providers: [
    KnowledgeService,
    CollabClient,
    FilesService,
    JobQueue,
    // 설정이 없으면 null이다. 자격 증명·서버 주소는 서버 런타임에서만 읽는다.
    { provide: OBJECT_STORE, useFactory: () => storeFromEnv() },
    { provide: EMBEDDER, useFactory: () => (config.teiUrl ? teiEmbedder(config.teiUrl) : null) },
  ],
  exports: [KnowledgeService, CollabClient, JobQueue, EMBEDDER],
})
export class KnowledgeModule {}
