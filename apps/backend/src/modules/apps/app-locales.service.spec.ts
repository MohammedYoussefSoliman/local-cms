import { AppLocale, Locale } from '@cms/database';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { LocalesService } from '../locales/locales.service';

import { AppLocalesService } from './app-locales.service';
import { AppsService } from './apps.service';

const ARABIC = {
  id: 'locale-ar',
  code: 'ar',
  name: 'Arabic',
  nativeName: 'العربية',
  direction: 'rtl',
  isActive: true,
} as Locale;

const FRENCH = {
  ...ARABIC,
  id: 'locale-fr',
  code: 'fr',
  direction: 'ltr',
} as Locale;

function row(overrides: Partial<AppLocale> = {}): AppLocale {
  return {
    appId: 'app-1',
    localeId: 'locale-ar',
    locale: ARABIC,
    isDefault: false,
    isEnabled: true,
    fallbackLocaleId: null,
    fallbackLocale: null,
    ...overrides,
  } as AppLocale;
}

describe('AppLocalesService', () => {
  let service: AppLocalesService;
  let appLocales: Record<string, jest.Mock>;
  let locales: { findEntityByCode: jest.Mock };

  beforeEach(async () => {
    appLocales = {
      find: jest.fn(),
      findOne: jest.fn(),
      insert: jest.fn(),
      save: jest.fn(async (value: unknown) => value),
    };
    locales = { findEntityByCode: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AppLocalesService,
        { provide: getRepositoryToken(AppLocale), useValue: appLocales },
        { provide: AppsService, useValue: { findEntityOrFail: jest.fn() } },
        { provide: LocalesService, useValue: locales },
      ],
    }).compile();

    service = moduleRef.get(AppLocalesService);
  });

  describe('enable', () => {
    it('inserts a non-default row for a locale the app has never had', async () => {
      locales.findEntityByCode.mockResolvedValue(ARABIC);
      appLocales.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(row());

      await service.enable('app-1', 'ar');

      // isDefault is false unconditionally: the default is set once, at app
      // creation, and uq_app_locales_one_default would reject a second one.
      expect(appLocales.insert).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: false, isEnabled: true }),
      );
    });

    it('restores the existing row rather than replacing it, keeping its fallback', async () => {
      locales.findEntityByCode.mockResolvedValue(ARABIC);
      appLocales.findOne.mockResolvedValue(
        row({
          isEnabled: false,
          fallbackLocaleId: 'locale-fr',
          fallbackLocale: FRENCH,
        }),
      );

      const result = await service.enable('app-1', 'ar');

      expect(appLocales.insert).not.toHaveBeenCalled();
      expect(result.isEnabled).toBe(true);
      expect(result.fallbackLocaleCode).toBe('fr');
    });

    it('404s on an unknown locale code', async () => {
      locales.findEntityByCode.mockResolvedValue(null);

      await expect(service.enable('app-1', 'zz')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses a deactivated locale', async () => {
      locales.findEntityByCode.mockResolvedValue({
        ...ARABIC,
        isActive: false,
      });

      await expect(service.enable('app-1', 'ar')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('disable', () => {
    it('refuses to disable the default locale', async () => {
      locales.findEntityByCode.mockResolvedValue(ARABIC);
      appLocales.findOne.mockResolvedValue(row({ isDefault: true }));

      await expect(service.disable('app-1', 'ar')).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(appLocales.save).not.toHaveBeenCalled();
    });

    it('keeps the row and flips isEnabled', async () => {
      locales.findEntityByCode.mockResolvedValue(ARABIC);
      appLocales.findOne.mockResolvedValue(
        row({ fallbackLocaleId: 'locale-fr', fallbackLocale: FRENCH }),
      );

      const result = await service.disable('app-1', 'ar');

      expect(result.isEnabled).toBe(false);
      // The fallback survives the round trip, which is why this is not a DELETE.
      expect(result.fallbackLocaleCode).toBe('fr');
    });
  });

  describe('setFallback', () => {
    it('clears the fallback on an explicit null', async () => {
      locales.findEntityByCode.mockResolvedValue(ARABIC);
      appLocales.findOne.mockResolvedValue(
        row({ fallbackLocaleId: 'locale-fr', fallbackLocale: FRENCH }),
      );

      const result = await service.setFallback('app-1', 'ar', {
        fallbackLocaleCode: null,
      });

      expect(result.fallbackLocaleId).toBeNull();
      expect(result.fallbackLocaleCode).toBeNull();
      // No second lookup — null is the value, not a code to resolve.
      expect(locales.findEntityByCode).toHaveBeenCalledTimes(1);
    });

    it('refuses a fallback the app does not serve', async () => {
      locales.findEntityByCode
        .mockResolvedValueOnce(ARABIC)
        .mockResolvedValueOnce(FRENCH);
      appLocales.findOne
        .mockResolvedValueOnce(row())
        // The lookup for an enabled `fr` row finds nothing.
        .mockResolvedValueOnce(null);

      await expect(
        service.setFallback('app-1', 'ar', { fallbackLocaleCode: 'fr' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('sets a fallback that is enabled for the app', async () => {
      locales.findEntityByCode
        .mockResolvedValueOnce(ARABIC)
        .mockResolvedValueOnce(FRENCH);
      appLocales.findOne
        .mockResolvedValueOnce(row())
        .mockResolvedValueOnce(row({ localeId: 'locale-fr', locale: FRENCH }));

      const result = await service.setFallback('app-1', 'ar', {
        fallbackLocaleCode: 'fr',
      });

      expect(result.fallbackLocaleId).toBe('locale-fr');
      expect(result.fallbackLocaleCode).toBe('fr');
    });
  });
});
