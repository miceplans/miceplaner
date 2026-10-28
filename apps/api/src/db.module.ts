import { Global, Module } from '@nestjs/common';
import { createPool, type Pool } from '@miceplans/db';
import { config } from './config';
import { DB_POOL } from './tokens';

/** Pool은 앱 전체에서 하나다. 전역으로 두어 기능 모듈이 DbModule을 일일이 import하지 않게 한다. */
@Global()
@Module({
  providers: [
    { provide: DB_POOL, useFactory: () => createPool(config.databaseUrl) },
    // 앱 종료 시 Pool을 닫는다. 그래야 테스트 워커가 끝까지 열린 핸들로 멈추지 않는다.
    {
      provide: 'DB_POOL_CLOSE',
      inject: [DB_POOL],
      useFactory: (pool: Pool) => ({ onModuleDestroy: async () => pool.end() }),
    },
  ],
  exports: [DB_POOL],
})
export class DbModule {}
