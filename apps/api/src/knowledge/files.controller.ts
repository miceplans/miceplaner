import { Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { listFilesQuery, MAX_FILE_BYTES, moveFileBody, uploadFileFields, type ListFilesQuery, type MoveFileBody, type UploadFileFields } from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { Returns } from '../common/openapi';
import { ZodBody, ZodMultipartFields, ZodQuery } from '../common/zod';
import { FilesService, type Upload } from './files.service';

/** express Response 중 쓰는 부분만. */
type Out = { setHeader: (name: string, value: string) => void; end: (body: Buffer) => void };

@ApiTags('files')
@Controller()
export class FilesController {
  constructor(@Inject(FilesService) private readonly files: FilesService) {}

  @Post('events/:eventId/files')
  @ApiOperation({ operationId: 'uploadEventFile', summary: '파일 업로드 (PM·AM). 원본은 저장소에 두고 worker가 변환·색인한다' })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ schema: { $ref: '#/components/schemas/FileDto' } })
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, itemId: { type: 'string', format: 'uuid', nullable: true } } } })
  // multer가 상한을 넘으면 413으로 끊는다. 파일은 메모리에 올라오므로 상한을 작게 유지한다.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }))
  upload(
    @Auth() user: AuthUser,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @UploadedFile() file: Upload | undefined,
    @ZodMultipartFields(uploadFileFields) fields: UploadFileFields,
  ) {
    return this.files.upload(user, eventId, file, fields.itemId ?? null);
  }

  @Get('events/:eventId/files')
  @ApiOperation({ summary: '행사 파일 목록 (변환 전에는 PM·AM만, 변환 후에는 변환 문서를 볼 수 있는 사람). itemId로 특정 항목 첨부만 필터링', operationId: 'listEventFiles' })
  @ApiOkResponse({ schema: { type: 'array', items: { $ref: '#/components/schemas/FileDto' } } })
  list(@Auth() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string, @ZodQuery(listFilesQuery) query: ListFilesQuery) {
    return this.files.list(user, eventId, query);
  }

  @Get('files/:id')
  @ApiOperation({ summary: '파일 상태 (pending·ready·failed와 실패 사유)' })
  @Returns('FileDto')
  get(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.files.get(user, id);
  }

  @Patch('files/:id')
  @ApiOperation({ summary: '첨부 대상 항목 이동 (PM·AM). null이면 행사 루트 첨부로 옮긴다. 같은 행사의 항목이어야 한다' })
  @Returns('FileDto')
  move(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @ZodBody(moveFileBody) body: MoveFileBody) {
    return this.files.move(user, id, body);
  }

  @Get('files/:id/download')
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiOperation({ operationId: 'downloadFile', summary: '원본 다운로드 (API가 저장소에서 읽어 전달한다. 저장소 자격 증명·서명 URL을 브라우저에 주지 않는다)' })
  async download(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Out) {
    const { name, mime, bytes } = await this.files.download(user, id);
    res.setHeader('content-type', mime);
    res.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader('x-content-type-options', 'nosniff');
    res.end(Buffer.from(bytes));
  }

  @Delete('files/:id')
  @HttpCode(204)
  @ApiOperation({ operationId: 'deleteFile', summary: '파일 삭제 (soft delete, PM·AM, 변환 문서·색인 제거, 감사 로그)' })
  remove(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.files.remove(user, id);
  }
}
