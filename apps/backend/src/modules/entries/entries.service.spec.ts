import { TranslationEntry, TranslationValue } from '@cms/database';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AppLocalesService } from '../apps/app-locales.service';
import { LocalesService } from '../locales/locales.service';
import { TranslationModulesService } from '../translation-modules/translation-modules.service';

import { EntriesService } from './entries.service';

import type { ListEntriesQueryDto } from './dto/list-entries.query.dto';

function entryRow(overrides: Partial<TranslationEntry> = {}): TranslationEntry {
  return {
    id: 'entry-1',
    moduleId: 'module-1',
    key: 'add_to_cart',
    description: null,
    contentType: 'text',
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  } as TranslationEntry;
}

/** A chainable QueryBuilder stub; every method returns the builder itself. */
function builderStub(terminal: Record<string, unknown>) {
  const builder: Record<string, jest.Mock> = {};
  for (const name of [
    'where',
    'andWhere',
    'orderBy',
    'take',
    'skip',
    'innerJoin',
    'select',
    'addSelect',
  ]) {
    builder[name] = jest.fn(() => builder);
  }
  for (const [name, value] of Object.entries(terminal)) {
    builder[name] = jest.fn(async () => value);
  }
  return builder;
}

describe('EntriesService', () => {
  let service: EntriesService;
  let entries: Record<string, jest.Mock>;
  let values: Record<string, jest.Mock>;
  let modules: { findEntityOrFail: jest.Mock };
  let appLocales: { findEnabledCodes: jest.Mock };
  let locales: { findActiveCodes: jest.Mock; findEntityByCode: jest.Mock };

  const query: ListEntriesQueryDto = { page: 1, limit: 20 };

  beforeEach(async () => {
    entries = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((row: unknown) => row),
      // Timestamps come back from the database, so the stub supplies them.
      save: jest.fn(async (row: Partial<TranslationEntry>) => entryRow(row)),
      delete: jest.fn(),
    };
    values = { createQueryBuilder: jest.fn() };
    modules = {
      findEntityOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'module-1', scope: 'app', appId: 'app-1' }),
    };
    appLocales = { findEnabledCodes: jest.fn().mockResolvedValue(['ar', 'en']) };
    locales = {
      findActiveCodes: jest.fn().mockResolvedValue(['ar', 'en', 'fr']),
      findEntityByCode: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EntriesService,
        { provide: getRepositoryToken(TranslationEntry), useValue: entries },
        { provide: getRepositoryToken(TranslationValue), useValue: values },
        { provide: TranslationModulesService, useValue: modules },
        { provide: AppLocalesService, useValue: appLocales },
        { provide: LocalesService, useValue: locales },
      ],
    }).compile();

    service = moduleRef.get(EntriesService);
  });

  /** Wires both query builders for one `findAll` call. */
  function stubList(entryRows: TranslationEntry[], valueRows: unknown[] = []) {
    entries.createQueryBuilder.mockReturnValue(
      builderStub({ getManyAndCount: [entryRows, entryRows.length] }),
    );
    values.createQueryBuilder.mockReturnValue(
      builderStub({ getRawMany: valueRows }),
    );
  }

  describe('the values map', () => {
    it('keys values by locale code and nulls the languages with none yet', async () => {
      stubList(
        [entryRow()],
        [
          {
            entryId: 'entry-1',
            localeCode: 'ar',
            value: 'أضف إلى السلة',
            status: 'published',
            version: 3,
          },
        ],
      );

      const result = await service.findAll('module-1', query);

      // Built from rows at read time — the storage has no `ar` column
      // (invariant Rule 1).
      expect(result.records[0].values).toEqual({
        ar: { value: 'أضف إلى السلة', status: 'published', version: 3 },
        en: null,
      });
    });

    it('still reports a value whose locale the app no longer serves', async () => {
      stubList(
        [entryRow()],
        [
          {
            entryId: 'entry-1',
            localeCode: 'fr',
            value: 'Ajouter',
            status: 'draft',
            version: 1,
          },
        ],
      );

      const result = await service.findAll('module-1', query);

      // `fr` is not in the app's enabled set, but the translation exists.
      // Dropping it from the response would make it look lost.
      expect(Object.keys(result.records[0].values).sort()).toEqual([
        'ar',
        'en',
        'fr',
      ]);
      expect(result.records[0].values.fr).toMatchObject({ value: 'Ajouter' });
    });

    it('uses every active language for a global module', async () => {
      modules.findEntityOrFail.mockResolvedValue({
        id: 'module-1',
        scope: 'global',
        appId: null,
      });
      stubList([entryRow()]);

      const result = await service.findAll('module-1', query);

      expect(appLocales.findEnabledCodes).not.toHaveBeenCalled();
      expect(Object.keys(result.records[0].values).sort()).toEqual([
        'ar',
        'en',
        'fr',
      ]);
    });
  });

  describe('query count', () => {
    it('loads every entry’s values in one query, not one per entry', async () => {
      const many = Array.from({ length: 500 }, (_, index) =>
        entryRow({ id: `entry-${index}`, key: `key_${index}` }),
      );
      stubList(many);

      await service.findAll('module-1', query);

      // The done-when that matters: 500 entries is one values query, not 500
      // (typeorm Rules 6 and 7).
      expect(values.createQueryBuilder).toHaveBeenCalledTimes(1);
    });

    it('skips the values query entirely for an empty page', async () => {
      stubList([]);

      await service.findAll('module-1', query);

      expect(values.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('missingLocale', () => {
    it('filters on the resolved locale id', async () => {
      locales.findEntityByCode.mockResolvedValue({ id: 'locale-ar' });
      const builder = builderStub({ getManyAndCount: [[], 0] });
      entries.createQueryBuilder.mockReturnValue(builder);

      await service.findAll('module-1', { ...query, missingLocale: 'ar' });

      const clause = builder.andWhere.mock.calls.at(-1);
      expect(clause?.[0]).toContain('NOT EXISTS');
      expect(clause?.[1]).toEqual({ missingLocaleId: 'locale-ar' });
    });

    it('404s on a locale that does not exist', async () => {
      locales.findEntityByCode.mockResolvedValue(null);
      entries.createQueryBuilder.mockReturnValue(
        builderStub({ getManyAndCount: [[], 0] }),
      );

      await expect(
        service.findAll('module-1', { ...query, missingLocale: 'zz' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('takes the module from the route and stamps the author', async () => {
      await service.create('module-1', { key: 'add_to_cart' }, 'user-7');

      expect(entries.create).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleId: 'module-1',
          key: 'add_to_cart',
          contentType: 'text',
          createdBy: 'user-7',
        }),
      );
    });

    it('does not pre-check the key, leaving uq_entries_module_key to 409', async () => {
      await service.create('module-1', { key: 'add_to_cart' }, 'user-7');

      expect(entries.findOne).not.toHaveBeenCalled();
    });

    it('404s before writing when the module does not exist', async () => {
      modules.findEntityOrFail.mockRejectedValue(new NotFoundException());

      await expect(
        service.create('module-1', { key: 'k' }, 'user-7'),
      ).rejects.toThrow(NotFoundException);
      expect(entries.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('404s on an unknown id', async () => {
      entries.findOne.mockResolvedValue(null);

      await expect(service.update('entry-1', { key: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('never moves the entry to another module', async () => {
      entries.findOne.mockResolvedValue(entryRow());

      const result = await service.update('entry-1', {
        moduleId: 'module-2',
      } as never);

      // The module decides scope (invariant Rule 2), so moving an entry is not
      // a field edit. The DTO drops it; this proves the service is not a second
      // way in.
      expect(result.moduleId).toBe('module-1');
    });

    it('leaves omitted fields untouched and clears an explicit null', async () => {
      entries.findOne.mockResolvedValue(entryRow({ description: 'Context.' }));
      const kept = await service.update('entry-1', { key: 'renamed' });
      expect(kept.description).toBe('Context.');

      entries.findOne.mockResolvedValue(entryRow({ description: 'Context.' }));
      const cleared = await service.update('entry-1', { description: null });
      expect(cleared.description).toBeNull();
    });
  });

  describe('remove', () => {
    it('404s on an unknown id rather than reporting a silent success', async () => {
      entries.findOne.mockResolvedValue(null);

      await expect(service.remove('entry-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(entries.delete).not.toHaveBeenCalled();
    });
  });
});
