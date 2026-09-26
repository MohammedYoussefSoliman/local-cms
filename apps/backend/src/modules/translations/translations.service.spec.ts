import {
  Locale,
  TranslationValue,
  TranslationValueVersion,
} from '@cms/database';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { TranslationStatus } from '@cms/domain';

import { AppLocalesService } from '../apps/app-locales.service';
import { AppsService } from '../apps/apps.service';
import { EntriesService } from '../entries/entries.service';
import { LocalesService } from '../locales/locales.service';
import { TranslationModulesService } from '../translation-modules/translation-modules.service';

import { TranslationsService } from './translations.service';

const ARABIC = { id: 'locale-ar', code: 'ar', isActive: true } as Locale;

function valueRow(overrides: Partial<TranslationValue> = {}): TranslationValue {
  return {
    id: 'value-1',
    entryId: 'entry-1',
    localeId: ARABIC.id,
    value: 'أضف إلى السلة',
    status: 'draft' as TranslationStatus,
    version: 1,
    updatedBy: 'user-1',
    publishedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  } as TranslationValue;
}

describe('TranslationsService', () => {
  let service: TranslationsService;
  let manager: Record<string, jest.Mock>;
  let values: Record<string, jest.Mock>;
  let versions: Record<string, jest.Mock>;
  let entries: { findEntityOrFail: jest.Mock };
  let modules: { findEntityOrFail: jest.Mock };
  let apps: { findEntityOrFail: jest.Mock };
  let appLocales: { findEnabledCodes: jest.Mock };
  let locales: { findEntityByCode: jest.Mock };

  beforeEach(async () => {
    manager = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(async () => ARABIC),
      create: jest.fn((_entity: unknown, row: unknown) => row),
      // The database supplies the version and the timestamps.
      save: jest.fn(async (row: Partial<TranslationValue>) => valueRow(row)),
      insert: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(async () => ({ appId: 'app-1' })),
      })),
    };

    values = { findOne: jest.fn() };
    versions = { findAndCount: jest.fn(async () => [[], 0]) };
    entries = {
      findEntityOrFail: jest.fn().mockResolvedValue({
        id: 'entry-1',
        moduleId: 'module-1',
        contentType: 'text',
      }),
    };
    modules = {
      findEntityOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'module-1', scope: 'app', appId: 'app-1' }),
    };
    apps = {
      findEntityOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'app-1', defaultLocaleId: 'locale-en' }),
    };
    appLocales = { findEnabledCodes: jest.fn().mockResolvedValue(['ar', 'en']) };
    locales = { findEntityByCode: jest.fn().mockResolvedValue(ARABIC) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TranslationsService,
        { provide: getRepositoryToken(TranslationValue), useValue: values },
        {
          provide: getRepositoryToken(TranslationValueVersion),
          useValue: versions,
        },
        { provide: EntriesService, useValue: entries },
        { provide: TranslationModulesService, useValue: modules },
        { provide: AppsService, useValue: apps },
        { provide: AppLocalesService, useValue: appLocales },
        { provide: LocalesService, useValue: locales },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(
              async (run: (m: unknown) => Promise<unknown>) => run(manager),
            ),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(TranslationsService);
  });

  describe('upsert', () => {
    it('creates the first value as a draft and writes its history row', async () => {
      manager.findOne.mockResolvedValue(null);

      const result = await service.upsert(
        'entry-1',
        'ar',
        { value: 'أضف' },
        'user-1',
      );

      expect(result).toMatchObject({ status: 'draft', localeCode: 'ar' });
      expect(manager.insert).toHaveBeenCalledWith(
        TranslationValueVersion,
        expect.objectContaining({
          translationValueId: 'value-1',
          value: 'أضف',
          status: 'draft',
          changedBy: 'user-1',
        }),
      );
    });

    it('takes a row lock before reading the version', async () => {
      // The lock is what makes two concurrent writers serialize; without it,
      // both read version 1 and both win.
      manager.findOne.mockResolvedValue(valueRow());

      await service.upsert('entry-1', 'ar', { value: 'جديد' }, 'user-1');

      expect(manager.findOne).toHaveBeenCalledWith(
        TranslationValue,
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
    });

    it('rejects a stale expectedVersion with the current value attached', async () => {
      manager.findOne.mockResolvedValue(
        valueRow({ version: 4, value: 'ما كتبه زميلك', status: 'published' }),
      );

      const failure = await service
        .upsert('entry-1', 'ar', { value: 'مين', expectedVersion: 2 }, 'user-1')
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ConflictException);
      expect((failure as ConflictException).getResponse()).toMatchObject({
        details: {
          currentValue: 'ما كتبه زميلك',
          currentVersion: 4,
          currentStatus: 'published',
        },
      });
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('leaves a published value published when it is edited', async () => {
      // There is one row per (entry, locale) and one status on it, so demoting
      // to draft would drop the key out of every live bundle.
      const published = new Date('2026-02-01T00:00:00.000Z');
      manager.findOne.mockResolvedValue(
        valueRow({ status: 'published', publishedAt: published }),
      );

      const result = await service.upsert(
        'entry-1',
        'ar',
        { value: 'نص محدث' },
        'user-1',
      );

      expect(result.status).toBe('published');
      expect(result.publishedAt).toBe(published.toISOString());
    });

    it('accepts an omitted expectedVersion as a deliberate overwrite', async () => {
      manager.findOne.mockResolvedValue(valueRow({ version: 9 }));

      await expect(
        service.upsert('entry-1', 'ar', { value: 'نص' }, 'user-1'),
      ).resolves.toMatchObject({ value: 'نص' });
    });

    it('404s for a locale that does not exist', async () => {
      locales.findEntityByCode.mockResolvedValue(null);

      await expect(
        service.upsert('entry-1', 'zz', { value: 'x' }, 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('422s for a locale the app does not serve', async () => {
      appLocales.findEnabledCodes.mockResolvedValue(['en']);

      await expect(
        service.upsert('entry-1', 'ar', { value: 'x' }, 'user-1'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('lets a global module use any active language', async () => {
      modules.findEntityOrFail.mockResolvedValue({
        id: 'module-1',
        scope: 'global',
        appId: null,
      });
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.upsert('entry-1', 'ar', { value: 'x' }, 'user-1'),
      ).resolves.toMatchObject({ status: 'draft' });
      // A global namespace belongs to no one app, so no app's enabled set is
      // consulted.
      expect(appLocales.findEnabledCodes).not.toHaveBeenCalled();
    });

    it('422s for an inactive language on a global module', async () => {
      modules.findEntityOrFail.mockResolvedValue({
        id: 'module-1',
        scope: 'global',
        appId: null,
      });
      locales.findEntityByCode.mockResolvedValue({
        ...ARABIC,
        isActive: false,
      });

      await expect(
        service.upsert('entry-1', 'ar', { value: 'x' }, 'user-1'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('checks ICU placeholders against the app default locale', async () => {
      entries.findEntityOrFail.mockResolvedValue({
        id: 'entry-1',
        moduleId: 'module-1',
        contentType: 'icu_message',
      });
      values.findOne.mockResolvedValue({
        value: 'Hello {name}',
        locale: { code: 'en' },
      });

      await expect(
        service.upsert('entry-1', 'ar', { value: 'مرحبا' }, 'user-1'),
      ).rejects.toThrow(/does not use \{name\}/);
    });

    it('skips the parity check when the default locale has no value yet', async () => {
      entries.findEntityOrFail.mockResolvedValue({
        id: 'entry-1',
        moduleId: 'module-1',
        contentType: 'icu_message',
      });
      values.findOne.mockResolvedValue(null);
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.upsert('entry-1', 'ar', { value: 'مرحبا' }, 'user-1'),
      ).resolves.toMatchObject({ status: 'draft' });
    });
  });

  describe('the value and its history are one write', () => {
    it('fails the whole transaction when the history row cannot be written', async () => {
      // A published value with no audit row is exactly what the history table
      // exists to prevent, so the insert failing has to take the value with it
      // rather than being swallowed (typeorm Rule 4).
      manager.findOne.mockResolvedValue(null);
      manager.insert.mockRejectedValue(new Error('history write failed'));

      await expect(
        service.upsert('entry-1', 'ar', { value: 'نص' }, 'user-1'),
      ).rejects.toThrow('history write failed');
    });

    it('writes both through the transaction manager, never the repository', async () => {
      manager.findOne.mockResolvedValue(valueRow());

      await service.upsert('entry-1', 'ar', { value: 'نص' }, 'user-1');

      expect(manager.save).toHaveBeenCalled();
      expect(manager.insert).toHaveBeenCalled();
      // A repository write here would sit outside the transaction.
      expect(values.findOne).not.toHaveBeenCalled();
    });
  });

  describe('status transitions', () => {
    it('publishes a draft and stamps published_at', async () => {
      manager.findOne.mockResolvedValue(valueRow({ status: 'draft' }));

      const result = await service.publish('value-1', {}, 'user-1');

      expect(result.status).toBe('published');
      // `ck_values_published_at` refuses the pair coming apart, so the two are
      // always set together.
      expect(result.publishedAt).not.toBeNull();
    });

    it('republishes an archived value', async () => {
      manager.findOne.mockResolvedValue(valueRow({ status: 'archived' }));

      await expect(
        service.publish('value-1', {}, 'user-1'),
      ).resolves.toMatchObject({ status: 'published' });
    });

    it('422s on a transition the state machine does not allow', async () => {
      manager.findOne.mockResolvedValue(valueRow({ status: 'published' }));

      await expect(
        service.submitForReview('value-1', {}, 'user-1'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('records the change note on the history row', async () => {
      manager.findOne.mockResolvedValue(valueRow({ status: 'draft' }));

      await service.submitForReview(
        'value-1',
        { changeNote: 'ready for review' },
        'user-1',
      );

      expect(manager.insert).toHaveBeenCalledWith(
        TranslationValueVersion,
        expect.objectContaining({ changeNote: 'ready for review' }),
      );
    });

    it('404s for a value that does not exist', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.publish('value-1', {}, 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('rollback', () => {
    it('writes the historical value forward instead of rewinding history', async () => {
      manager.findOne
        .mockResolvedValueOnce(valueRow({ version: 4, value: 'الحالي' }))
        .mockResolvedValueOnce({ version: 2, value: 'القديم' });

      const result = await service.rollback('value-1', 2, {}, 'user-1');

      expect(result.value).toBe('القديم');
      // Nothing is deleted — the rollback is itself a new version (Rule 6).
      expect(manager.insert).toHaveBeenCalledWith(
        TranslationValueVersion,
        expect.objectContaining({
          value: 'القديم',
          changeNote: 'Rollback to v2',
        }),
      );
    });

    it('does not change whether the value is live', async () => {
      manager.findOne
        .mockResolvedValueOnce(valueRow({ status: 'published' }))
        .mockResolvedValueOnce({ version: 2, value: 'القديم' });

      await expect(
        service.rollback('value-1', 2, {}, 'user-1'),
      ).resolves.toMatchObject({ status: 'published' });
    });

    it('404s for a version that was never written', async () => {
      manager.findOne
        .mockResolvedValueOnce(valueRow())
        .mockResolvedValueOnce(null);

      await expect(
        service.rollback('value-1', 99, {}, 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findHistory', () => {
    it('paginates newest version first', async () => {
      values.findOne.mockResolvedValue(valueRow());

      await service.findHistory('value-1', { page: 2, limit: 10 });

      expect(versions.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { translationValueId: 'value-1' },
          order: { version: 'DESC' },
          take: 10,
          skip: 10,
        }),
      );
    });
  });
});
