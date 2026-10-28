import { Module } from '@nestjs/common';
import { DbModule } from '../db.module';
import { DirectoryController } from './directory.controller';
import { DirectoryService } from './directory.service';

@Module({ imports: [DbModule], controllers: [DirectoryController], providers: [DirectoryService] })
export class DirectoryModule {}
