import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule, type SchemaObject } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';
import {
  addEventMemberBody, assignItemBody, authSessionDto, chatBody, createDocBody, docPageDto, proposalDto, saveDocBodyBody, searchHitDto, changeEventMemberRoleBody, clientDto, createItemBody, eventDocDto, eventDto,
  eventItemDto, eventMemberDto, googleLoginBody, leaveBalanceDto, leaveRecordDto, notificationDto,
  requestLeaveBody, rescheduleItemBody, setClientVisibleBody, setDocVisibilityBody, updateEventBody, updateItemBody, userDto, weekendWorkDto,
} from '@miceplans/contracts';
import { portalEventDto, portalProgramDto } from '@miceplans/contracts/portal';
import { AppModule } from './app.module';
import { config } from './config';

/** OpenAPI components에 넣을 contracts 스키마 목록. zod v4의 toJSONSchema로 변환한다. */
const API_SCHEMAS: Record<string, ZodType> = {
  GoogleLoginBody: googleLoginBody,
  AuthSessionDto: authSessionDto,
  UserDto: userDto,
  ClientDto: clientDto,
  EventDto: eventDto,
  UpdateEventBody: updateEventBody,
  EventMemberDto: eventMemberDto,
  AddEventMemberBody: addEventMemberBody,
  ChangeEventMemberRoleBody: changeEventMemberRoleBody,
  EventItemDto: eventItemDto,
  CreateItemBody: createItemBody,
  UpdateItemBody: updateItemBody,
  AssignItemBody: assignItemBody,
  RescheduleItemBody: rescheduleItemBody,
  SetClientVisibleBody: setClientVisibleBody,
  NotificationDto: notificationDto,
  PortalEventDto: portalEventDto,
  PortalProgramDto: portalProgramDto,
  LeaveRecordDto: leaveRecordDto,
  LeaveBalanceDto: leaveBalanceDto,
  RequestLeaveBody: requestLeaveBody,
  WeekendWorkDto: weekendWorkDto,
  EventDocDto: eventDocDto,
  SetDocVisibilityBody: setDocVisibilityBody,
  DocPageDto: docPageDto,
  CreateDocBody: createDocBody,
  SaveDocBodyBody: saveDocBodyBody,
  SearchHitDto: searchHitDto,
  ChatBody: chatBody,
  ProposalDto: proposalDto,
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('');
  if (config.webOrigin) app.enableCors({ origin: config.webOrigin.split(','), credentials: true });

  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('MICEPLANS API').setDescription('행사 운영 업무 API').setVersion('0.1.0').build());
  const schemas = Object.fromEntries(Object.entries(API_SCHEMAS).map(([name, schema]) => [name, z.toJSONSchema(schema)])) as Record<string, SchemaObject>;
  document.components = { ...document.components, schemas: { ...document.components?.schemas, ...schemas } };
  SwaggerModule.setup('docs', app, document);

  await app.listen(config.port);
  console.log(`MICEPLANS API listening on :${config.port} (docs: /docs)`);
}

void bootstrap();
