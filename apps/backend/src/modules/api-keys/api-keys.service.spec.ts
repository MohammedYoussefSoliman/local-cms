import { createHash } from 'node:crypto';

import { ApiKey } from '@cms/database';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';

import { AppsService } from '../apps/apps.service';

import { ApiKeysService } from './api-keys.service';

function keyRow(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: 'key-1',
    appId: 'app-1',
    name: 'storefront web',
    prefix: 'cms_a3f91b2c',
    keyHash: 'hashed',
    lastUsedAt: null,
    revokedAt: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as ApiKey;
}

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let keys: Record<string, jest.Mock>;

  beforeEach(async () => {
    keys = {
      find: jest.fn(async () => [keyRow()]),
      findOne: jest.fn(),
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: Partial<ApiKey>) => keyRow(row)),
      update: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: getRepositoryToken(ApiKey), useValue: keys },
        {
          provide: AppsService,
          useValue: { findEntityOrFail: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = moduleRef.get(ApiKeysService);
  });

  describe('create', () => {
    it('returns the plaintext key once and stores only its hash', async () => {
      const created = await service.create('app-1', { name: 'web' }, 'user-1');

      const stored = keys.save.mock.calls[0][0] as ApiKey;
      expect(stored.keyHash).toBe(
        createHash('sha256').update(created.key).digest('hex'),
      );
      // The plaintext is never written to a column, and nothing can re-derive
      // it from what is.
      expect(JSON.stringify(stored)).not.toContain(created.key);
    });

    it('prefixes the key with the displayable segment it stores', async () => {
      const created = await service.create('app-1', { name: 'web' }, 'user-1');

      expect(created.key.startsWith(`${created.prefix}.`)).toBe(true);
      expect(created.prefix).toMatch(/^cms_[0-9a-f]{8}$/);
      // `prefix` is varchar(12); an overrun would only fail at the database.
      expect(created.prefix).toHaveLength(12);
    });

    it('never puts the hash in the response', async () => {
      const created = await service.create('app-1', { name: 'web' }, 'user-1');

      expect(created).not.toHaveProperty('keyHash');
    });

    it('generates a different key every time', async () => {
      const first = await service.create('app-1', { name: 'a' }, 'user-1');
      const second = await service.create('app-1', { name: 'b' }, 'user-1');

      expect(first.key).not.toBe(second.key);
    });
  });

  describe('findAll', () => {
    it('never exposes the hash of an existing key', async () => {
      const [record] = await service.findAll('app-1');

      expect(record).not.toHaveProperty('keyHash');
      expect(record).toMatchObject({ prefix: 'cms_a3f91b2c' });
    });
  });

  describe('revoke', () => {
    it('sets revoked_at and keeps the row', async () => {
      keys.findOne.mockResolvedValue(keyRow());

      const result = await service.revoke('key-1');

      expect(result.revokedAt).not.toBeNull();
      // The audit needs the row: who issued it and when it was last used.
      expect(keys.save).toHaveBeenCalled();
    });

    it('keeps the original timestamp when revoked twice', async () => {
      const revokedAt = new Date('2026-03-01T00:00:00.000Z');
      keys.findOne.mockResolvedValue(keyRow({ revokedAt }));

      const result = await service.revoke('key-1');

      expect(result.revokedAt).toBe(revokedAt.toISOString());
    });

    it('404s for a key that does not exist', async () => {
      keys.findOne.mockResolvedValue(null);

      await expect(service.revoke('key-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('resolve', () => {
    it('looks the key up by hash, excluding revoked rows', async () => {
      keys.findOne.mockResolvedValue(keyRow());

      await service.resolve('cms_a3f91b2c.secret');

      expect(keys.findOne).toHaveBeenCalledWith({
        where: {
          keyHash: createHash('sha256')
            .update('cms_a3f91b2c.secret')
            .digest('hex'),
          revokedAt: IsNull(),
        },
      });
    });

    it('returns null for a key that does not match', async () => {
      keys.findOne.mockResolvedValue(null);

      await expect(service.resolve('nonsense')).resolves.toBeNull();
    });

    it('touches last_used_at on a cold key', async () => {
      keys.findOne.mockResolvedValue(keyRow({ lastUsedAt: null }));

      await service.resolve('cms_a3f91b2c.secret');

      expect(keys.update).toHaveBeenCalledWith(
        { id: 'key-1' },
        expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      );
    });

    it('does not write last_used_at again within the interval', async () => {
      // Otherwise every runtime read — the cacheable, high-volume path — turns
      // into a write.
      keys.findOne.mockResolvedValue(keyRow({ lastUsedAt: new Date() }));

      await service.resolve('cms_a3f91b2c.secret');

      expect(keys.update).not.toHaveBeenCalled();
    });
  });

  describe('assertServesApp', () => {
    it('passes for the app the key was issued for', () => {
      expect(() =>
        service.assertServesApp({ appId: 'app-1' }, 'app-1'),
      ).not.toThrow();
    });

    it('403s for any other app', () => {
      // 403, not 401: the credential is valid, it just is not valid *here*
      // (auth Rule 3).
      expect(() =>
        service.assertServesApp({ appId: 'app-1' }, 'app-2'),
      ).toThrow(ForbiddenException);
    });
  });
});
