import { Locale } from '@cms/database';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { LocalesService } from './locales.service';

import type { CreateLocaleDto } from './dto/create-locale.dto';
import type { ListLocalesQueryDto } from './dto/list-locales.query.dto';

const french: CreateLocaleDto = {
  code: 'fr',
  name: 'French',
  nativeName: 'Français',
  direction: 'ltr',
};

function storedLocale(overrides: Partial<Locale> = {}): Locale {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as Locale;
}

describe('LocalesService', () => {
  let service: LocalesService;
  let locales: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    findAndCount: jest.Mock;
  };

  beforeEach(async () => {
    locales = {
      create: jest.fn((row: Partial<Locale>) => row),
      save: jest.fn(async (row: Partial<Locale>) => storedLocale(row)),
      findOne: jest.fn(),
      findAndCount: jest.fn(async () => [[], 0]),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        LocalesService,
        { provide: getRepositoryToken(Locale), useValue: locales },
      ],
    }).compile();

    service = moduleRef.get(LocalesService);
  });

  describe('create', () => {
    /**
     * Invariant Rule 1. If this ever needs a migration or a type change to
     * pass, the central design decision of the whole CMS has been undone.
     */
    it('adds a new language as a plain insert', async () => {
      const result = await service.create(french);

      expect(locales.save).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'fr', name: 'French' }),
      );
      expect(result.code).toBe('fr');
    });

    it('canonicalizes the code so one language cannot be stored twice', async () => {
      // `uq_locales_code` is case-sensitive, so `PT-br` and `pt-BR` would both
      // insert and the runtime would resolve neither reliably.
      await service.create({ ...french, code: ' PT-br ' });

      expect(locales.save).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'pt-BR' }),
      );
    });

    it('does not pre-check uniqueness before inserting', async () => {
      // The unique index is the check. A SELECT-then-INSERT is a race both
      // concurrent requests pass (typeorm Rule 5) — the 409 comes from the
      // constraint via HttpExceptionFilter, not from here.
      await service.create(french);

      expect(locales.findOne).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects an unknown id with 404', async () => {
      locales.findOne.mockResolvedValue(null);

      await expect(
        service.update('22222222-2222-2222-2222-222222222222', {
          name: 'Arabic (Saudi Arabia)',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('leaves omitted fields alone rather than nulling them', async () => {
      locales.findOne.mockResolvedValue(storedLocale());

      await service.update('11111111-1111-1111-1111-111111111111', {
        isActive: false,
      });

      expect(locales.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
          name: 'Arabic',
          nativeName: 'العربية',
          direction: 'rtl',
        }),
      );
    });

    it('never writes the code, even when one reaches the service', async () => {
      locales.findOne.mockResolvedValue(storedLocale());

      // `forbidNonWhitelisted` rejects this at the HTTP edge; this asserts the
      // service is not a second way in. The code is in runtime bundle URLs.
      await service.update('11111111-1111-1111-1111-111111111111', {
        name: 'Arabic',
        code: 'xx',
      } as never);

      expect(locales.save).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ar' }),
      );
    });
  });

  describe('findAll', () => {
    it('paginates instead of reading the table', async () => {
      const query = { page: 3, limit: 20 } as ListLocalesQueryDto;

      await service.findAll(query);

      expect(locales.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 40, order: { code: 'ASC' } }),
      );
    });

    it('reports the page count the dashboard needs', async () => {
      locales.findAndCount.mockResolvedValue([[storedLocale()], 41]);

      const result = await service.findAll({
        page: 1,
        limit: 20,
      } as ListLocalesQueryDto);

      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 41,
        totalPages: 3,
      });
    });

    it('searches the code, the English name and the endonym', async () => {
      await service.findAll({
        page: 1,
        limit: 20,
        search: 'ara',
      } as ListLocalesQueryDto);

      const [[options]] = locales.findAndCount.mock.calls;
      expect(options.where).toHaveLength(3);
    });
  });
});
