import { TranslationModule } from '@cms/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import type {
  PaginatedList,
  TranslationModuleResponseData,
} from '@cms/contracts';

import { AppsService } from '../apps/apps.service';

import type { CreateTranslationModuleDto } from './dto/create-translation-module.dto';
import type { ListTranslationModulesQueryDto } from './dto/list-translation-modules.query.dto';
import type { UpdateTranslationModuleDto } from './dto/update-translation-module.dto';
import type { FindOptionsWhere } from 'typeorm';

/**
 * Translation namespaces. A module is app-scoped or global, never both and
 * never neither (invariant Rule 2) — which is why `scope` and `appId` are
 * always set from the route here and never read from a request body.
 */
@Injectable()
export class TranslationModulesService {
  constructor(
    @InjectRepository(TranslationModule)
    private readonly modules: Repository<TranslationModule>,
    private readonly apps: AppsService,
  ) {}

  async findAllForApp(
    appId: string,
    query: ListTranslationModulesQueryDto,
  ): Promise<PaginatedList<TranslationModuleResponseData>> {
    // 404 for an app that does not exist, rather than an empty list that reads
    // as "this app has no modules yet".
    await this.apps.findEntityOrFail(appId);

    return this.paginate({ appId }, query);
  }

  /**
   * Filtered on `scope` alone, not on `appId IS NULL`. The two are equivalent —
   * `ck_modules_scope_app_id` guarantees it — and naming the scope says what is
   * meant rather than restating the constraint.
   */
  async findAllGlobal(
    query: ListTranslationModulesQueryDto,
  ): Promise<PaginatedList<TranslationModuleResponseData>> {
    return this.paginate({ scope: 'global' }, query);
  }

  async findOne(id: string): Promise<TranslationModuleResponseData> {
    return toModuleResponse(await this.findEntityOrFail(id));
  }

  /**
   * The route supplies the scope. There is no reconciliation step and no
   * validation of a body-supplied scope, because no body can supply one.
   */
  async createForApp(
    appId: string,
    dto: CreateTranslationModuleDto,
  ): Promise<TranslationModuleResponseData> {
    await this.apps.findEntityOrFail(appId);

    // No slug pre-check: `uq_modules_app_slug` is the check, and the filter
    // turns its 23505 into a 409 (typeorm Rule 5).
    return this.save({ ...dto, scope: 'app', appId });
  }

  async createGlobal(
    dto: CreateTranslationModuleDto,
  ): Promise<TranslationModuleResponseData> {
    // `uq_modules_global_slug` is partial on `scope = 'global'`, which is what
    // makes a second global `authentication` a 409. A plain
    // `UNIQUE (app_id, slug)` would have allowed it, because in Postgres NULL
    // is distinct from NULL.
    return this.save({ ...dto, scope: 'global', appId: null });
  }

  async update(
    id: string,
    dto: UpdateTranslationModuleDto,
  ): Promise<TranslationModuleResponseData> {
    const record = await this.findEntityOrFail(id);

    // Field by field, so an omitted optional cannot null a stored value — and
    // so neither `slug` nor `scope` has anywhere to sneak in.
    if (dto.name !== undefined) record.name = dto.name;
    if (dto.description !== undefined) record.description = dto.description;

    await this.modules.save(record);
    return toModuleResponse(record);
  }

  /**
   * Shared with B5: an entry is addressed through its module, and the module is
   * what decides app vs. global, so entries never carry an `appId` of their own
   * (invariant Rule 3).
   */
  async findEntityOrFail(id: string): Promise<TranslationModule> {
    const record = await this.modules.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Module not found.');
    return record;
  }

  /**
   * Every module an app sees under one slug: its own, the global one, or both.
   *
   * Two rows is the normal case, not an error — `uq_modules_app_slug` and
   * `uq_modules_global_slug` are separate partial indexes precisely so an app
   * can have a `checkout` namespace alongside a global one. Which of the two
   * wins for a given key is invariant Rule 5's business, and the runtime
   * service is where that is decided.
   */
  findForAppBySlug(
    appId: string,
    slug: string,
  ): Promise<TranslationModule[]> {
    return this.modules.find({
      where: [
        { appId, slug },
        { scope: 'global', slug },
      ],
    });
  }

  private async save(
    values: Partial<TranslationModule>,
  ): Promise<TranslationModuleResponseData> {
    const record = await this.modules.save(
      this.modules.create({
        ...values,
        description: values.description ?? null,
      }),
    );

    return toModuleResponse(record);
  }

  private async paginate(
    where: FindOptionsWhere<TranslationModule>,
    query: ListTranslationModulesQueryDto,
  ): Promise<PaginatedList<TranslationModuleResponseData>> {
    const search = query.search?.trim();
    const match = search ? ILike(`%${search}%`) : undefined;

    const [records, total] = await this.modules.findAndCount({
      // An array is OR'd, so the scope filter has to be repeated into each
      // branch — otherwise a search would leak modules from other apps.
      where: match
        ? [
            { ...where, name: match },
            { ...where, slug: match },
          ]
        : where,
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      order: { slug: 'ASC' },
    });

    return {
      records: records.map(toModuleResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}

/** Entities are never returned as-is (HTTP contract Rule 5). */
function toModuleResponse(
  record: TranslationModule,
): TranslationModuleResponseData {
  return {
    id: record.id,
    appId: record.appId,
    name: record.name,
    slug: record.slug,
    scope: record.scope,
    description: record.description,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
