import { Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { savePartnerBody, savePartnerFieldBody, type SavePartnerBody, type SavePartnerFieldBody } from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { Returns } from '../common/openapi';
import { ZodBody } from '../common/zod';
import { PartnersService } from './partners.service';

@ApiTags('partners')
@Controller()
export class PartnersController {
  constructor(@Inject(PartnersService) private readonly partners: PartnersService) {}

  @Get('partners')
  @ApiOperation({ summary: '협력사 목록 (내부 직원)' })
  @Returns('PartnerDto', { array: true })
  list(@Auth() user: AuthUser) {
    return this.partners.list(user);
  }

  @Put('partners/:id')
  @ApiOperation({ summary: '협력사 저장 (없으면 생성, 마지막 저장 우선, 내부 직원)' })
  @Returns('PartnerDto')
  save(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @ZodBody(savePartnerBody) body: SavePartnerBody) {
    return this.partners.save(user, id, body);
  }

  @Delete('partners/:id')
  @ApiOperation({ summary: '협력사 삭제 (soft delete, 내부 직원, 감사 로그)' })
  remove(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.partners.remove(user, id);
  }

  @Get('partner-fields')
  @ApiOperation({ summary: '협력사 분야 태그 목록 (내부 직원)' })
  @Returns('PartnerFieldDto', { array: true })
  listFields(@Auth() user: AuthUser) {
    return this.partners.listFields(user);
  }

  @Post('partner-fields')
  @ApiOperation({ summary: '분야 태그 추가 (내부 직원, 같은 이름이면 409)' })
  @Returns('PartnerFieldDto', { created: true })
  createField(@Auth() user: AuthUser, @ZodBody(savePartnerFieldBody) body: SavePartnerFieldBody) {
    return this.partners.createField(user, body.name);
  }

  @Put('partner-fields/:id')
  @ApiOperation({ summary: '분야 태그 이름 변경 (쓰는 협력사의 분야도 함께 변경)' })
  @Returns('PartnerFieldDto')
  renameField(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @ZodBody(savePartnerFieldBody) body: SavePartnerFieldBody) {
    return this.partners.renameField(user, id, body.name);
  }

  @Delete('partner-fields/:id')
  @ApiOperation({ summary: '분야 태그 삭제 (soft delete, 감사 로그, 협력사에 적힌 값은 유지)' })
  removeField(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.partners.removeField(user, id);
  }
}
