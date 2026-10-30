import { Module } from '@nestjs/common';
import { openAiCompatible } from '@miceplans/ai';
import { config } from '../config';
import { RealtimeModule } from '../realtime/realtime.module';
import { LLM_CLIENT } from '../tokens';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ProposalsService } from './proposals.service';

@Module({
  imports: [RealtimeModule],
  controllers: [AiController],
  providers: [
    AiService,
    ProposalsService,
    // 설정이 없으면 null이고 AI 질의는 503이다. 자격 증명은 서버 런타임에서만 읽는다.
    { provide: LLM_CLIENT, useFactory: () => (config.llm ? openAiCompatible(config.llm) : null) },
  ],
})
export class AiModule {}
