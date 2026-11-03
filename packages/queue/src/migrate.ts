import { migrateQueue } from './index';

// 배포 때 일회성으로 실행한다. DATABASE_URL은 마이그레이션 소유자 역할의 접속 문자열이다(앱 역할로는 스키마를 만들 수 없다).
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL이 필요하다 (마이그레이션 소유자 역할)');
await migrateQueue(url);
console.log('pgboss 스키마와 큐를 준비했다');
