import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { Auth, type AuthUser } from '../common/auth';
import { config } from '../config';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { Returns } from '../common/openapi';
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

  @Public()
  @Get('public-events')
  @RateLimit({ scope: 'public-events', get ipPerWindow() { return config.publicCalendarIpLimit; }, windowSeconds: 600 })
  @ApiOperation({ summary: '비로그인 공개 캘린더: 공개 표시한 행사의 행사명·기간 (명세 F-07)', operationId: 'portalPublicEvents' })
  @Returns('PublicEventDto', { array: true })
  publicEvents() {
    return this.portal.publicEvents();
  }
}
