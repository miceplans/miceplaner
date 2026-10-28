import { Module } from '@nestjs/common';
import { DbModule } from '../db.module';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';

@Module({ imports: [DbModule], controllers: [DocsController], providers: [DocsService] })
export class DocsModule {}
