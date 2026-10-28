import { Module } from '@nestjs/common';
import { DbModule } from '../db.module';
import { RealtimeGateway, REALTIME } from './realtime.gateway';

@Module({
  imports: [DbModule],
  providers: [RealtimeGateway, { provide: REALTIME, useExisting: RealtimeGateway }],
  exports: [REALTIME],
})
export class RealtimeModule {}
