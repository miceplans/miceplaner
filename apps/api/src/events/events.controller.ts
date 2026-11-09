import { Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  addEventMemberBody, changeEventMemberRoleBody, listEventsQuery, updateEventBody,
  type AddEventMemberBody, type ListEventsQuery, type UpdateEventBody,
} from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { Returns } from '../common/openapi';
import { ZodBody, ZodQuery } from '../common/zod';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Get()
  @ApiOperation({ summary: '행사 목록 (Staff도 전체 조회, 명세 2.2)' })
  @Returns('EventDto', { array: true })
  list(@Auth() user: AuthUser, @ZodQuery(listEventsQuery) query: ListEventsQuery) {
    return this.events.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '행사 상세' })
  @Returns('EventDto')
  get(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.get(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '행사 기본 정보 수정 (마지막 저장 우선, 명세 3.2)' })
  @Returns('EventDto')
  update(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @ZodBody(updateEventBody) body: UpdateEventBody) {
    return this.events.update(user, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '행사 삭제 (PM만, 하위 항목 포함, 명세 3.1)' })
  remove(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.remove(user, id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: '행사 멤버 목록' })
  @Returns('EventMemberDto', { array: true })
  members(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.members(user, id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: '행사 멤버 추가 (PM·AM, 당사자에게 알림)' })
  @Returns('EventMemberDto', { created: true })
  addMember(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @ZodBody(addEventMemberBody) body: AddEventMemberBody) {
    return this.events.addMember(user, id, body.userId, body.role);
  }

  @Patch(':id/members/:userId')
  @ApiOperation({ summary: '행사 멤버 역할 변경 (감사 로그 대상)' })
  @Returns('EventMemberDto')
  changeMemberRole(
    @Auth() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @ZodBody(changeEventMemberRoleBody) body: { role: 'pm' | 'am' | 'member' },
  ) {
    return this.events.changeMemberRole(user, id, userId, body.role);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: '행사 멤버 삭제 (최소 1명 PM 유지, 당사자에게 알림)' })
  removeMember(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.events.removeMember(user, id, userId);
  }

  @Get(':id/clients')
  @ApiOperation({ summary: '행사에 지정된 Client 목록 (PM·AM)' })
  @Returns('UuidList')
  clients(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.clients(user, id);
  }

  @Put(':id/clients/:userId')
  @ApiOperation({ summary: '행사에 Client 지정 (감사 로그 대상, 명세 3.1)' })
  assignClient(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.events.setClient(user, id, userId, true);
  }

  @Delete(':id/clients/:userId')
  @ApiOperation({ summary: '행사에서 Client 지정 해제 (감사 로그 대상)' })
  unassignClient(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.events.setClient(user, id, userId, false);
  }
}
