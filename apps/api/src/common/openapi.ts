import { applyDecorators } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, type SchemaObject } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';
import {
  addEventMemberBody, weekendWorkBody, markNotificationsReadBody, assignItemBody, authSessionDto, chatBody, changeEventMemberRoleBody, changePasswordBody, clientDto, createDocBody, createItemBody, docPageDto,
  eventDocDto, eventDto, eventItemDto, eventMemberDto, leaveBalanceDto, leaveRecordDto, loginBody, moveFileBody, notificationDto,
  proposalDto, registerBody, requestLeaveBody, rescheduleItemBody, saveDocBodyBody, searchHitDto, setClientVisibleBody, setDocVisibilityBody, updateEventBody, updateItemBody,
  fileDto, userDto, weekendWorkDto, wikiRevisionDetailDto, wikiRevisionDto,
} from '@miceplans/contracts';
import { portalEventDto, portalProgramDto } from '@miceplans/contracts/portal';

/** OpenAPI components에 올리는 계약 스키마. 웹 클라이언트(orval)의 타입 이름이 된다. */
export const API_SCHEMAS: Record<string, ZodType> = {
  LoginBody: loginBody, RegisterBody: registerBody, ChangePasswordBody: changePasswordBody, AuthSessionDto: authSessionDto, UserDto: userDto, ClientDto: clientDto,
  EventDto: eventDto, UpdateEventBody: updateEventBody, EventMemberDto: eventMemberDto, AddEventMemberBody: addEventMemberBody,
  ChangeEventMemberRoleBody: changeEventMemberRoleBody, EventItemDto: eventItemDto, CreateItemBody: createItemBody, UpdateItemBody: updateItemBody,
  AssignItemBody: assignItemBody, RescheduleItemBody: rescheduleItemBody, SetClientVisibleBody: setClientVisibleBody, NotificationDto: notificationDto,
  PortalEventDto: portalEventDto, PortalProgramDto: portalProgramDto, LeaveRecordDto: leaveRecordDto, LeaveBalanceDto: leaveBalanceDto,
  RequestLeaveBody: requestLeaveBody, WeekendWorkDto: weekendWorkDto, EventDocDto: eventDocDto, SetDocVisibilityBody: setDocVisibilityBody,
  DocPageDto: docPageDto, CreateDocBody: createDocBody, SaveDocBodyBody: saveDocBodyBody, SearchHitDto: searchHitDto, WikiRevisionDto: wikiRevisionDto,
  WikiRevisionDetailDto: wikiRevisionDetailDto, ChatBody: chatBody, ProposalDto: proposalDto, MoveFileBody: moveFileBody, FileDto: fileDto,
  WeekendWorkBody: weekendWorkBody, MarkNotificationsReadBody: markNotificationsReadBody,
};

const NAME_OF = new Map<ZodType, string>(Object.entries(API_SCHEMAS).map(([name, schema]) => [schema, name]));

/** 등록된 스키마는 $ref로, 아니면 인라인 JSON Schema(OpenAPI 3.0)로 만든다. */
/** $ref를 허용하는 스키마 형태(SchemaObject 타입에는 $ref가 없다). */
export type RefSchema = SchemaObject & { $ref?: string };

export const schemaOf = (schema: ZodType): RefSchema => {
  const name = NAME_OF.get(schema);
  return name ? { $ref: `#/components/schemas/${name}` } : (z.toJSONSchema(schema, { target: 'openapi-3.0' }) as RefSchema);
};

type ReturnsOptions = { array?: boolean; created?: boolean };
const INLINE: Record<string, RefSchema> = {
  UuidList: { type: 'array', items: { type: 'string', format: 'uuid' } },
  UpdatedCount: { type: 'object', properties: { updated: { type: 'integer' } }, required: ['updated'] },
};

/** 응답 본문 스키마를 문서에 올린다. name은 API_SCHEMAS의 이름이거나 INLINE의 이름이다. */
export const Returns = (name: string, { array = false, created = false }: ReturnsOptions = {}) => {
  const schema: RefSchema = INLINE[name] ?? { $ref: `#/components/schemas/${name}` };
  return applyDecorators((created ? ApiCreatedResponse : ApiOkResponse)({ schema: array ? { type: 'array', items: schema } : schema }));
};
