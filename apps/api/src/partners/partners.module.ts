import { Module } from '@nestjs/common';
import { DbModule } from '../db.module';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';

@Module({ imports: [DbModule], controllers: [PartnersController], providers: [PartnersService] })
export class PartnersModule {}
