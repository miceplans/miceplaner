import { Controller, Get } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/auth.guard';
import { Public } from './auth/public.decorator';
import { DbModule } from './db.module';
import { DirectoryModule } from './directory/directory.module';
import { DocsModule } from './docs/docs.module';
import { EventsModule } from './events/events.module';
import { ItemsModule } from './items/items.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { LeaveModule } from './leave/leave.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PortalModule } from './portal/portal.module';
import { RealtimeModule } from './realtime/realtime.module';

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
    DocsModule,
    KnowledgeModule,
    AiModule,
    DirectoryModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
