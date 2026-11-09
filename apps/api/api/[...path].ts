// Vercel이 감지하는 함수 진입점은 작게 유지한다. 실제 Nest 의존성 그래프는 tsup 산출물 하나로 묶는다.
export { default } from '../dist/handler.cjs';
