import { Module } from '@nestjs/common';
import { DbModule } from '../db.module';
import { AuthModule } from '../auth/auth.module';
import { DirectoryController } from './directory.controller';
import { DirectoryService } from './directory.service';

@Module({ imports: [DbModule, AuthModule], controllers: [DirectoryController], providers: [DirectoryService] })
export class DirectoryModule {}
