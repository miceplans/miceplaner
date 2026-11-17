import { Controller, Get, Inject, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createClientBody, type CreateClientBody } from '@miceplans/contracts';
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
}
