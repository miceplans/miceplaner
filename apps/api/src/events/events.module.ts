import { Module } from '@nestjs/common';
import { DbModule } from '../db.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({ imports: [DbModule, RealtimeModule, KnowledgeModule], controllers: [EventsController], providers: [EventsService] })
export class EventsModule {}
