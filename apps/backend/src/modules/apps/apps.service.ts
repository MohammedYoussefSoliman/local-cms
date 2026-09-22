import { AppLocale, Locale, LocalizationApp } from '@cms/database';
import { canonicalizeLocaleCode } from '@cms/domain';
import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';

import type { AppResponseData, PaginatedList } from '@cms/contracts';

import type { CreateAppDto } from './dto/create-app.dto';
import type { ListAppsQueryDto } from './dto/list-apps.query.dto';
import type { UpdateAppDto } from './dto/update-app.dto';

@Injectable()
export class AppsService {
  constructor(
    @InjectRepository(LocalizationApp)
    private readonly apps: Repository<LocalizationApp>,
    // Injected only for the create transaction (typeorm Rule 3/4).
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: ListAppsQueryDto,
  ): Promise<PaginatedList<AppResponseData>> {
    const search = query.search?.trim();
    const match = search ? ILike(`%${search}%`) : undefined;

    const [records, total] = await this.apps.findAndCount({
      where: match ? [{ name: match }, { slug: match }] : {},
      relations: { defaultLocale: true },
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      order: { name: 'ASC' },
    });

    return {
      records: records.map(toAppResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string): Promise<AppResponseData> {
    return toAppResponse(await this.findEntityOrFail(id));
  }

  /**
   * Both writes in one transaction, because an app with no default locale is a
   * broken app: `RESOLUTION_ORDER` ends at the app's fallback, and there would
   * be nothing to fall back to. The partial unique index can enforce *one*
   * default, but it cannot create the row (typeorm Rule 4).
   */
  async create(dto: CreateAppDto): Promise<AppResponseData> {
    return this.dataSource.transaction(async (manager) => {
      const locale = await manager.findOne(Locale, {
        where: { code: canonicalizeLocaleCode(dto.defaultLocaleCode) },
      });

      if (!locale) {
        throw new NotFoundException(
          `Locale "${dto.defaultLocaleCode}" does not exist.`,
        );
      }

      if (!locale.isActive) {
        throw new UnprocessableEntityException(
          `Locale "${locale.code}" is not active and cannot be an app's default language.`,
        );
      }

      // No pre-check on the slug: `uq_apps_slug` is the check, and the filter
      // turns its 23505 into a 409 (typeorm Rule 5).
      const app = await manager.save(
        manager.create(LocalizationApp, {
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          defaultLocaleId: locale.id,
        }),
      );

      await manager.insert(AppLocale, {
        appId: app.id,
        localeId: locale.id,
        isDefault: true,
        isEnabled: true,
        fallbackLocaleId: null,
      });

      app.defaultLocale = locale;
      return toAppResponse(app);
    });
  }

  async update(id: string, dto: UpdateAppDto): Promise<AppResponseData> {
    const app = await this.findEntityOrFail(id);

    // Field by field, so an omitted optional property cannot overwrite a stored
    // value with undefined — and so `slug` has nowhere to sneak in.
    if (dto.name !== undefined) app.name = dto.name;
    if (dto.description !== undefined) app.description = dto.description;

    await this.apps.save(app);
    return toAppResponse(app);
  }

  /**
   * Shared by this service and `AppLocalesService`, which routes on `:appId`
   * and needs the same 404 rather than an empty locale list for an app that
   * does not exist.
   */
  async findEntityOrFail(id: string): Promise<LocalizationApp> {
    const app = await this.apps.findOne({
      where: { id },
      relations: { defaultLocale: true },
    });

    if (!app) throw new NotFoundException('App not found.');
    return app;
  }
}

/** Entities are never returned as-is (HTTP contract Rule 5). */
export function toAppResponse(app: LocalizationApp): AppResponseData {
  return {
    id: app.id,
    name: app.name,
    slug: app.slug,
    description: app.description,
    defaultLocaleId: app.defaultLocaleId,
    defaultLocaleCode: app.defaultLocale.code,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  };
}
