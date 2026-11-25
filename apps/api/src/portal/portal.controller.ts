import { Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { markPortalNotificationsReadBody, type MarkPortalNotificationsReadBody } from '@miceplans/contracts/portal';
import { Public } from '../auth/public.decorator';
import { Auth, type AuthUser } from '../common/auth';
import { config } from '../config';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { Returns } from '../common/openapi';
import { ZodBody } from '../common/zod';
import { PortalService } from './portal.service';

@ApiTags('portal')
@Controller('portal')
@UseGuards(RateLimitGuard)
export class PortalController {
  constructor(@Inject(PortalService) private readonly portal: PortalService) {}

  @Get('events')
  @ApiOperation({ summary: '내 행사 목록 (지정된 행사만, 명세 F-07)' })
  @Returns('PortalEventDto', { array: true })
  events(@Auth() user: AuthUser) {
    return this.portal.events(user);
  }

  @Get('programs')
  @ApiOperation({ summary: '내 행사의 공개 Program 일정 (Task·Subtask·담당자는 노출하지 않는다)' })
  @Returns('PortalProgramDto', { array: true })
  programs(@Auth() user: AuthUser) {
    return this.portal.programs(user);
  }

  @Get('notifications')
  @ApiOperation({ summary: '내 알림함 (공개 Program의 공개·일정 변경, 최근 30일)', operationId: 'portalNotifications' })
  @Returns('PortalNotificationDto', { array: true })
  notifications(@Auth() user: AuthUser) {
    return this.portal.notifications(user);
  }

  @Post('notifications/read')
  @HttpCode(200)
  @ApiOperation({ summary: '내 알림 읽음 처리', operationId: 'portalMarkNotificationsRead' })
  @Returns('UpdatedCount')
  markNotificationsRead(@Auth() user: AuthUser, @ZodBody(markPortalNotificationsReadBody) body: MarkPortalNotificationsReadBody) {
    return this.portal.markNotificationsRead(user, body);
  }

  @Public()
  @Get('public-events')
  @RateLimit({ scope: 'public-events', get ipPerWindow() { return config.publicCalendarIpLimit; }, windowSeconds: 600 })
  @ApiOperation({ summary: '비로그인 공개 캘린더: 공개 표시한 행사의 행사명·기간 (명세 F-07)', operationId: 'portalPublicEvents' })
  @Returns('PublicEventDto', { array: true })
  publicEvents() {
    return this.portal.publicEvents();
  }
}
