import { Module } from '@nestjs/common';
import { DbModule } from '../db.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { EventItemsController, ItemsController } from './items.controller';
import { ItemsService } from './items.service';

@Module({ imports: [DbModule, RealtimeModule], controllers: [EventItemsController, ItemsController], providers: [ItemsService] })
export class ItemsModule {}
