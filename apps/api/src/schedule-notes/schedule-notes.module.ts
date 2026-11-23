import { Module } from '@nestjs/common';
import { DbModule } from '../db.module';
import { ScheduleNotesController } from './schedule-notes.controller';
import { ScheduleNotesService } from './schedule-notes.service';

@Module({ imports: [DbModule], controllers: [ScheduleNotesController], providers: [ScheduleNotesService] })
export class ScheduleNotesModule {}
