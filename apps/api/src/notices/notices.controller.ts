import { Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createNoticeBody, type CreateNoticeBody } from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { Returns } from '../common/openapi';
import { ZodBody } from '../common/zod';
import { NoticesService } from './notices.service';

@ApiTags('notices')
@Controller('notices')
export class NoticesController {
  constructor(@Inject(NoticesService) private readonly notices: NoticesService) {}

  @Get()
  @ApiOperation({ summary: '내가 받은 공지 목록 (닫지 않은 공지가 최상단, 전체 공지는 내부 직원 전원·행사 공지는 행사 멤버)' })
  @Returns('NoticeDto', { array: true })
  list(@Auth() user: AuthUser) {
    return this.notices.list(user);
  }

  @Post()
  @ApiOperation({ summary: '공지 올리기 (전체 공지는 Super Admin, 행사 공지는 그 행사의 PM·AM과 Super Admin)' })
  @Returns('NoticeDto', { created: true })
  create(@Auth() user: AuthUser, @ZodBody(createNoticeBody) body: CreateNoticeBody) {
    return this.notices.create(user, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '공지 삭제 (soft delete, 작성자와 Super Admin)' })
  remove(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notices.remove(user, id);
  }

  @Post(':id/dismiss')
  @ApiOperation({ summary: '공지 닫기 (받은 사람, 닫기 전까지 목록 최상단에 고정)' })
  @Returns('NoticeDto')
  dismiss(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notices.dismiss(user, id);
  }
}
