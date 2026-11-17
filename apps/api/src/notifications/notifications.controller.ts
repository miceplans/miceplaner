import { Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { listNotificationsQuery, markNotificationsReadBody, type ListNotificationsQuery, type MarkNotificationsReadBody } from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { Returns } from '../common/openapi';
import { ZodBody, ZodQuery } from '../common/zod';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: '내 알림 목록 (본인 것만, RLS)' })
  @Returns('NotificationDto', { array: true })
  list(@Auth() user: AuthUser, @ZodQuery(listNotificationsQuery) query: ListNotificationsQuery) {
    return this.notifications.list(user, query);
  }

  @Post('read')
  @HttpCode(200)
  @ApiOperation({ summary: '알림 읽음 처리' })
  @Returns('UpdatedCount')
  markRead(@Auth() user: AuthUser, @ZodBody(markNotificationsReadBody) body: MarkNotificationsReadBody) {
    return this.notifications.markRead(user, body);
  }
}
