import { Catch, type ArgumentsHost, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';

type JsonResponse = { status: (code: number) => { json: (body: unknown) => void } };

/**
 * 예상 못한 서버 오류까지 잡아 원인을 응답에 담는다.
 * HttpException은 Nest 기본 응답 형태({statusCode, message} 또는 객체 본문)를 그대로 유지한다.
 * 예상 못한 오류는 500으로 스택을 서버 로그에 남기고, 오류 이름·메시지를 본문에 담아 디버깅을 돕는다.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<JsonResponse>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(typeof body === 'object' && body !== null ? body : { statusCode: status, message: body });
      return;
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    const detail = exception instanceof Error ? `${exception.name}: ${exception.message}` : String(exception);
    res.status(500).json({ statusCode: 500, message: `[054] 서버 오류가 발생했습니다 (${detail})` });
  }
}
