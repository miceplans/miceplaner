import { Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createDocBody, saveDocBodyBody, searchQuery, type CreateDocBody, type SaveDocBodyBody, type SearchQuery } from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { Returns } from '../common/openapi';
import { ZodBody, ZodQuery } from '../common/zod';
import { KnowledgeService } from './knowledge.service';

@ApiTags('wiki')
@Controller()
export class KnowledgeController {
  constructor(@Inject(KnowledgeService) private readonly knowledge: KnowledgeService) {}

  @Post('events/:eventId/docs')
  @ApiOperation({ summary: '위키 문서 생성 (PM·AM, 본문 색인 포함)' })
  @Returns('DocPageDto', { created: true })
  create(@Auth() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string, @ZodBody(createDocBody) body: CreateDocBody) {
    return this.knowledge.createDoc(user, eventId, body);
  }

  @Get('docs/:docId')
  @ApiOperation({ summary: '위키 문서 본문 (열람 범위는 RLS가 강제)', operationId: 'getDocPage' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/DocPageDto' } })
  get(@Auth() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string) {
    return this.knowledge.getPage(user, docId);
  }

  @Put('docs/:docId/body')
  @ApiOperation({ summary: '위키 제목·본문 저장 (PM·AM, 마지막 저장 우선, 색인 갱신)' })
  @Returns('DocPageDto')
  save(@Auth() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string, @ZodBody(saveDocBodyBody) body: SaveDocBodyBody) {
    return this.knowledge.saveBody(user, docId, body);
  }

  @Post('docs/:docId/revisions')
  @ApiOperation({ summary: '현재 내용을 버전으로 저장 (PM·AM)' })
  @Returns('WikiRevisionDto', { created: true })
  createRevision(@Auth() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string) {
    return this.knowledge.createRevision(user, docId);
  }

  @Get('docs/:docId/revisions')
  @ApiOperation({ summary: '문서 버전 목록 (열람 범위는 RLS가 강제)' })
  @Returns('WikiRevisionDto', { array: true })
  listRevisions(@Auth() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string) {
    return this.knowledge.listRevisions(user, docId);
  }

  @Get('docs/:docId/revisions/:revisionId')
  @ApiOperation({ summary: '문서 버전 상세 (본문 포함)' })
  @Returns('WikiRevisionDetailDto')
  getRevision(@Auth() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string, @Param('revisionId', ParseUUIDPipe) revisionId: string) {
    return this.knowledge.getRevision(user, docId, revisionId);
  }

  @Post('docs/:docId/revisions/:revisionId/restore')
  @ApiOperation({ summary: '버전으로 되돌리기 (PM·AM, 현재 내용을 먼저 버전으로 남기고 감사 로그)' })
  @Returns('DocPageDto', { created: true })
  restoreRevision(@Auth() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string, @Param('revisionId', ParseUUIDPipe) revisionId: string) {
    return this.knowledge.restoreRevision(user, docId, revisionId);
  }

  @Delete('docs/:docId')
  @HttpCode(204)
  @ApiOperation({ summary: '위키 문서 삭제 (soft delete, PM·AM, 감사 로그)' })
  remove(@Auth() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string) {
    return this.knowledge.remove(user, docId);
  }

  @Get('search')
  @ApiOperation({ summary: '위키 검색 (권한 필터 후 FTS + pg_trgm 병합, 출처 포함)' })
  @Returns('SearchHitDto', { array: true })
  search(@Auth() user: AuthUser, @ZodQuery(searchQuery) query: SearchQuery) {
    return this.knowledge.search(user, query);
  }
}
