import { Module } from '@nestjs/common';
import { DbModule } from '../db.module';
import { EventListsController } from './event-lists.controller';
import { EventListsService } from './event-lists.service';

@Module({ imports: [DbModule], controllers: [EventListsController], providers: [EventListsService] })
export class EventListsModule {}
