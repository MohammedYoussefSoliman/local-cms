import { TranslationEntry, TranslationValue } from '@cms/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type {
  EntryResponseData,
  PaginatedList,
  TranslationRow,
} from '@cms/contracts';
import type { TranslationStatus } from '@cms/domain';

import { AppLocalesService } from '../apps/app-locales.service';
import { LocalesService } from '../locales/locales.service';
import { TranslationModulesService } from '../translation-modules/translation-modules.service';

import type { CreateEntryDto } from './dto/create-entry.dto';
import type { ListEntriesQueryDto } from './dto/list-entries.query.dto';
import type { UpdateEntryDto } from './dto/update-entry.dto';

/** One row of the values query — raw, because the select is narrow. */
type ValueRow = {
  entryId: string;
  localeCode: string;
  value: string;
  status: TranslationStatus;
  version: number;
};

@Injectable()
export class EntriesService {
  constructor(
    @InjectRepository(TranslationEntry)
    private readonly entries: Repository<TranslationEntry>,
    @InjectRepository(TranslationValue)
    private readonly values: Repository<TranslationValue>,
    private readonly modules: TranslationModulesService,
    private readonly appLocales: AppLocalesService,
    private readonly locales: LocalesService,
  ) {}

  /**
   * The dashboard's main table. Returns one `TranslationRow` per entry with a
   * `values` map keyed by locale code — built from rows at read time, never
   * stored that way (invariant Rule 1). The storage is normalized and the
   * response is nested; keeping those two shapes distinct is the design.
   *
   * Cost is a constant number of queries, not one per entry: the page of
   * entries, its count, and a single narrow select for all of their values
   * (typeorm Rules 6 and 7).
   */
  async findAll(
    moduleId: string,
    query: ListEntriesQueryDto,
  ): Promise<PaginatedList<TranslationRow>> {
    const module = await this.modules.findEntityOrFail(moduleId);

    /**
     * Which languages get a column. An app-scoped module shows the languages
     * its app serves; a global module is shared by every app, so it shows every
     * active language.
     */
    const localeCodes =
      module.scope === 'app' && module.appId
        ? await this.appLocales.findEnabledCodes(module.appId)
        : await this.locales.findActiveCodes();

    const builder = this.entries
      .createQueryBuilder('entry')
      .where('entry.moduleId = :moduleId', { moduleId });

    const search = query.search?.trim();
    if (search) {
      builder.andWhere('entry.key ILIKE :search', { search: `%${search}%` });
    }

    if (query.missingLocale) {
      const locale = await this.locales.findEntityByCode(query.missingLocale);
      if (!locale) {
        throw new NotFoundException(
          `Locale "${query.missingLocale}" does not exist.`,
        );
      }

      // NOT EXISTS rather than a LEFT JOIN … IS NULL: it stops at the first
      // matching row and leaves the page query free of a join that would
      // multiply rows before LIMIT.
      builder.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM "translation_values" "missing"
          WHERE "missing"."entry_id" = "entry"."id"
            AND "missing"."locale_id" = :missingLocaleId
        )`,
        { missingLocaleId: locale.id },
      );
    }

    const [records, total] = await builder
      .orderBy('entry.key', 'ASC')
      .take(query.limit)
      .skip((query.page - 1) * query.limit)
      .getManyAndCount();

    const valuesByEntry = await this.loadValues(
      records.map((entry) => entry.id),
    );

    return {
      records: records.map((entry) =>
        toTranslationRow(entry, localeCodes, valuesByEntry.get(entry.id)),
      ),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string): Promise<EntryResponseData> {
    return toEntryResponse(await this.findEntityOrFail(id));
  }

  async create(
    moduleId: string,
    dto: CreateEntryDto,
    userId: string,
  ): Promise<EntryResponseData> {
    await this.modules.findEntityOrFail(moduleId);

    // No pre-check: `uq_entries_module_key` is the check, and the filter turns
    // its 23505 into a 409 (typeorm Rule 5).
    const entry = await this.entries.save(
      this.entries.create({
        moduleId,
        key: dto.key,
        description: dto.description ?? null,
        contentType: dto.contentType ?? 'text',
        createdBy: userId,
      }),
    );

    return toEntryResponse(entry);
  }

  async update(id: string, dto: UpdateEntryDto): Promise<EntryResponseData> {
    const entry = await this.findEntityOrFail(id);

    // Field by field, so an omitted optional cannot null a stored value — and
    // so `moduleId` has nowhere to sneak in.
    if (dto.key !== undefined) entry.key = dto.key;
    if (dto.description !== undefined) entry.description = dto.description;
    if (dto.contentType !== undefined) entry.contentType = dto.contentType;

    await this.entries.save(entry);
    return toEntryResponse(entry);
  }

  /**
   * Cascades to `translation_values` and on to `translation_value_versions`, so
   * this destroys the append-only history for every language of this key. It is
   * admin-only for that reason, and an `archived` status on the entry is
   * probably the better default once B6 lands.
   */
  async remove(id: string): Promise<void> {
    const entry = await this.findEntityOrFail(id);
    await this.entries.delete(entry.id);
  }

  async findEntityOrFail(id: string): Promise<TranslationEntry> {
    const entry = await this.entries.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Entry not found.');
    return entry;
  }

  /**
   * One query for the whole page's values, whatever the page size. A `find()`
   * per entry here is the N+1 that makes a 500-key module 500 round trips.
   */
  private async loadValues(
    entryIds: string[],
  ): Promise<Map<string, Record<string, ValueRow>>> {
    const byEntry = new Map<string, Record<string, ValueRow>>();
    if (entryIds.length === 0) return byEntry;

    const rows: ValueRow[] = await this.values
      .createQueryBuilder('value')
      .innerJoin('value.locale', 'locale')
      .select('value.entryId', 'entryId')
      .addSelect('locale.code', 'localeCode')
      .addSelect('value.value', 'value')
      .addSelect('value.status', 'status')
      .addSelect('value.version', 'version')
      .where('value.entryId IN (:...entryIds)', { entryIds })
      .getRawMany();

    for (const row of rows) {
      const existing = byEntry.get(row.entryId) ?? {};
      existing[row.localeCode] = row;
      byEntry.set(row.entryId, existing);
    }

    return byEntry;
  }
}

function toTranslationRow(
  entry: TranslationEntry,
  localeCodes: string[],
  values: Record<string, ValueRow> | undefined,
): TranslationRow {
  /**
   * The module's languages plus any language that already has a value. The
   * second half matters after a locale is disabled for an app: its translations
   * are still in the table, and dropping them from the response would make them
   * look lost.
   */
  const codes = new Set([...localeCodes, ...Object.keys(values ?? {})]);

  const mapped: TranslationRow['values'] = {};
  for (const code of codes) {
    const row = values?.[code];
    // `null`, not omitted: "no translation yet" is the case the editor renders.
    mapped[code] = row
      ? { value: row.value, status: row.status, version: Number(row.version) }
      : null;
  }

  return {
    entryId: entry.id,
    key: entry.key,
    description: entry.description,
    contentType: entry.contentType,
    values: mapped,
  };
}

/** Entities are never returned as-is (HTTP contract Rule 5). */
function toEntryResponse(entry: TranslationEntry): EntryResponseData {
  return {
    id: entry.id,
    moduleId: entry.moduleId,
    key: entry.key,
    description: entry.description,
    contentType: entry.contentType,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}
