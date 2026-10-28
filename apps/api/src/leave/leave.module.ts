import { Module } from '@nestjs/common';
import { DbModule } from '../db.module';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

@Module({ imports: [DbModule], controllers: [LeaveController], providers: [LeaveService] })
export class LeaveModule {}
