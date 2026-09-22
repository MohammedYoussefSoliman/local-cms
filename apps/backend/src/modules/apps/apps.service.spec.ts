import { AppLocale, Locale, LocalizationApp } from '@cms/database';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { AppsService } from './apps.service';

import type { CreateAppDto } from './dto/create-app.dto';
import type { ListAppsQueryDto } from './dto/list-apps.query.dto';

const ARABIC: Partial<Locale> = {
  id: 'locale-ar',
  code: 'ar',
  name: 'Arabic',
  nativeName: 'العربية',
  direction: 'rtl',
  isActive: true,
};

function appRow(overrides: Partial<LocalizationApp> = {}): LocalizationApp {
  return {
    id: 'app-1',
    name: 'Storefront',
    slug: 'storefront',
    description: null,
    defaultLocaleId: 'locale-ar',
    defaultLocale: ARABIC as Locale,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  } as LocalizationApp;
}

describe('AppsService', () => {
  let service: AppsService;
  let apps: Record<string, jest.Mock>;
  let manager: Record<string, jest.Mock>;

  beforeEach(async () => {
    apps = {
      find: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (row: unknown) => row),
    };

    manager = {
      findOne: jest.fn(),
      create: jest.fn((_entity: unknown, row: unknown) => row),
      save: jest.fn(async (row: unknown) => row),
      insert: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AppsService,
        { provide: getRepositoryToken(LocalizationApp), useValue: apps },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(
              async (work: (m: unknown) => Promise<unknown>) => work(manager),
            ),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AppsService);
  });

  describe('create', () => {
    const dto: CreateAppDto = {
      name: 'Storefront',
      slug: 'storefront',
      defaultLocaleCode: 'ar',
    };

    it('writes the app and its default app_locales row in one transaction', async () => {
      manager.findOne.mockResolvedValue(ARABIC);
      manager.save.mockResolvedValue(appRow());

      const result = await service.create(dto);

      // The whole point of the ticket: an app is never created without the
      // default locale row that makes it resolvable.
      expect(manager.insert).toHaveBeenCalledWith(AppLocale, {
        appId: 'app-1',
        localeId: 'locale-ar',
        isDefault: true,
        isEnabled: true,
        fallbackLocaleId: null,
      });
      expect(result.defaultLocaleCode).toBe('ar');
    });

    it('canonicalizes the locale code before resolving it', async () => {
      manager.findOne.mockResolvedValue(ARABIC);
      manager.save.mockResolvedValue(appRow());

      await service.create({ ...dto, defaultLocaleCode: ' PT-br ' });

      expect(manager.findOne).toHaveBeenCalledWith(
        Locale,
        expect.objectContaining({ where: { code: 'pt-BR' } }),
      );
    });

    it('throws before writing anything when the default locale is unknown', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);

      // The throw is inside the transaction callback, so nothing commits — this
      // is what makes "no app row on a bad locale" true rather than hoped for.
      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('refuses an inactive locale as an app default', async () => {
      manager.findOne.mockResolvedValue({ ...ARABIC, isActive: false });

      await expect(service.create(dto)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('does not pre-check the slug, leaving uq_apps_slug to produce the 409', async () => {
      manager.findOne.mockResolvedValue(ARABIC);
      manager.save.mockResolvedValue(appRow());

      await service.create(dto);

      // One findOne, for the locale. A second would be a slug pre-check, and a
      // pre-check is a race two concurrent requests both win.
      expect(manager.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('404s on an unknown app', async () => {
      apps.findOne.mockResolvedValue(null);

      await expect(service.update('app-1', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('leaves omitted fields untouched', async () => {
      apps.findOne.mockResolvedValue(appRow({ description: 'Original.' }));

      const result = await service.update('app-1', { name: 'Renamed' });

      expect(result.name).toBe('Renamed');
      expect(result.description).toBe('Original.');
    });

    it('clears the description when it is explicitly null', async () => {
      apps.findOne.mockResolvedValue(appRow({ description: 'Original.' }));

      const result = await service.update('app-1', { description: null });

      expect(result.description).toBeNull();
    });

    it('never writes the slug, even if one reaches the service', async () => {
      apps.findOne.mockResolvedValue(appRow());

      const result = await service.update('app-1', {
        slug: 'renamed',
      } as never);

      // The DTO drops it at the pipe; this asserts the service is not a second
      // way in (invariant Rule 8).
      expect(result.slug).toBe('storefront');
    });
  });

  describe('findAll', () => {
    const query: ListAppsQueryDto = { page: 3, limit: 10 };

    it('paginates and orders by name', async () => {
      apps.findAndCount.mockResolvedValue([[appRow()], 41]);

      const result = await service.findAll(query);

      expect(apps.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
          order: { name: 'ASC' },
        }),
      );
      expect(result.meta.totalPages).toBe(5);
    });

    it('searches the name and the slug as an OR', async () => {
      apps.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ ...query, search: ' store ' });

      const [options] = apps.findAndCount.mock.calls[0];
      expect(options.where).toHaveLength(2);
    });
  });
});
