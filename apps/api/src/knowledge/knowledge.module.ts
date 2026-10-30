import { Module } from '@nestjs/common';
import { CollabClient } from './collab.client';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

@Module({ controllers: [KnowledgeController], providers: [KnowledgeService, CollabClient], exports: [KnowledgeService, CollabClient] })
export class KnowledgeModule {}
