import { Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createDocBody, saveDocBodyBody, searchQuery, type CreateDocBody, type SaveDocBodyBody, type SearchQuery } from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { ZodBody, ZodQuery } from '../common/zod';
import { KnowledgeService } from './knowledge.service';

@ApiTags('wiki')
@Controller()
export class KnowledgeController {
  constructor(@Inject(KnowledgeService) private readonly knowledge: KnowledgeService) {}

  @Post('events/:eventId/docs')
  @ApiOperation({ summary: '위키 문서 생성 (PM·AM, 본문 색인 포함)' })
  create(@Auth() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string, @ZodBody(createDocBody) body: CreateDocBody) {
    return this.knowledge.createDoc(user, eventId, body);
  }

  @Get('docs/:docId')
  @ApiOperation({ summary: '위키 문서 본문 (열람 범위는 RLS가 강제)' })
  get(@Auth() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string) {
    return this.knowledge.getPage(user, docId);
  }

  @Put('docs/:docId/body')
  @ApiOperation({ summary: '위키 제목·본문 저장 (PM·AM, 마지막 저장 우선, 색인 갱신)' })
  save(@Auth() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string, @ZodBody(saveDocBodyBody) body: SaveDocBodyBody) {
    return this.knowledge.saveBody(user, docId, body);
  }

  @Delete('docs/:docId')
  @HttpCode(204)
  @ApiOperation({ summary: '위키 문서 삭제 (soft delete, PM·AM, 감사 로그)' })
  remove(@Auth() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string) {
    return this.knowledge.remove(user, docId);
  }

  @Get('search')
  @ApiOperation({ summary: '위키 검색 (권한 필터 후 FTS + pg_trgm 병합, 출처 포함)' })
  search(@Auth() user: AuthUser, @ZodQuery(searchQuery) query: SearchQuery) {
    return this.knowledge.search(user, query);
  }
}
