import { TranslationValue } from '@cms/database';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import type { AppLocaleResponseData } from '@cms/contracts';

import type { ApiKeyContext } from '@/common';

import { ApiKeysService } from '../api-keys/api-keys.service';
import { AppLocalesService } from '../apps/app-locales.service';
import { AppsService } from '../apps/apps.service';
import { TranslationModulesService } from '../translation-modules/translation-modules.service';

import { RuntimeService } from './runtime.service';


const APP = { id: 'app-1', slug: 'storefront' };
const KEY: ApiKeyContext = { id: 'key-1', appId: 'app-1', prefix: 'cms_1234abcd' };

const AR = 'locale-ar';
const EN = 'locale-en';

function appLocale(
  overrides: Partial<AppLocaleResponseData> & { code: string },
): AppLocaleResponseData {
  const { code, ...rest } = overrides;

  return {
    appId: APP.id,
    localeId: code === 'ar' ? AR : EN,
    locale: {
      id: code === 'ar' ? AR : EN,
      code,
      name: code,
      nativeName: code,
      direction: code === 'ar' ? 'rtl' : 'ltr',
      isActive: true,
    },
    isDefault: false,
    isEnabled: true,
    fallbackLocaleId: null,
    fallbackLocaleCode: null,
    ...rest,
  };
}

