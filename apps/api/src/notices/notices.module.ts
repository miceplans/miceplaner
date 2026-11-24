import { Module } from '@nestjs/common';
import { DbModule } from '../db.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NoticesController } from './notices.controller';
import { NoticesService } from './notices.service';

@Module({ imports: [DbModule, RealtimeModule], controllers: [NoticesController], providers: [NoticesService] })
export class NoticesModule {}
