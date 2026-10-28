import { Module } from '@nestjs/common';
import { DbModule } from '../db.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({ imports: [DbModule], controllers: [PortalController], providers: [PortalService] })
export class PortalModule {}
