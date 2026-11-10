import { BadRequestException, ConflictException, Inject, Injectable, PayloadTooLargeException } from '@nestjs/common';
import {
  importJobDto, MAX_FILE_BYTES, MAX_IMPORT_ROWS, type ImportJobDto, type ImportTargetField, type ParseImportBody, type PreviewImportBody,
} from '@miceplans/contracts';
import {
  addEventCreatorAsPm, addEventMember, auditEventImport, claimImportJobExecution, createDocPage, getImportJob, getImportJobFile,
  insertClient, insertEvent, insertImportJob, listClients, listUsers, markImportJobDone, markImportJobParsed, markImportJobPreviewed,
  withContext, type ImportJobRow, type ImportResult, type Pool, type PoolClient,
} from '@miceplans/db';
import { UnsupportedFileError } from '@miceplans/knowledge/parse';
import { AuthUser, requireInternal } from '../common/auth';
import { assertFound, mapDbError } from '../common/http';
import { DB_POOL } from '../tokens';
import { cleanFileName, type Upload } from '../knowledge/files.service';
import { listWorkbookSheets, parseSheetGrid } from './excel';
import { buildWikiBody, IMPORT_FIELD_LABELS, ISSUE_LIST_LIMIT, normalizeImportRow, validateImportRows, type FixedValues } from './validate';

/** 사용자에게 보이는 실패 사유는 짧게 자른다. */
const reason = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 300);

/** 목록이 상한을 넘으면 잘렸다는 표시만 남긴다. */
function pushIssue(list: { row: number; message: string }[], truncated: { value: boolean }, issue: { row: number; message: string }): void {
  if (list.length >= ISSUE_LIST_LIMIT) {
    truncated.value = true;
    return;
  }
  list.push(issue);
}

/**
 * Excel 일괄 가져오기 (명세 F-08). 업로드 → 시트 파싱 → 매핑·검증 → 실행의 네 단계를
 * import_jobs 한 행에 기록해 단계 사이를 오가도 상태가 유지된다.
 * 실행은 한 HTTP 요청 안에서 끝낸다. 배포 환경(vercel)에 상주 worker가 없어 pg-boss 작업으로 두면
 * 처리할 주체가 없기 때문이다. 작업 입력인 워크스페이스·실행 주체와 결과는 import_jobs에 남긴다.
 */
