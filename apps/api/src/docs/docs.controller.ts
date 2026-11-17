import { Controller, Get, Inject, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { setDocVisibilityBody, type SetDocVisibilityBody } from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { Returns } from '../common/openapi';
import { ZodBody } from '../common/zod';
import { DocsService } from './docs.service';

@ApiTags('docs')
@Controller('events/:eventId/docs')
export class DocsController {
  constructor(@Inject(DocsService) private readonly docs: DocsService) {}

  @Get()
  @ApiOperation({ summary: '행사 문서 목록 (열람 범위는 RLS가 필터링)' })
  @Returns('EventDocDto', { array: true })
  list(@Auth() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.docs.list(user, eventId);
  }

  @Patch(':docId/visibility')
  @ApiOperation({ summary: '문서 열람 범위 변경 (PM·AM, version 검사, 감사 로그 대상)' })
  @Returns('EventDocDto')
  setVisibility(@Auth() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string, @ZodBody(setDocVisibilityBody) body: SetDocVisibilityBody) {
    return this.docs.setVisibility(user, docId, body);
  }
}
