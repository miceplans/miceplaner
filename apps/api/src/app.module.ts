import { Controller, Get } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/auth.guard';
import { Public } from './auth/public.decorator';
import { DbModule } from './db.module';
import { DirectoryModule } from './directory/directory.module';
import { DocsModule } from './docs/docs.module';
import { EventsModule } from './events/events.module';
import { ImportModule } from './import/import.module';
import { ItemsModule } from './items/items.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { LeaveModule } from './leave/leave.module';
import { NoticesModule } from './notices/notices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PortalModule } from './portal/portal.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ScheduleNotesModule } from './schedule-notes/schedule-notes.module';
import { EventListsModule } from './event-lists/event-lists.module';
import { PartnersModule } from './partners/partners.module';

@Controller()
class HealthController {
  @Public()
  @Get('health')
  health() {
    return { ok: true };
  }
}

@Module({
  imports: [
    DbModule,
    RealtimeModule,
    AuthModule,
    EventsModule,
    ItemsModule,
    NotificationsModule,
    PortalModule,
    LeaveModule,
    NoticesModule,
    DocsModule,
    KnowledgeModule,
    AiModule,
    DirectoryModule,
    ImportModule,
    ScheduleNotesModule,
    EventListsModule,
    PartnersModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
