import { Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  changePasswordBody, loginBody, registerBody,
  type ChangePasswordBody, type LoginBody, type RegisterBody,
} from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { ZodBody } from '../common/zod';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: '하이웍스 구성원 이메일로 가입하고 세션 토큰을 받는다', operationId: 'register' })
  @ApiCreatedResponse({ schema: { $ref: '#/components/schemas/AuthSessionDto' } })
  register(@ZodBody(registerBody) body: RegisterBody) {
    return this.auth.register(body);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '이메일·비밀번호로 로그인해 세션 토큰을 받는다', operationId: 'login' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AuthSessionDto' } })
  login(@ZodBody(loginBody) body: LoginBody) {
    return this.auth.login(body);
  }

  @Post('password')
  @HttpCode(204)
  @ApiOperation({ summary: '비밀번호 변경' })
  async changePassword(@Auth() user: AuthUser, @ZodBody(changePasswordBody) body: ChangePasswordBody) {
    await this.auth.changePassword(user.userId, body);
  }

  @Get('me')
  @ApiOperation({ summary: '현재 세션 사용자', operationId: 'getMe' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/UserDto' } })
  me(@Auth() user: AuthUser) {
    return this.auth.me(user.userId);
  }
}
