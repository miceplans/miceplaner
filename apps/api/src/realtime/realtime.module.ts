import { Module } from '@nestjs/common';
import { RealtimeClient, REALTIME } from './realtime.client';

@Module({
  providers: [RealtimeClient, { provide: REALTIME, useExisting: RealtimeClient }],
  exports: [REALTIME],
})
export class RealtimeModule {}
