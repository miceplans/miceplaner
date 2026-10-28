import { Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { googleLoginBody, type GoogleLoginBody } from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { ZodBody } from '../common/zod';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Google OIDC ID 토큰으로 로그인해 세션 토큰을 받는다' })
  login(@ZodBody(googleLoginBody) body: GoogleLoginBody) {
    return this.auth.loginWithGoogle(body.idToken);
  }

  @Get('me')
  @ApiOperation({ summary: '현재 세션 사용자' })
  me(@Auth() user: AuthUser) {
    return this.auth.me(user.userId);
  }
}
