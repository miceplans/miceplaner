import { mixin, PayloadTooLargeException, type CallHandler, type ExecutionContext, type NestInterceptor, type Type } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FILE_TOO_LARGE_MESSAGE, MAX_FILE_BYTES } from '@miceplans/contracts';
import type { Observable } from 'rxjs';

/**
 * multipart 파일 하나를 메모리로 받는 인터셉터. 상한(`MAX_FILE_BYTES`, Vercel 본문 상한 4.5MB 아래)을 넘으면 multer가 끊고,
 * 그 영문 오류("File too large") 대신 다른 API 오류와 같은 `[413] ...` 한국어 문구로 바꾼다.
 */
export function SingleFileUpload(field = 'file'): Type<NestInterceptor> {
  class SingleFileUploadInterceptor extends FileInterceptor(field, { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }) {
    override async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
      try {
        return await super.intercept(context, next);
      } catch (error) {
        if (error instanceof PayloadTooLargeException) throw new PayloadTooLargeException(FILE_TOO_LARGE_MESSAGE);
        throw error;
      }
    }
  }
  return mixin(SingleFileUploadInterceptor);
}
