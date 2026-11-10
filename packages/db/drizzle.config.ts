/** RLS 정책·권한 함수는 custom SQL migration으로 검토한다. */
export default {
  dialect: 'postgresql',
  schema: './src/drizzle-schema.ts',
  out: './drizzle',
};
