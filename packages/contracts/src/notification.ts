import { z } from 'zod';
import { NOTIFICATION_KINDS } from '@miceplans/domain';
import { isoDateTime, uuid } from './common';

export const notificationKind = z.enum(NOTIFICATION_KINDS);

export const notificationDto = z.object({
  id: z.number().int().positive(),
  eventId: uuid.nullable(),
  itemId: uuid.nullable(),
  kind: notificationKind,
  title: z.string(),
  createdAt: isoDateTime,
  readAt: isoDateTime.nullable(),
});
export type NotificationDto = z.infer<typeof notificationDto>;

export const listNotificationsQuery = z.object({ unread: z.coerce.boolean().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuery>;
export const markNotificationsReadBody = z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) });
export type MarkNotificationsReadBody = z.infer<typeof markNotificationsReadBody>;
