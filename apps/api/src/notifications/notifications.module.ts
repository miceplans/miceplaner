import { Module } from '@nestjs/common';
import { DbModule } from '../db.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({ imports: [DbModule], controllers: [NotificationsController], providers: [NotificationsService] })
export class NotificationsModule {}
