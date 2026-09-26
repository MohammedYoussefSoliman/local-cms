import { TranslationValue } from '@cms/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type SelectQueryBuilder } from 'typeorm';

import type { DraftValueRow, PaginatedList } from '@cms/contracts';
import type { TextDirection, TranslationStatus } from '@cms/domain';

import { AppsService } from '../apps/apps.service';

import { ListDraftsQueryDto } from './dto/list-drafts.query.dto';

/** Everything the drafts queue lists: saved, and not live. */
const UNPUBLISHED: TranslationStatus[] = ['draft', 'in_review'];

type RawDraftRow = {
  id: string;
  entryId: string;
  key: string;
  contentType: DraftValueRow['contentType'];
  moduleId: string;
  moduleName: string;
  moduleSlug: string;
  localeCode: string;
  localeDirection: TextDirection;
  value: string;
  status: TranslationStatus;
  version: string | number;
  updatedAt: Date;
  updatedByName: string | null;
};

/**
 * The read model behind the dashboard's drafts queue.
 *
 * A separate service rather than a method on `TranslationsService` for the same
 * reason B8's runtime read is separate: a narrow read model does not reach
 * through the write path to get its data.
 */
@Injectable()
export class DraftsService {
  constructor(
    @InjectRepository(TranslationValue)
    private readonly values: Repository<TranslationValue>,
    private readonly apps: AppsService,
  ) {}

  /**
   * Every unpublished value in one app, newest first.
   *
   * Two queries total — the count and the page — regardless of how many
   * modules or entries the app has. A per-module fan-out here is the N+1 that
   * makes a 40-module app 40 round trips for a screen that shows twenty rows.
   */
  async findAll(
    appId: string,
    query: ListDraftsQueryDto,
  ): Promise<PaginatedList<DraftValueRow>> {
    // Ask the service, not the repository: an unknown app is a 404, not an
    // empty queue that looks like "nothing to publish".
    await this.apps.findEntityOrFail(appId);

    const { page, limit, search } = query;

    const total = await this.buildQuery(appId, search).getCount();

    const rows = await this.buildQuery(appId, search)
      .select('value.id', 'id')
      .addSelect('value.entryId', 'entryId')
      .addSelect('entry.key', 'key')
      .addSelect('entry.contentType', 'contentType')
      .addSelect('module.id', 'moduleId')
      .addSelect('module.name', 'moduleName')
      .addSelect('module.slug', 'moduleSlug')
      .addSelect('locale.code', 'localeCode')
      .addSelect('locale.direction', 'localeDirection')
      .addSelect('value.value', 'value')
      .addSelect('value.status', 'status')
      .addSelect('value.version', 'version')
      .addSelect('value.updatedAt', 'updatedAt')
      .addSelect('author.name', 'updatedByName')
      .orderBy('value.updatedAt', 'DESC')
      // `limit`/`offset`, not `take`/`skip`: the latter make TypeORM emit a
      // distinct-id subquery that does not apply to a raw select.
      .limit(limit)
      .offset((page - 1) * limit)
      .getRawMany<RawDraftRow>();

    return {
      records: rows.map(toDraftRow),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  /**
   * One WHERE clause, shared by the page and its count, so the two can never
   * disagree about how many drafts exist — which is also why there is no
   * separate `/drafts/count` route.
   */
  private buildQuery(
    appId: string,
    search?: string,
  ): SelectQueryBuilder<TranslationValue> {
    const query = this.values
      .createQueryBuilder('value')
      .innerJoin('value.entry', 'entry')
      .innerJoin('entry.module', 'module')
      .innerJoin('value.locale', 'locale')
      // LEFT, not INNER. `updated_by` is ON DELETE SET NULL and the importer
      // writes null deliberately, so an inner join would silently hide every
      // imported draft along with anything written by a deleted account.
      .leftJoin('value.updatedByUser', 'author')
      // Filtered in the WHERE clause and never afterwards. The leak this
      // prevents is the mirror image of the runtime read's: there, a draft
      // reaching a storefront; here, a published value sitting in a queue that
      // claims nothing is live yet.
      .where('value.status IN (:...statuses)', { statuses: UNPUBLISHED })
      // Global modules are excluded: a global value belongs to no single app,
      // and publishing it from one app's queue would make it live in every
      // other app at once.
      .andWhere('module.appId = :appId', { appId });

    if (search) {
      query.andWhere('entry.key ILIKE :search', { search: `%${search}%` });
    }

    return query;
  }
}

/** Entities are never returned as-is (HTTP contract Rule 5). */
function toDraftRow(row: RawDraftRow): DraftValueRow {
  return {
    id: row.id,
    entryId: row.entryId,
    key: row.key,
    contentType: row.contentType,
    moduleId: row.moduleId,
    moduleName: row.moduleName,
    moduleSlug: row.moduleSlug,
    localeCode: row.localeCode,
    localeDirection: row.localeDirection,
    value: row.value,
    status: row.status,
    version: Number(row.version),
    updatedAt: row.updatedAt.toISOString(),
    updatedByName: row.updatedByName,
  };
}
