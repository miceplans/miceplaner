import { randomUUID } from 'node:crypto';
import { Catch, type ArgumentsHost, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';

type JsonResponse = { status: (code: number) => { json: (body: unknown) => void }; setHeader?: (name: string, value: string) => void };
type RequestLike = { headers?: Record<string, string | string[] | undefined>; method?: string; url?: string };

const headerValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * 예상 못한 서버 오류를 일반 메시지와 요청 ID로만 응답한다.
 * HttpException은 Nest 기본 응답 형태({statusCode, message} 또는 객체 본문)를 그대로 유지한다.
 * 예상 못한 오류의 이름·메시지·스택(PostgreSQL 오류, 내부 URL 등)은 서버 로그에만 남기고 응답에는 담지 않는다.
 * 요청 ID는 Vercel의 `x-vercel-id`, 없으면 `x-request-id`, 그것도 없으면 새로 만든다. 로그와 응답이 같은 ID를 가진다.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const res = http.getResponse<JsonResponse>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(typeof body === 'object' && body !== null ? body : { statusCode: status, message: body });
      return;
    }
    const req = http.getRequest<RequestLike>();
    const requestId = headerValue(req.headers?.['x-vercel-id']) ?? headerValue(req.headers?.['x-request-id']) ?? randomUUID();
    this.logger.error(`[${requestId}] ${req.method ?? ''} ${req.url ?? ''} ${exception instanceof Error ? exception.stack : String(exception)}`);
    res.setHeader?.('x-request-id', requestId);
    res.status(500).json({ statusCode: 500, message: '[500] 서버 오류가 발생했습니다.', requestId });
  }
}
