import { Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  assignItemBody, createItemBody, listItemsQuery, rescheduleItemBody, setClientVisibleBody, updateItemBody,
  type AssignItemBody, type CreateItemBody, type ListItemsQuery, type RescheduleItemBody, type SetClientVisibleBody, type UpdateItemBody,
} from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { Returns } from '../common/openapi';
import { ZodBody, ZodQuery } from '../common/zod';
import { ItemsService } from './items.service';

@ApiTags('items')
@Controller('events/:eventId/items')
export class EventItemsController {
  constructor(@Inject(ItemsService) private readonly items: ItemsService) {}

  @Get()
  @ApiOperation({ summary: '행사의 Program·Task·Subtask 목록 (Staff도 조회)' })
  @Returns('EventItemDto', { array: true })
  list(@Auth() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string, @ZodQuery(listItemsQuery) query: ListItemsQuery) {
    return this.items.list(user, eventId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Program·Task·Subtask 생성 (행사 멤버)' })
  @Returns('EventItemDto', { created: true })
  create(@Auth() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string, @ZodBody(createItemBody) body: CreateItemBody) {
    return this.items.create(user, eventId, body);
  }
}

@ApiTags('items')
@Controller('items')
export class ItemsController {
  constructor(@Inject(ItemsService) private readonly items: ItemsService) {}

  @Get(':id')
  @ApiOperation({ summary: '항목 상세' })
  @Returns('EventItemDto')
  get(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.items.get(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '제목·설명·파트·상태·시작일 수정 (마지막 저장 우선, 명세 3.2)' })
  @Returns('EventItemDto')
  update(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @ZodBody(updateItemBody) body: UpdateItemBody) {
    return this.items.update(user, id, body);
  }

  @Patch(':id/assignee')
  @ApiOperation({ summary: '담당자 지정 (version 검사, 담당자에게 알림)' })
  @Returns('EventItemDto')
  assign(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @ZodBody(assignItemBody) body: AssignItemBody) {
    return this.items.assign(user, id, body);
  }

  @Patch(':id/schedule')
  @ApiOperation({ summary: '일정 변경 (version 검사, 담당자에게 알림)' })
  @Returns('EventItemDto')
  reschedule(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @ZodBody(rescheduleItemBody) body: RescheduleItemBody) {
    return this.items.reschedule(user, id, body);
  }

  @Patch(':id/client-visible')
  @ApiOperation({ summary: 'Program의 Client 공개 상태 변경 (version 검사, 감사 로그 대상)' })
  @Returns('EventItemDto')
  setClientVisible(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @ZodBody(setClientVisibleBody) body: SetClientVisibleBody) {
    return this.items.setClientVisible(user, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '항목 삭제 (soft delete, 하위 포함)' })
  remove(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.items.remove(user, id);
  }
}
