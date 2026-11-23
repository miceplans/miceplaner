import { Controller, Get, Inject, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { getScheduleNoteQuery, saveScheduleNoteBody, type GetScheduleNoteQuery, type SaveScheduleNoteBody } from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { Returns } from '../common/openapi';
import { ZodBody, ZodQuery } from '../common/zod';
import { ScheduleNotesService } from './schedule-notes.service';

@ApiTags('schedule-notes')
@Controller('schedule-notes')
export class ScheduleNotesController {
  constructor(@Inject(ScheduleNotesService) private readonly notes: ScheduleNotesService) {}

  @Get()
  @ApiOperation({ summary: '캘린더 일정 상세 패널 내용 (내부 직원, 저장 전이면 빈 내용과 version 0)' })
  @Returns('ScheduleNoteDto')
  get(@Auth() user: AuthUser, @ZodQuery(getScheduleNoteQuery) query: GetScheduleNoteQuery) {
    return this.notes.get(user, query.key);
  }

  @Put()
  @ApiOperation({ summary: '일정 상세 패널 내용 저장 (바뀐 필드만, 담당자는 version 충돌 검사)' })
  @Returns('ScheduleNoteDto')
  save(@Auth() user: AuthUser, @ZodBody(saveScheduleNoteBody) body: SaveScheduleNoteBody) {
    return this.notes.save(user, body);
  }
}
