import { Controller, Get, Inject, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ServerResponse } from 'node:http';
import { chatBody, listProposalsQuery, type ChatBody, type ChatEvent, type ListProposalsQuery } from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { ZodBody, ZodQuery } from '../common/zod';
import { AiService } from './ai.service';
import { ProposalsService } from './proposals.service';

@ApiTags('ai')
@Controller()
export class AiController {
  constructor(
    @Inject(AiService) private readonly ai: AiService,
    @Inject(ProposalsService) private readonly proposals: ProposalsService,
  ) {}

  @Post('ai/chat')
  @ApiOperation({ summary: 'AI 질의 (SSE 스트리밍, 읽기와 제안만, 출처 포함)' })
  async chat(@Auth() user: AuthUser, @ZodBody(chatBody) body: ChatBody, @Res() res: ServerResponse) {
    const llm = await this.ai.prepare(user, body);
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    const send = (event: ChatEvent) => {
      if (!res.writableEnded && !res.destroyed) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };
    try {
      await this.ai.chat(user, body, llm, send, abort.signal);
    } finally {
      res.end();
    }
  }

  @Get('events/:eventId/ai/proposals')
  @ApiOperation({ summary: 'AI 제안 목록 (만든 사람과 PM·AM만)' })
  list(@Auth() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string, @ZodQuery(listProposalsQuery) query: ListProposalsQuery) {
    return this.proposals.list(user, eventId, query.status);
  }

  @Post('ai/proposals/:id/approve')
  @ApiOperation({ summary: 'AI 제안 승인·반영 (PM·AM, 충돌 시 409, 감사 로그)' })
  approve(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.proposals.approve(user, id);
  }

  @Post('ai/proposals/:id/reject')
  @ApiOperation({ summary: 'AI 제안 반려 (PM·AM, 감사 로그)' })
  reject(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.proposals.reject(user, id);
  }
}
