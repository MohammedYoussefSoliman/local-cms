import { TranslationModule } from '@cms/database';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AppsService } from '../apps/apps.service';

import { TranslationModulesService } from './translation-modules.service';

import type { ListTranslationModulesQueryDto } from './dto/list-translation-modules.query.dto';

function moduleRow(
  overrides: Partial<TranslationModule> = {},
): TranslationModule {
  return {
    id: 'module-1',
    appId: 'app-1',
    name: 'Products',
    slug: 'products',
    scope: 'app',
    description: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  } as TranslationModule;
}

describe('TranslationModulesService', () => {
  let service: TranslationModulesService;
  let modules: Record<string, jest.Mock>;
  let apps: { findEntityOrFail: jest.Mock };

  beforeEach(async () => {
    modules = {
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      findOne: jest.fn(),
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: unknown) => row),
    };
    apps = { findEntityOrFail: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TranslationModulesService,
        { provide: getRepositoryToken(TranslationModule), useValue: modules },
        { provide: AppsService, useValue: apps },
      ],
    }).compile();

    service = moduleRef.get(TranslationModulesService);
  });

  describe('scope comes from the route', () => {
    it('creates an app-scoped module with the appId from the path', async () => {
      modules.save.mockResolvedValue(moduleRow());

      await service.createForApp('app-1', {
        name: 'Products',
        slug: 'products',
      });

      expect(modules.create).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'app', appId: 'app-1' }),
      );
    });

    it('creates a global module with a null appId', async () => {
      modules.save.mockResolvedValue(
        moduleRow({ appId: null, scope: 'global', slug: 'authentication' }),
      );

      await service.createGlobal({
        name: 'Authentication',
        slug: 'authentication',
      });

      expect(modules.create).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'global', appId: null }),
      );
    });

    it('ignores a scope smuggled past the DTO rather than reconciling it', async () => {
      modules.save.mockResolvedValue(moduleRow());

      await service.createForApp('app-1', {
        name: 'Products',
        slug: 'products',
        scope: 'global',
        appId: null,
      } as never);

      // The route wins. There is no fix-up branch to get wrong, and a pair the
      // service could not construct is a pair `ck_modules_scope_app_id` never
      // has to reject (invariant Rule 2).
      expect(modules.create).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'app', appId: 'app-1' }),
      );
    });

    it('404s before writing when the app does not exist', async () => {
      apps.findEntityOrFail.mockRejectedValue(new NotFoundException());

      await expect(
        service.createForApp('app-1', { name: 'P', slug: 'products' }),
      ).rejects.toThrow(NotFoundException);
      expect(modules.save).not.toHaveBeenCalled();
    });

    it('does not pre-check the slug, leaving the partial indexes to 409', async () => {
      modules.save.mockResolvedValue(moduleRow());

      await service.createGlobal({ name: 'Auth', slug: 'authentication' });

      expect(modules.findOne).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('404s on an unknown id', async () => {
      modules.findOne.mockResolvedValue(null);

      await expect(service.update('module-1', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('never writes the slug or the scope, even if they reach the service', async () => {
      modules.findOne.mockResolvedValue(moduleRow());

      const result = await service.update('module-1', {
        slug: 'renamed',
        scope: 'global',
      } as never);

      expect(result.slug).toBe('products');
      expect(result.scope).toBe('app');
      expect(result.appId).toBe('app-1');
    });

    it('leaves omitted fields untouched and clears an explicit null', async () => {
      modules.findOne.mockResolvedValue(moduleRow({ description: 'Original.' }));

      const kept = await service.update('module-1', { name: 'Catalogue' });
      expect(kept.description).toBe('Original.');

      modules.findOne.mockResolvedValue(moduleRow({ description: 'Original.' }));
      const cleared = await service.update('module-1', { description: null });
      expect(cleared.description).toBeNull();
    });
  });

  describe('listing', () => {
    const query: ListTranslationModulesQueryDto = { page: 2, limit: 10 };

    it('scopes the app list to the app and paginates', async () => {
      await service.findAllForApp('app-1', query);

      expect(modules.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { appId: 'app-1' },
          take: 10,
          skip: 10,
          order: { slug: 'ASC' },
        }),
      );
    });

    it('lists global modules by scope', async () => {
      await service.findAllGlobal(query);

      expect(modules.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { scope: 'global' } }),
      );
    });

    it('repeats the scope into every OR branch of a search', async () => {
      await service.findAllForApp('app-1', { ...query, search: 'prod' });

      const [options] = modules.findAndCount.mock.calls[0];
      // Without this, searching would return modules belonging to other apps —
      // an array of conditions is OR'd, not AND'd.
      expect(options.where).toHaveLength(2);
      for (const branch of options.where) {
        expect(branch.appId).toBe('app-1');
      }
    });
  });
});
