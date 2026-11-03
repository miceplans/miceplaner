import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HiworksService } from './hiworks';

@Module({ controllers: [AuthController], providers: [AuthService, HiworksService], exports: [AuthService] })
export class AuthModule {}
