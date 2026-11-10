import { Controller, Get, Inject, Param, ParseUUIDPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MAX_FILE_BYTES, parseImportBody, previewImportBody, type ParseImportBody, type PreviewImportBody } from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { Returns } from '../common/openapi';
import { ZodBody } from '../common/zod';
import { ImportService } from './import.service';
import type { Upload } from '../knowledge/files.service';

@ApiTags('import')
@Controller('import')
export class ImportController {
  constructor(@Inject(ImportService) private readonly imports: ImportService) {}

  @Post('excel')
  @ApiOperation({ operationId: 'importExcelUpload', summary: 'Excel 업로드와 시트 목록 파싱 (낮은 권한 이상). 원본은 실행 완료까지 보관하고 끝나면 즉시 지운다' })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ schema: { $ref: '#/components/schemas/ImportJobDto' } })
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  // multer가 상한을 넘으면 413으로 끊는다. 파일은 메모리에 올라오므로 상한을 작게 유지한다.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }))
  upload(@Auth() user: AuthUser, @UploadedFile() file: Upload | undefined) {
    return this.imports.upload(user, file);
  }

  @Get(':id')
  @ApiOperation({ operationId: 'importGet', summary: '가져오기 작업 상태 (시트·컬럼·매핑·검증·실행 결과)' })
  @Returns('ImportJobDto')
  get(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.imports.get(user, id);
  }

  @Post(':id/parse')
  @ApiOperation({ operationId: 'importParse', summary: '시트·헤더 선택 후 원본 그리드 파싱' })
  @Returns('ImportJobDto')
  parse(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @ZodBody(parseImportBody) body: ParseImportBody) {
    return this.imports.parse(user, id, body);
  }

  @Post(':id/preview')
  @ApiOperation({ operationId: 'importPreview', summary: '컬럼 매핑으로 전체 행 검증과 미리보기 생성' })
  @Returns('ImportJobDto')
  preview(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @ZodBody(previewImportBody) body: PreviewImportBody) {
    return this.imports.preview(user, id, body);
  }

  @Post(':id/execute')
  @ApiOperation({ operationId: 'importExecute', summary: '검증 통과 행으로 행사·행사 위키 생성. 실패 행은 걸러내고 사유를 남기고, 원본은 즉시 파기한다' })
  @Returns('ImportJobDto')
  execute(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.imports.execute(user, id);
  }
}
