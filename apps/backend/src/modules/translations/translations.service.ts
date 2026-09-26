import {
  Locale,
  TranslationEntry,
  TranslationModule,
  TranslationValue,
  TranslationValueVersion,
} from '@cms/database';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import type {
  PaginatedList,
  TranslationConflictData,
  TranslationHistoryData,
  TranslationValueResponseData,
} from '@cms/contracts';
import type { TranslationStatus } from '@cms/domain';


import { AppLocalesService } from '../apps/app-locales.service';
import { AppsService } from '../apps/apps.service';
import { EntriesService } from '../entries/entries.service';
import { LocalesService } from '../locales/locales.service';
import { TranslationModulesService } from '../translation-modules/translation-modules.service';

import { prepareValue } from './content-validation';

import type { ChangeNoteDto } from './dto/change-note.dto';
import type { ListHistoryQueryDto } from './dto/list-history.query.dto';
import type { UpsertTranslationDto } from './dto/upsert-translation.dto';
import type { EntityManager } from 'typeorm';

/**
 * The write path for localized strings, and the only place a
 * `translation_values` row is created or changed.
 *
 * Two things make this the core ticket. Every write is a pair — the value and
 * its append-only history row — so every write is a transaction (typeorm
 * Rule 4). And two editors on the same key is the expected case, not the
 * exotic one, so every write is guarded by the row's version (invariant
 * Rule 7).
 */