@Injectable()
export class ImportService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  private run<T>(user: AuthUser, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    return withContext(this.pool, user, fn).catch((error) => mapDbError(error));
  }

  private dto(row: ImportJobRow): ImportJobDto {
    return importJobDto.parse(row);
  }

  /** 1단계: 파일 업로드와 통합 문서 구조(시트 목록) 파싱. 원본 바이트는 실행 완료까지 보관한다. */
  async upload(user: AuthUser, file: Upload | undefined): Promise<ImportJobDto> {
    requireInternal(user);
    if (!file) throw new BadRequestException('[400] file 필드로 파일을 별도로 첨부해야 합니다.');
    if (file.size > MAX_FILE_BYTES) throw new PayloadTooLargeException(`[413] 파일은 ${MAX_FILE_BYTES / 1024 / 1024}MB를 넘을 수 없습니다.`);
    const name = cleanFileName(file.originalname);
    let sheets;
    try {
      sheets = await listWorkbookSheets(file.buffer, name);
    } catch (error) {
      if (error instanceof UnsupportedFileError) throw new BadRequestException(`[400] ${reason(error)}`);
      throw new BadRequestException(`[400] 파일을 읽을 수 없습니다: ${reason(error)}`);
    }
    const row = await this.run(user, (db) => insertImportJob(db, { fileName: name, file: file.buffer, sheets, createdBy: user.userId }));
    return this.dto(row);
  }

  /** 상태 조회. 단계를 오갈 때마다 클라이언트가 다시 불러 쓴다. */
  async get(user: AuthUser, id: string): Promise<ImportJobDto> {
    requireInternal(user);
    const row = await this.run(user, (db) => getImportJob(db, id));
    return this.dto(assertFound(row, '가져오기 작업'));
  }

  /** 2단계: 시트와 헤더를 정해 원본 그리드를 뽑아 저장한다. */
  async parse(user: AuthUser, id: string, body: ParseImportBody): Promise<ImportJobDto> {
    requireInternal(user);
    const row = await this.run(user, async (db) => {
      const job = assertFound(await getImportJob(db, id), '가져오기 작업');
      if (job.status !== 'uploaded' && job.status !== 'parsed') {
        throw new ConflictException('[409] 이미 검증·실행된 가져오기는 시트를 다시 선택할 수 없습니다.');
      }
      const stored = assertFound(await getImportJobFile(db, id), '가져오기 원본');
      if (!stored.file) throw new ConflictException('[409] 원본 파일이 없는 작업입니다.');
      let grid;
      try {
        grid = await parseSheetGrid(stored.file, job.fileName, body.sheet, body.hasHeader, body.headerRow);
      } catch (error) {
        throw new BadRequestException(`[400] ${reason(error)}`);
      }
      if (grid.dataRowCount > MAX_IMPORT_ROWS) {
        throw new PayloadTooLargeException(`[413] 한 번에 ${MAX_IMPORT_ROWS.toLocaleString()}행까지 가져올 수 있습니다. 파일을 나누어 올려 주세요.`);
      }
      await markImportJobParsed(db, id, {
        sheet: body.sheet,
        hasHeader: body.hasHeader,
        headerRow: body.headerRow,
        columns: grid.columns,
        rows: grid.rows,
        rowNumbers: grid.rowNumbers,
        dataRowCount: grid.dataRowCount,
      });
      return assertFound(await getImportJob(db, id), '가져오기 작업');
    });
    return this.dto(row);
  }

  /** 3단계: 컬럼 매핑으로 전체 행을 검증하고 미리보기를 만든다. */
  async preview(user: AuthUser, id: string, body: PreviewImportBody): Promise<ImportJobDto> {
    requireInternal(user);
    const row = await this.run(user, async (db) => {
      const job = assertFound(await getImportJob(db, id), '가져오기 작업');
      if (job.status !== 'parsed' && job.status !== 'previewed') {
        throw new ConflictException('[409] 시트를 먼저 선택해 주세요.');
      }
      const mapping = this.checkMapping(body.mapping);
      const fixed = Object.fromEntries(Object.entries(body.fixed ?? {}).filter(([, v]) => v !== '')) as FixedValues;
      const stored = assertFound(await getImportJobFile(db, id), '가져오기 원본');
      if (!stored.rows) throw new ConflictException('[409] 파싱된 시트 데이터가 없습니다. 시트를 다시 선택해 주세요.');
      const validation = validateImportRows(job.columns ?? [], stored.rows, stored.rowNumbers ?? stored.rows.map((_, i) => i + 1), mapping, fixed);
      await markImportJobPreviewed(db, id, mapping, fixed, validation);
      return assertFound(await getImportJob(db, id), '가져오기 작업');
    });
    return this.dto(row);
  }

  /** 매핑은 선택 사항이며 한 속성에 컬럼이 하나만 매핑돼야 한다. */
  private checkMapping(mapping: Record<string, ImportTargetField>): Record<string, ImportTargetField> {
    const entries = Object.entries(mapping);
    const seen = new Set<ImportTargetField>();
    for (const [, field] of entries) {
      if (seen.has(field)) throw new BadRequestException(`[400] ${IMPORT_FIELD_LABELS[field]}에 컬럼이 두 개 이상 매핑돼 있습니다.`);
      seen.add(field);
    }
    // JSON 객체 키는 문자열이므로 인덱스 표기를 맞춘다.
    return Object.fromEntries(entries.map(([k, f]) => [String(Number(k)), f]));
  }

  /**
   * 4단계: 검증을 통과한 행으로 행사와 행사 위키를 만들고 실패 행의 사유를 남긴다.
   * 한 행이 실패핟도 나머지는 반영한다 (명세 F-08). 모든 반영이 끝나면 원본 파일 바이트와
   * 파싱 그리드를 지운다 (원본 보관 정책: 처리 후 즉시 파기).
   */
  async execute(user: AuthUser, id: string): Promise<ImportJobDto> {
    requireInternal(user);
    return this.dto(await this.run(user, (db) => this.executeInTx(db, user, id)));
  }

  private async executeInTx(db: PoolClient, user: AuthUser, id: string): Promise<ImportJobRow> {
    assertFound(await getImportJob(db, id), '가져오기 작업');
    if (!(await claimImportJobExecution(db, id))) {
      throw new ConflictException('[409] 미리보기를 먼저 확인하거나, 이미 실행 중이거나 완료된 가져오기입니다.');
    }
    const job = assertFound(await getImportJob(db, id), '가져오기 작업');
    const mapping = job.mapping;
    if (!mapping) throw new ConflictException('[409] 컬럼 매핑이 없습니다. 매핑을 먼저 저장해 주세요.');
    const stored = assertFound(await getImportJobFile(db, id), '가져오기 원본');
    if (!stored.rows) throw new ConflictException('[409] 파싱된 시트 데이터가 없습니다. 시트를 다시 선택해 주세요.');
    const rowNumbers = stored.rowNumbers ?? stored.rows.map((_, i) => i + 1);
    const result = await this.createEvents(db, user, id, job, stored.rows, rowNumbers, mapping, job.fixed ?? {});
    await markImportJobDone(db, id, result);
    return assertFound(await getImportJob(db, id), '가져오기 작업');
  }

  /** 그리드 행마다 행사·위키를 만들고 실패·경고를 모은다. */
  private async createEvents(
    db: PoolClient,
    user: AuthUser,
    jobId: string,
    job: ImportJobRow,
    grid: string[][],
    rowNumbers: number[],
    mapping: Record<string, ImportTargetField>,
    fixed: FixedValues,
  ): Promise<ImportResult> {
    const columns = job.columns ?? [];
    // 고객사·사용자 이름 매칭용 목록. 이름 앞뒤 공백을 무시하고, 영문 대소문자도 구분하지 않는다.
    const clientsByName = new Map((await listClients(db)).map((c) => [c.name.trim().toLowerCase(), c.id]));
    const usersByName = new Map<string, string>();
    for (const u of await listUsers(db)) {
      const key = u.name.trim().toLowerCase();
      if (!usersByName.has(key)) usersByName.set(key, u.id);
    }
    const failed: { row: number; message: string }[] = [];
    const warnings: { row: number; message: string }[] = [];
    const failedTruncated = { value: false };
    const warningsTruncated = { value: false };
    let created = 0;

    for (let i = 0; i < grid.length; i++) {
      const values = grid[i]!;
      const rowNo = rowNumbers[i] ?? i + 1;
      const mapped = normalizeImportRow(values, rowNo, mapping, fixed);
      if (!mapped.ok) {
        for (const message of mapped.failures) pushIssue(failed, failedTruncated, { row: rowNo, message });
        continue;
      }
      try {
        // 고객사를 찾지 못하면 같은 이름으로 하나 만들고 같은 작업 안에서는 재사용한다.
        const key = mapped.client.trim().toLowerCase();
        let clientId = clientsByName.get(key);
        if (!clientId) {
          clientId = await insertClient(db, mapped.client.trim());
          clientsByName.set(key, clientId);
          pushIssue(warnings, warningsTruncated, { row: rowNo, message: `고객사 '${mapped.client}'을(를) 새로 만듦` });
        }
        const eventId = await insertEvent(db, {
          clientId,
          name: mapped.name,
          startDate: mapped.startDate,
          endDate: mapped.endDate,
          place: mapped.place,
          status: mapped.status,
          createdBy: user.userId,
        });
        // 첫 멤버(실행 주체를 PM으로)를 넣어야 위키를 만들고 PM을 추가할 수 있다.
        await addEventCreatorAsPm(db, eventId, user.userId);
        if (mapped.pm) {
          const pmId = usersByName.get(mapped.pm.toLowerCase());
          if (pmId && pmId !== user.userId) {
            await addEventMember(db, user.userId, eventId, pmId, 'pm'); // 당사자에게 알림이 가고 감사 로그도 남는다.
          } else if (!pmId) {
            pushIssue(warnings, warningsTruncated, { row: rowNo, message: `PM '${mapped.pm}'을(를) 찾을 수 없어 멤버로 추가하지 않음` });
          }
        }
        // 매핑된 속성과 나머지 컬럼을 함께 담아 과거 행사 위키를 만든다.
        await createDocPage(db, { eventId, title: mapped.name, visibility: 'members', bodyMd: buildWikiBody(mapped, columns, values, mapping) });
        await auditEventImport(db, eventId, user.userId, { sourceRow: rowNo, jobId });
        for (const message of mapped.warnings) pushIssue(warnings, warningsTruncated, { row: rowNo, message });
        created++;
      } catch (error) {
        pushIssue(failed, failedTruncated, { row: rowNo, message: reason(error) });
      }
    }
    return { created, failed, warnings, failedTruncated: failedTruncated.value, warningsTruncated: warningsTruncated.value, finishedAt: new Date().toISOString() };
  }
}
