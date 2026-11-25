import { Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { saveEventCalendarBlockBody, saveEventProductBody, type SaveEventCalendarBlockBody, type SaveEventProductBody } from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { Returns } from '../common/openapi';
import { ZodBody } from '../common/zod';
import { EventListsService } from './event-lists.service';

@ApiTags('event-lists')
@Controller('events/:eventId')
export class EventListsController {
  constructor(@Inject(EventListsService) private readonly lists: EventListsService) {}

  @Get('products')
  @ApiOperation({ summary: '행사 제작물(디자인 요청) 목록 (내부 직원)' })
  @Returns('EventProductDto', { array: true })
  listProducts(@Auth() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.lists.listProducts(user, eventId);
  }

  @Put('products/:id')
  @ApiOperation({ summary: '제작물 저장 (없으면 생성, 마지막 저장 우선, 행사 멤버)' })
  @Returns('EventProductDto')
  saveProduct(@Auth() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string, @Param('id', ParseUUIDPipe) id: string, @ZodBody(saveEventProductBody) body: SaveEventProductBody) {
    return this.lists.saveProduct(user, eventId, id, body);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: '제작물 삭제 (soft delete, 행사 멤버)' })
  removeProduct(@Auth() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.lists.removeProduct(user, eventId, id);
  }

  @Get('calendar-blocks')
  @ApiOperation({ summary: '행사 캘린더 일정 블록 목록 (내부 직원)' })
  @Returns('EventCalendarBlockDto', { array: true })
  listBlocks(@Auth() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.lists.listBlocks(user, eventId);
  }

  @Put('calendar-blocks/:id')
  @ApiOperation({ summary: '캘린더 일정 블록 저장 (없으면 생성, 마지막 저장 우선, 행사 멤버)' })
  @Returns('EventCalendarBlockDto')
  saveBlock(@Auth() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string, @Param('id', ParseUUIDPipe) id: string, @ZodBody(saveEventCalendarBlockBody) body: SaveEventCalendarBlockBody) {
    return this.lists.saveBlock(user, eventId, id, body);
  }

  @Delete('calendar-blocks/:id')
  @ApiOperation({ summary: '캘린더 일정 블록 삭제 (soft delete, 행사 멤버)' })
  removeBlock(@Auth() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.lists.removeBlock(user, eventId, id);
  }
}