/** A chainable QueryBuilder stub whose terminal call returns fixed rows. */
function builderStub(rows: unknown[]) {
  const builder: Record<string, jest.Mock> = {};
  for (const name of [
    'innerJoin',
    'select',
    'addSelect',
    'where',
    'andWhere',
  ]) {
    builder[name] = jest.fn(() => builder);
  }
  builder.getRawMany = jest.fn(async () => rows);
  return builder;
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    moduleSlug: 'checkout',
    moduleScope: 'app',
    entryKey: 'title',
    value: 'إتمام الشراء',
    localeId: AR,
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('RuntimeService', () => {
  let service: RuntimeService;
  let values: { createQueryBuilder: jest.Mock };
  let apps: { findEntityBySlugOrFail: jest.Mock };
  let appLocales: { findAll: jest.Mock };
  let modules: { findForAppBySlug: jest.Mock };
  let apiKeys: { assertServesApp: jest.Mock };

  function withRows(rows: unknown[]) {
    const builder = builderStub(rows);
    values.createQueryBuilder.mockReturnValue(builder);
    return builder;
  }

  beforeEach(async () => {
    values = { createQueryBuilder: jest.fn(() => builderStub([])) };
    apps = { findEntityBySlugOrFail: jest.fn().mockResolvedValue(APP) };
    appLocales = {
      findAll: jest
        .fn()
        .mockResolvedValue([
          appLocale({ code: 'ar', isDefault: true }),
          appLocale({ code: 'en' }),
        ]),
    };
    modules = { findForAppBySlug: jest.fn().mockResolvedValue([{ id: 'm-1' }]) };
    apiKeys = { assertServesApp: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RuntimeService,
        { provide: getRepositoryToken(TranslationValue), useValue: values },
        { provide: AppsService, useValue: apps },
        { provide: AppLocalesService, useValue: appLocales },
        { provide: TranslationModulesService, useValue: modules },
        { provide: ApiKeysService, useValue: apiKeys },
      ],
    }).compile();

    service = moduleRef.get(RuntimeService);
  });

  describe('scope', () => {
    it('asks whether the key serves this app on every path', async () => {
      withRows([]);

      await service.getBundle('storefront', 'ar', true, KEY);
      await service.getLocales('storefront', KEY);
      await service.getModuleBundle('storefront', 'ar', 'checkout', KEY);

      expect(apiKeys.assertServesApp).toHaveBeenCalledTimes(3);
      expect(apiKeys.assertServesApp).toHaveBeenCalledWith(KEY, APP.id);
    });

    it('propagates the 403 rather than serving the bundle', async () => {
      apiKeys.assertServesApp.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(
        service.getBundle('storefront', 'ar', true, KEY),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(values.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('published-only', () => {
    it('filters on status in the query, not after it', async () => {
      const builder = withRows([]);

      await service.getBundle('storefront', 'ar', true, KEY);

      // A `draft` reaching a client app is unreleased copy on a live
      // storefront (invariant Rule 4), so the filter cannot be a post-filter.
      expect(builder.where).toHaveBeenCalledWith('value.status = :status', {
        status: 'published',
      });
    });
  });

  describe('resolution order', () => {
    it('prefers the app namespace over a global one with the same slug', async () => {
      withRows([
        row({ moduleScope: 'global', value: 'global title' }),
        row({ moduleScope: 'app', value: 'app title' }),
      ]);

      const { bundle } = await service.getBundle('storefront', 'ar', true, KEY);

      expect(bundle.checkout.title).toBe('app title');
    });

    it('prefers the app namespace whatever order the rows arrive in', async () => {
      withRows([
        row({ moduleScope: 'app', value: 'app title' }),
        row({ moduleScope: 'global', value: 'global title' }),
      ]);

      const { bundle } = await service.getBundle('storefront', 'ar', true, KEY);

      expect(bundle.checkout.title).toBe('app title');
    });

    it('falls back to the configured locale only where the requested one is missing', async () => {
      appLocales.findAll.mockResolvedValue([
        appLocale({
          code: 'ar',
          isDefault: true,
          fallbackLocaleId: EN,
          fallbackLocaleCode: 'en',
        }),
        appLocale({ code: 'en' }),
      ]);

      withRows([
        row({ entryKey: 'title', localeId: AR, value: 'عنوان' }),
        row({ entryKey: 'title', localeId: EN, value: 'Title' }),
        row({ entryKey: 'subtitle', localeId: EN, value: 'Subtitle only' }),
      ]);

      const { bundle } = await service.getBundle('storefront', 'ar', true, KEY);

      expect(bundle.checkout).toEqual({
        title: 'عنوان',
        subtitle: 'Subtitle only',
      });
    });

    it('outranks the app namespace in the fallback language with the global one in the requested language', async () => {
      // Language is the outer loop: requested (app, then global), then
      // fallback. A global Arabic string beats an app-specific English one.
      appLocales.findAll.mockResolvedValue([
        appLocale({ code: 'ar', isDefault: true, fallbackLocaleId: EN }),
        appLocale({ code: 'en' }),
      ]);

      withRows([
        row({ moduleScope: 'app', localeId: EN, value: 'English app copy' }),
        row({ moduleScope: 'global', localeId: AR, value: 'نص عام' }),
      ]);

      const { bundle } = await service.getBundle('storefront', 'ar', true, KEY);

      expect(bundle.checkout.title).toBe('نص عام');
    });

    it('omits a key with nothing published anywhere', async () => {
      withRows([]);

      const { bundle } = await service.getBundle('storefront', 'ar', true, KEY);

      // Step 4 of RESOLUTION_ORDER is an absence — every i18n client renders a
      // missing key as the key.
      expect(bundle).toEqual({});
    });

    it('does not query the fallback language when none is configured', async () => {
      const builder = withRows([]);

      await service.getBundle('storefront', 'ar', true, KEY);

      expect(builder.andWhere).toHaveBeenCalledWith(
        'value.localeId IN (:...localeIds)',
        { localeIds: [AR] },
      );
    });

    it('ignores a fallback pointing at a language the app has switched off', async () => {
      appLocales.findAll.mockResolvedValue([
        appLocale({ code: 'ar', isDefault: true, fallbackLocaleId: EN }),
        appLocale({ code: 'en', isEnabled: false }),
      ]);
      const builder = withRows([]);

      await service.getBundle('storefront', 'ar', true, KEY);

      expect(builder.andWhere).toHaveBeenCalledWith(
        'value.localeId IN (:...localeIds)',
        { localeIds: [AR] },
      );
    });
  });

  describe('includeGlobal', () => {
    it('restricts to the app when false', async () => {
      const builder = withRows([]);

      await service.getBundle('storefront', 'ar', false, KEY);

      expect(builder.andWhere).toHaveBeenCalledWith(
        'module.appId = :appId',
        { appId: APP.id },
      );
    });

    it('widens to global namespaces when true', async () => {
      const builder = withRows([]);

      await service.getBundle('storefront', 'ar', true, KEY);

      expect(builder.andWhere).toHaveBeenCalledWith(
        '(module.appId = :appId OR module.scope = :globalScope)',
        { appId: APP.id, globalScope: 'global' },
      );
    });
  });

  describe('releaseId', () => {
    it('is stable for the same rows', async () => {
      withRows([row()]);
      const first = await service.getBundle('storefront', 'ar', true, KEY);

      withRows([row()]);
      const second = await service.getBundle('storefront', 'ar', true, KEY);

      expect(first.releaseId).toBe(second.releaseId);
      expect(first.releaseId).toHaveLength(16);
    });

    it('changes when a value is edited without being republished', async () => {
      // B6 keeps `published_at` fixed when live copy is corrected, so a
      // published_at digest would not move and every cache would serve the typo.
      withRows([row()]);
      const before = await service.getBundle('storefront', 'ar', true, KEY);

      withRows([row({ updatedAt: new Date('2026-06-01T00:00:00.000Z') })]);
      const after = await service.getBundle('storefront', 'ar', true, KEY);

      expect(after.releaseId).not.toBe(before.releaseId);
    });

    it('changes when a value leaves the published set', async () => {
      withRows([row(), row({ entryKey: 'subtitle' })]);
      const before = await service.getBundle('storefront', 'ar', true, KEY);

      withRows([row()]);
      const after = await service.getBundle('storefront', 'ar', true, KEY);

      expect(after.releaseId).not.toBe(before.releaseId);
    });
  });

  describe('locales', () => {
    it('returns only enabled languages, with the default named', async () => {
      appLocales.findAll.mockResolvedValue([
        appLocale({ code: 'ar', isDefault: true }),
        appLocale({ code: 'en', isEnabled: false }),
      ]);

      const result = await service.getLocales('storefront', KEY);

      expect(result.defaultLocaleCode).toBe('ar');
      expect(result.locales.map((locale) => locale.code)).toEqual(['ar']);
      // The client sets `dir` before it has fetched a single string.
      expect(result.locales[0].direction).toBe('rtl');
    });
  });

  describe('not found', () => {
    it('404s for a locale the app does not serve', async () => {
      await expect(
        service.getBundle('storefront', 'fr', true, KEY),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s for a locale the app has switched off', async () => {
      appLocales.findAll.mockResolvedValue([
        appLocale({ code: 'ar', isDefault: true }),
        appLocale({ code: 'en', isEnabled: false }),
      ]);

      await expect(
        service.getBundle('storefront', 'en', true, KEY),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s for a module slug that names nothing', async () => {
      modules.findForAppBySlug.mockResolvedValue([]);

      await expect(
        service.getModuleBundle('storefront', 'ar', 'nope', KEY),
      ).rejects.toBeInstanceOf(NotFoundException);
      // Distinguishable from a namespace that exists with nothing published.
      expect(values.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
