import { Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createClientBody, linkClientAccountBody, updateStaffAccountBody, type CreateClientBody, type LinkClientAccountBody, type UpdateStaffAccountBody,
} from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { Returns } from '../common/openapi';
import { ZodBody } from '../common/zod';
import { DirectoryService } from './directory.service';

@ApiTags('directory')
@Controller()
export class DirectoryController {
  constructor(@Inject(DirectoryService) private readonly directory: DirectoryService) {}

  @Get('users')
  @ApiOperation({ summary: '낮은 사용자 목록 (멤버 초대·담당자 지정용)' })
  @Returns('UserDto', { array: true })
  users(@Auth() user: AuthUser) {
    return this.directory.users(user);
  }

  @Get('staff-accounts')
  @ApiOperation({ summary: '직원 계정 목록 (Super Admin)', operationId: 'staffAccountsList' })
  @Returns('StaffAccountDto', { array: true })
  staffAccounts(@Auth() user: AuthUser) { return this.directory.staffAccounts(user); }

  @Patch('staff-accounts/:id')
  @ApiOperation({ summary: '직원 관리자 역할·재직 상태 변경 (Super Admin)', operationId: 'staffAccountsUpdate' })
  @Returns('StaffAccountDto')
  updateStaffAccount(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @ZodBody(updateStaffAccountBody) body: UpdateStaffAccountBody) {
    return this.directory.updateStaffAccount(user, id, body);
  }

  @Get('clients')
  @ApiOperation({ summary: '고객사 목록' })
  @Returns('ClientDto', { array: true })
  clients(@Auth() user: AuthUser) {
    return this.directory.clients(user);
  }

  @Post('clients')
  @ApiOperation({ summary: '고객사 생성 (행사 생성 화면의 + 고객사 입력. 낮은 권한 이상, 명세 F-02)' })
  @Returns('ClientDto', { created: true })
  createClient(@Auth() user: AuthUser, @ZodBody(createClientBody) body: CreateClientBody) {
    return this.directory.createClient(user, body.name);
  }

  @Get('client-accounts')
  @ApiOperation({ summary: '승인된 Client 계정과 연결된 고객사 목록 (내부 직원)', operationId: 'clientAccountsList' })
  @Returns('ClientAccountDto', { array: true })
  clientAccounts(@Auth() user: AuthUser) {
    return this.directory.clientAccounts(user);
  }

  @Put('client-accounts/:id/client')
  @ApiOperation({ summary: 'Client 계정을 고객사에 연결·해제 (Super Admin, 감사 로그 대상, 명세 F-07)', operationId: 'clientAccountsLink' })
  @Returns('ClientAccountDto')
  linkClientAccount(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @ZodBody(linkClientAccountBody) body: LinkClientAccountBody) {
    return this.directory.linkClientAccount(user, id, body.clientId);
  }
}
