import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { notificationPayload, proposalDto, taskDraftsPayload, wikiEditPayload, type ProposalDto } from '@miceplans/contracts';
import { canDecideProposal, type ProposalStatus } from '@miceplans/domain';
import {
  createItem, createRevision, decideProposal, eventRole, getDocPage, getProposal, hasYdoc, insertApprovedNotification, listProposals, reindexDocPage, saveDocBody, withContext,
  type Pool, type PoolClient, type ProposalRow,
} from '@miceplans/db';
import { AuthUser, requireInternal } from '../common/auth';
import { assertFound, mapDbError, versionConflictError } from '../common/http';
import { CollabClient } from '../knowledge/collab.client';
import { JobQueue } from '../knowledge/job-queue';
import { REALTIME, type Realtime } from '../realtime/realtime.gateway';
import { DB_POOL } from '../tokens';

type Applied = { itemIds: string[]; notifiedUserId?: string; /** 트랜잭션 마지막에 협업 서버로 반영할 Yjs 본문 교체. */ afterDecision?: () => Promise<void> };

/**
 * AI 제안의 목록과 승인·반려 (명세 F-11). AI는 제안만 저장하고, 변경은 승인한 PM·AM의 권한으로
 * 이 서비스가 한 트랜잭션 안에서 반영한다. 반영이 실패하면 제안은 pending으로 남는다.
 */
@Injectable()
export class ProposalsService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(REALTIME) private readonly rt: Realtime,
    @Inject(CollabClient) private readonly collab: CollabClient,
    @Inject(JobQueue) private readonly queue: JobQueue,
  ) {}

  private run<T>(user: AuthUser, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    return withContext(this.pool, user, fn).catch((error) => mapDbError(error));
  }

  /** 만든 사람과 PM·AM만 본다 (RLS). */
  async list(user: AuthUser, eventId: string, status?: ProposalStatus): Promise<ProposalDto[]> {
    requireInternal(user);
    return (await this.run(user, (db) => listProposals(db, eventId, status))).map((r) => proposalDto.parse(r));
  }

  async approve(user: AuthUser, id: string): Promise<ProposalDto> {
    requireInternal(user);
    const { row, applied } = await this.run(user, async (db) => {
      const proposal = await this.loadPending(db, id);
      await this.requireDecider(db, proposal);
      const applied = await this.apply(db, user, proposal);
      const row = await decideProposal(db, user.userId, id, 'approved');
      if (!row) throw new ConflictException('[409] 이미 결정된 제안입니다.');
      // 외부(협업 서버) 반영은 마지막에 한다. 실패하면 결정까지 함께 되돌려 제안이 대기로 남는다.
      await applied.afterDecision?.();
      return { row, applied };
    });
    for (const itemId of applied.itemIds) this.rt.itemChanged(row.eventId, itemId);
    if (applied.notifiedUserId) this.rt.notification(applied.notifiedUserId);
    return proposalDto.parse(row);
  }

  async reject(user: AuthUser, id: string): Promise<ProposalDto> {
    requireInternal(user);
    const row = await this.run(user, async (db) => {
      const proposal = await this.loadPending(db, id);
      await this.requireDecider(db, proposal);
      const row = await decideProposal(db, user.userId, id, 'rejected');
      if (!row) throw new ConflictException('[409] 이미 결정된 제안입니다.');
      return row;
    });
    return proposalDto.parse(row);
  }

  private async loadPending(db: PoolClient, id: string): Promise<ProposalRow> {
    const proposal = assertFound(await getProposal(db, id), '제안');
    if (proposal.status !== 'pending') throw new ConflictException('[409] 이미 결정된 제안입니다.');
    return proposal;
  }

  private async requireDecider(db: PoolClient, proposal: ProposalRow) {
    if (!canDecideProposal(await eventRole(db, proposal.eventId))) throw new ForbiddenException('[403] 제안 승인은 PM·AM만 할 수 있습니다.');
  }

  private async apply(db: PoolClient, user: AuthUser, proposal: ProposalRow): Promise<Applied> {
    switch (proposal.kind) {
      case 'task_drafts': {
        const { drafts } = taskDraftsPayload.parse(proposal.payload);
        const itemIds: string[] = [];
        for (const d of drafts) {
          const item = await createItem(db, user.userId, { eventId: proposal.eventId, kind: d.kind, parentId: d.parentId, title: d.title, description: d.description, dueOn: d.dueOn, assigneeId: d.assigneeId });
          itemIds.push(item.id);
        }
        return { itemIds };
      }
      case 'notification': {
        const n = notificationPayload.parse(proposal.payload);
        await insertApprovedNotification(db, { ...n, eventId: proposal.eventId });
        return { itemIds: [], notifiedUserId: n.recipientId };
      }
      case 'wiki_edit': {
        const edit = wikiEditPayload.parse(proposal.payload);
        const doc = await getDocPage(db, edit.docId);
        // 제안을 만든 뒤 문서가 바뀌었으면 덮어쓰지 않고 충돌로 알린다 (명세 3.2).
        if (!doc || doc.version !== edit.baseVersion) throw versionConflictError(doc?.version ?? edit.baseVersion);
        await createRevision(db, user.userId, doc, 'ai_proposal');
        if (await hasYdoc(db, edit.docId)) {
          // Yjs가 기준인 문서는 서버가 협업 참여자로서 Yjs 트랜잭션을 수행한다 (명세 F-11).
          return { itemIds: [], afterDecision: () => this.collab.replaceBody(user.userId, edit.docId, edit.bodyMd) };
        }
        const saved = await saveDocBody(db, edit.docId, { bodyMd: edit.bodyMd }, edit.baseVersion);
        if (!saved) throw versionConflictError((await getDocPage(db, edit.docId))?.version ?? edit.baseVersion);
        await reindexDocPage(db, saved);
        return { itemIds: [], afterDecision: () => this.queue.embedDoc({ docId: edit.docId, ctx: { workspaceId: user.workspaceId, userId: user.userId, role: user.role } }) };
      }
    }
  }
}