@Injectable()
export class TranslationsService {
  constructor(
    @InjectRepository(TranslationValue)
    private readonly values: Repository<TranslationValue>,
    @InjectRepository(TranslationValueVersion)
    private readonly versions: Repository<TranslationValueVersion>,
    private readonly entries: EntriesService,
    private readonly modules: TranslationModulesService,
    private readonly apps: AppsService,
    private readonly appLocales: AppLocalesService,
    private readonly locales: LocalesService,
    // Injected only for the transactions below (typeorm Rule 3/4).
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create or replace one language's value for one entry.
   *
   * The order of the checks is the contract, and each failure has its own code:
   * unknown language 404, language the module does not serve 422, content the
   * `contentType` refuses 422, stale `expectedVersion` 409.
   */
  async upsert(
    entryId: string,
    localeCode: string,
    dto: UpsertTranslationDto,
    userId: string,
  ): Promise<TranslationValueResponseData> {
    const entry = await this.entries.findEntityOrFail(entryId);
    const module = await this.modules.findEntityOrFail(entry.moduleId);
    const locale = await this.resolveLocaleOrFail(localeCode);

    await this.assertLocaleServesModule(module, locale);
    await this.assertCanEditApp(userId, module.appId);

    const value = prepareValue({
      contentType: entry.contentType,
      value: dto.value,
      localeCode: locale.code,
      reference: await this.findIcuReference(entry, module, locale),
    });

    return this.dataSource.transaction(async (manager) => {
      /**
       * `FOR UPDATE` rather than a compare-and-set on `version`: it serializes
       * two concurrent writers on this row, so the second one reads the version
       * the first just wrote and loses with a 409. Rebuilding the check as a
       * conditional UPDATE would mean assigning `version` by hand, which is
       * TypeORM's to own (typeorm Rule 8).
       */
      const existing = await manager.findOne(TranslationValue, {
        where: { entryId: entry.id, localeId: locale.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!existing) {
        // First value for this language. A concurrent insert loses on
        // `uq_values_entry_locale`, which the filter turns into a 409
        // (typeorm Rule 5) — there is no row to lock yet.
        const created = await manager.save(
          manager.create(TranslationValue, {
            entryId: entry.id,
            localeId: locale.id,
            value,
            status: 'draft',
            updatedBy: userId,
            publishedAt: null,
          }),
        );

        await this.appendHistory(manager, created, userId, null);
        return toValueResponse(created, locale.code);
      }

      if (
        dto.expectedVersion !== undefined &&
        dto.expectedVersion !== existing.version
      ) {
        throw staleVersion(existing);
      }

      /**
       * The status is deliberately untouched. There is one row per
       * (entry, locale) and it carries a single status, so there is nowhere to
       * park a draft beside a live value — demoting a published value on edit
       * would drop the key out of the runtime bundle, which is a content
       * regression rather than a safety measure. Editing published copy
       * publishes it, and the history row below is what makes that reversible.
       */
      existing.value = value;
      existing.updatedBy = userId;

      const saved = await manager.save(existing);
      await this.appendHistory(manager, saved, userId, null);
      return toValueResponse(saved, locale.code);
    });
  }

  /** Advisory. Nothing blocks on it — see the delivery plan's B6 preamble. */
  submitForReview(
    id: string,
    dto: ChangeNoteDto,
    userId: string,
  ): Promise<TranslationValueResponseData> {
    return this.transition(id, 'in_review', ['draft'], userId, dto);
  }

  /**
   * `archived` is included in the allowed set on purpose: archiving has to be
   * reversible, or it is a one-way trap on content someone will want back.
   */
  publish(
    id: string,
    dto: ChangeNoteDto,
    userId: string,
  ): Promise<TranslationValueResponseData> {
    return this.transition(
      id,
      'published',
      ['draft', 'in_review', 'archived'],
      userId,
      dto,
    );
  }

  /** Drops the value out of every runtime bundle. Admin-only on the route. */
  archive(
    id: string,
    dto: ChangeNoteDto,
    userId: string,
  ): Promise<TranslationValueResponseData> {
    return this.transition(
      id,
      'archived',
      ['draft', 'in_review', 'published'],
      userId,
      dto,
    );
  }

  /**
   * The audit trail. Paginated because `translation_value_versions` grows
   * forever and is never pruned (typeorm Rule 6), newest first because the
   * question being asked is almost always "what changed recently".
   */
  async findHistory(
    id: string,
    query: ListHistoryQueryDto,
  ): Promise<PaginatedList<TranslationHistoryData>> {
    await this.findEntityOrFail(id);

    const [records, total] = await this.versions.findAndCount({
      where: { translationValueId: id },
      order: { version: 'DESC' },
      take: query.limit,
      skip: (query.page - 1) * query.limit,
    });

    return {
      records: records.map(toHistoryResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Rollback is a **forward** write (invariant Rule 6): the historical value is
   * saved as a new version, and nothing is ever removed from the history. A
   * rollback to v2 produces v5, and v2 is still there to roll back to again.
   */
  async rollback(
    id: string,
    version: number,
    dto: ChangeNoteDto,
    userId: string,
  ): Promise<TranslationValueResponseData> {
    return this.dataSource.transaction(async (manager) => {
      const value = await this.lockValueOrFail(manager, id);
      await this.assertCanEditApp(
        userId,
        await this.findAppIdForValue(manager, id),
      );

      const historical = await manager.findOne(TranslationValueVersion, {
        where: { translationValueId: id, version },
      });

      if (!historical) {
        throw new NotFoundException(
          `This translation has no version ${version}.`,
        );
      }

      /**
       * The historical value is not re-validated. It passed `prepareValue` when
       * it was written; the only way it could fail now is if the *default*
       * language's placeholders have since changed, and refusing an emergency
       * revert because of a later edit elsewhere is the wrong trade. The
       * mismatch surfaces on the next ordinary save.
       *
       * The status is left alone for the same reason as an edit: rolling back
       * changes what the copy says, not whether it is live.
       */
      value.value = historical.value;
      value.updatedBy = userId;

      const saved = await manager.save(value);
      await this.appendHistory(
        manager,
        saved,
        userId,
        dto.changeNote ?? `Rollback to v${version}`,
      );

      return toValueResponse(
        saved,
        await this.localeCodeOf(manager, saved.localeId),
      );
    });
  }

  /**
   * One status change, in one transaction, with its history row.
   *
   * `allowedFrom` is the whole state machine: a transition the table does not
   * list is 422, not a silent no-op, because "publish did nothing" is the kind
   * of failure an editor discovers from a customer.
   */
  private async transition(
    id: string,
    next: TranslationStatus,
    allowedFrom: TranslationStatus[],
    userId: string,
    dto: ChangeNoteDto,
  ): Promise<TranslationValueResponseData> {
    return this.dataSource.transaction(async (manager) => {
      const value = await this.lockValueOrFail(manager, id);
      await this.assertCanEditApp(
        userId,
        await this.findAppIdForValue(manager, id),
      );

      /**
       * Version first, state machine second — deliberately.
       *
       * If a colleague already published this row, both checks would fire. The
       * 409 carries `currentStatus: 'published'` in `details`, which lets the
       * dashboard say "someone already published this" and drop the row. The
       * 422 says only "cannot go from published to published", which sends the
       * editor looking for a bug that is not there.
       */
      if (
        dto.expectedVersion !== undefined &&
        dto.expectedVersion !== value.version
      ) {
        throw staleVersion(value);
      }

      if (!allowedFrom.includes(value.status)) {
        throw new UnprocessableEntityException(
          `A translation cannot go from "${value.status}" to "${next}".`,
        );
      }

      value.status = next;
      value.updatedBy = userId;

      // `ck_values_published_at` enforces that the two travel together, so this
      // is the pair being set rather than a status flag with a timestamp beside
      // it. Archiving leaves `published_at` alone: when it was last live is
      // part of the audit.
      if (next === 'published') value.publishedAt = new Date();

      const saved = await manager.save(value);
      await this.appendHistory(manager, saved, userId, dto.changeNote ?? null);

      return toValueResponse(
        saved,
        await this.localeCodeOf(manager, saved.localeId),
      );
    });
  }

  /**
   * The append-only half of every write (invariant Rule 6). It runs on the
   * transaction's manager, never on the repository — a published value with no
   * audit row is exactly what the history table exists to prevent.
   */
  private async appendHistory(
    manager: EntityManager,
    value: TranslationValue,
    userId: string,
    changeNote: string | null,
  ): Promise<void> {
    await manager.insert(TranslationValueVersion, {
      translationValueId: value.id,
      version: value.version,
      value: value.value,
      status: value.status,
      changedBy: userId,
      changeNote,
    });
  }

  /**
   * The per-app scoping seam (architecture doc §15, still open).
   *
   * The *role* question is answered on the decorator and stays there (auth
   * Rule 7); what belongs in a service is the *data* question — may this
   * identity edit this particular app? Today every editor may edit every app,
   * so this passes for anyone who already got past `@Roles('admin', 'editor')`.
   *
   * It is called from every write path regardless, so when per-app assignment
   * lands it is one table and this one method body, not an audit of which
   * endpoints forgot to ask.
   */
  private async assertCanEditApp(
    _userId: string,
    _appId: string | null,
  ): Promise<void> {
    // no-scope: role-only for the MVP. See the doc comment above.
  }

  /**
   * The owning app, reached by joining through `modules` — an entry carries no
   * `app_id` of its own and must not grow one (invariant Rule 3). `null` for a
   * global module, which belongs to no single app.
   */
  private async findAppIdForValue(
    manager: EntityManager,
    valueId: string,
  ): Promise<string | null> {
    const row = await manager
      .createQueryBuilder(TranslationValue, 'value')
      .innerJoin('value.entry', 'entry')
      .innerJoin('entry.module', 'module')
      .select('module.appId', 'appId')
      .where('value.id = :valueId', { valueId })
      .getRawOne<{ appId: string | null }>();

    return row?.appId ?? null;
  }

  private async lockValueOrFail(
    manager: EntityManager,
    id: string,
  ): Promise<TranslationValue> {
    // No `relations` with a row lock: Postgres refuses `FOR UPDATE` against the
    // nullable side of an outer join, which is what TypeORM emits for one.
    const value = await manager.findOne(TranslationValue, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });

    if (!value) throw new NotFoundException('Translation not found.');
    return value;
  }

  private async findEntityOrFail(id: string): Promise<TranslationValue> {
    const value = await this.values.findOne({ where: { id } });
    if (!value) throw new NotFoundException('Translation not found.');
    return value;
  }

  private async resolveLocaleOrFail(code: string): Promise<Locale> {
    const locale = await this.locales.findEntityByCode(code);
    if (!locale) throw new NotFoundException(`Locale "${code}" does not exist.`);
    return locale;
  }

  /**
   * 422: the language exists, the request is well-formed, and the caller is
   * allowed to make it — the app simply does not serve that language, and
   * translating into it would produce copy no runtime bundle would ever return.
   */
  private async assertLocaleServesModule(
    module: TranslationModule,
    locale: Locale,
  ): Promise<void> {
    if (module.scope === 'app' && module.appId) {
      const enabled = await this.appLocales.findEnabledCodes(module.appId);

      if (!enabled.includes(locale.code)) {
        throw new UnprocessableEntityException(
          `Locale "${locale.code}" is not enabled for this module's app.`,
        );
      }

      return;
    }

    // A global namespace is shared by every app, so no single app's enabled set
    // governs it. Any active language is fair game.
    if (!locale.isActive) {
      throw new UnprocessableEntityException(
        `Locale "${locale.code}" is not active.`,
      );
    }
  }

  /**
   * The value this one's ICU placeholders must match: the same entry in the
   * app's default language, which is the language the copy was authored in.
   *
   * `null` — skip the parity check — in the three cases where there is nothing
   * meaningful to compare against: a non-ICU entry, a global module (shared by
   * every app, so no one app's default is authoritative), and the default
   * language itself, which *is* the reference.
   */
  private async findIcuReference(
    entry: TranslationEntry,
    module: TranslationModule,
    locale: Locale,
  ): Promise<{ value: string; localeCode: string } | null> {
    if (entry.contentType !== 'icu_message') return null;
    if (module.scope !== 'app' || !module.appId) return null;

    const app = await this.apps.findEntityOrFail(module.appId);
    if (app.defaultLocaleId === locale.id) return null;

    const reference = await this.values.findOne({
      where: { entryId: entry.id, localeId: app.defaultLocaleId },
      relations: { locale: true },
    });

    if (!reference) return null;
    return { value: reference.value, localeCode: reference.locale.code };
  }

  private async localeCodeOf(
    manager: EntityManager,
    localeId: string,
  ): Promise<string> {
    const locale = await manager.findOneOrFail(Locale, {
      where: { id: localeId },
      select: { id: true, code: true },
    });

    return locale.code;
  }
}

/**
 * 409 carrying the value that landed while the editor was typing, so the
 * dashboard can show a diff instead of just reporting a loss (invariant
 * Rule 7). The payload rides in `details`, which `HttpExceptionFilter` passes
 * through to the error envelope.
 */
function staleVersion(current: TranslationValue): ConflictException {
  const details: TranslationConflictData = {
    currentValue: current.value,
    currentVersion: current.version,
    currentStatus: current.status,
  };

  return new ConflictException({
    message: `This translation has moved on to version ${current.version} since you loaded it.`,
    error: 'Conflict',
    details,
  });
}

/** Entities are never returned as-is (HTTP contract Rule 5). */
function toValueResponse(
  value: TranslationValue,
  localeCode: string,
): TranslationValueResponseData {
  return {
    id: value.id,
    entryId: value.entryId,
    localeId: value.localeId,
    localeCode,
    value: value.value,
    status: value.status,
    version: Number(value.version),
    publishedAt: value.publishedAt?.toISOString() ?? null,
    updatedAt: value.updatedAt.toISOString(),
  };
}

function toHistoryResponse(
  record: TranslationValueVersion,
): TranslationHistoryData {
  return {
    id: record.id,
    translationValueId: record.translationValueId,
    version: record.version,
    value: record.value,
    status: record.status,
    changedBy: record.changedBy,
    changeNote: record.changeNote,
    createdAt: record.createdAt.toISOString(),
  };
}
