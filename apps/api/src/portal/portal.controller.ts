import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, type AuthUser } from '../common/auth';
import { PortalService } from './portal.service';

@ApiTags('portal')
@Controller('portal')
export class PortalController {
  constructor(@Inject(PortalService) private readonly portal: PortalService) {}

  @Get('events')
  @ApiOperation({ summary: '내 행사 목록 (지정된 행사만, 명세 F-07)' })
  events(@Auth() user: AuthUser) {
    return this.portal.events(user);
  }

  @Get('programs')
  @ApiOperation({ summary: '내 행사의 공개 Program 일정 (Task·Subtask·담당자는 노출하지 않는다)' })
  programs(@Auth() user: AuthUser) {
    return this.portal.programs(user);
  }
}
