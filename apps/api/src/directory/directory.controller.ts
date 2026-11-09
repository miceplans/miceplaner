import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, type AuthUser } from '../common/auth';
import { Returns } from '../common/openapi';
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
}
