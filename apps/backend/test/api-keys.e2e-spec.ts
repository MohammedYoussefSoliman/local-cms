import { ApiKey, LocalizationApp } from '@cms/database';
import request from 'supertest';
import { DataSource, In } from 'typeorm';

import { ApiKeysService } from '../src/modules/api-keys/api-keys.service';

import {
  type TestUser,
  createTestApp,
  deleteTestUsers,
  signInAs,
} from './helpers/test-app';

import type { INestApplication } from '@nestjs/common';

const OWNED_APP_SLUGS = [
  'e2e-api-keys',
  'e2e-api-keys-other',
  'e2e-api-keys-tmp',
];
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('API keys (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let apiKeys: ApiKeysService;
  let admin: TestUser;
  let editor: TestUser;
  let appId: string;
  let otherAppId: string;

  const asAdmin = () => ({ Authorization: `Bearer ${admin.accessToken}` });
  const asEditor = () => ({ Authorization: `Bearer ${editor.accessToken}` });

  async function dropOwned(): Promise<void> {
    // `api_keys.app_id` is ON DELETE CASCADE, so the keys go with the apps.
    await dataSource
      .getRepository(LocalizationApp)
      .delete({ slug: In(OWNED_APP_SLUGS) });
  }

  async function createApp(name: string, slug: string): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post('/api/apps')
      .set(asAdmin())
      .send({ name, slug, defaultLocaleCode: 'ar' })
      .expect(201);

    return body.data.id;
  }

  async function createKey(name: string, forApp = appId) {
    const { body } = await request(app.getHttpServer())
      .post(`/api/apps/${forApp}/api-keys`)
      .set(asAdmin())
      .send({ name })
      .expect(201);

    return body.data;
  }

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    apiKeys = app.get(ApiKeysService);

    await dropOwned();

    admin = await signInAs(app, 'admin');
    editor = await signInAs(app, 'editor');

    appId = await createApp('E2E api keys', 'e2e-api-keys');
    otherAppId = await createApp('E2E api keys other', 'e2e-api-keys-other');
  });

  afterAll(async () => {
    await dropOwned();
    await deleteTestUsers(app, [admin.id, editor.id]);
    await app.close();
  });

  describe('authentication', () => {
    it.each([
      [
        'GET /apps/:appId/api-keys',
        (): string => `/api/apps/${appId}/api-keys`,
        'get',
      ],
      [
        'POST /apps/:appId/api-keys',
        (): string => `/api/apps/${appId}/api-keys`,
        'post',
      ],
      [
        'DELETE /api-keys/:id',
        (): string => `/api/api-keys/${UNKNOWN_ID}`,
        'delete',
      ],
    ] as const)('rejects %s without a token', async (_name, path, method) => {
      await request(app.getHttpServer())[method](path()).expect(401);
    });

    it.each([
      [
        'GET /apps/:appId/api-keys',
        (): string => `/api/apps/${appId}/api-keys`,
        'get',
      ],
      [
        'POST /apps/:appId/api-keys',
        (): string => `/api/apps/${appId}/api-keys`,
        'post',
      ],
      [
        'DELETE /api-keys/:id',
        (): string => `/api/api-keys/${UNKNOWN_ID}`,
        'delete',
      ],
    ] as const)('gives an editor 403 on %s, not 401', async (_n, path, method) => {
      // A credential reads an app's whole published catalogue, so issuing or
      // even enumerating one is an admin decision (auth Rule 3 on the codes).
      const call = request(app.getHttpServer())[method](path());
      await call.set(asEditor()).send({ name: 'nope' }).expect(403);
    });
  });

  describe('POST /apps/:appId/api-keys', () => {
    it('returns the plaintext key exactly once', async () => {
      const created = await createKey('storefront web');

      expect(created).toMatchObject({
        appId,
        name: 'storefront web',
        revokedAt: null,
        lastUsedAt: null,
        createdBy: admin.id,
      });
      expect(created.key).toMatch(/^cms_[0-9a-f]{8}\./);
      expect(created.prefix).toHaveLength(12);

      // Every later read of the same key is prefix-only.
      const { body } = await request(app.getHttpServer())
        .get(`/api/apps/${appId}/api-keys`)
        .set(asAdmin())
        .expect(200);

      const listed = body.data.find(
        (row: { id: string }) => row.id === created.id,
      );
      expect(listed).toBeDefined();
      expect(listed).not.toHaveProperty('key');
      expect(listed).not.toHaveProperty('keyHash');
    });

    it('stores only the hash', async () => {
      const created = await createKey('hash check');

      const stored = await dataSource
        .getRepository(ApiKey)
        .findOneOrFail({ where: { id: created.id } });

      expect(stored.keyHash).not.toBe(created.key);
      expect(stored.keyHash).toHaveLength(64);
    });

    it('400s without a name and 404s for an app that does not exist', async () => {
      await request(app.getHttpServer())
        .post(`/api/apps/${appId}/api-keys`)
        .set(asAdmin())
        .send({})
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/apps/${UNKNOWN_ID}/api-keys`)
        .set(asAdmin())
        .send({ name: 'orphan' })
        .expect(404);
    });
  });

  describe('resolution and revocation', () => {
    it('resolves a live key to its app and stops resolving once revoked', async () => {
      const created = await createKey('to be revoked');

      // The guard's lookup, against the real partial filter.
      const resolved = await apiKeys.resolve(created.key);
      expect(resolved).toMatchObject({ id: created.id, appId });

      const { body } = await request(app.getHttpServer())
        .delete(`/api/api-keys/${created.id}`)
        .set(asAdmin())
        .expect(200);

      expect(body.data.revokedAt).not.toBeNull();

      // A revoked key is indistinguishable from one that never existed, which
      // is what turns into a 401 at the guard.
      await expect(apiKeys.resolve(created.key)).resolves.toBeNull();
    });

    it('keeps the row and its audit fields after revocation', async () => {
      const created = await createKey('audit survives');

      await request(app.getHttpServer())
        .delete(`/api/api-keys/${created.id}`)
        .set(asAdmin())
        .expect(200);

      const stored = await dataSource
        .getRepository(ApiKey)
        .findOne({ where: { id: created.id } });

      expect(stored).not.toBeNull();
      expect(stored?.createdBy).toBe(admin.id);
    });

    it('records last_used_at when a key is used', async () => {
      const created = await createKey('touch me');

      await apiKeys.resolve(created.key);

      const stored = await dataSource
        .getRepository(ApiKey)
        .findOneOrFail({ where: { id: created.id } });

      expect(stored.lastUsedAt).not.toBeNull();
    });

    it('is idempotent and keeps the first revocation timestamp', async () => {
      const created = await createKey('revoke twice');

      const first = await request(app.getHttpServer())
        .delete(`/api/api-keys/${created.id}`)
        .set(asAdmin())
        .expect(200);

      const second = await request(app.getHttpServer())
        .delete(`/api/api-keys/${created.id}`)
        .set(asAdmin())
        .expect(200);

      expect(second.body.data.revokedAt).toBe(first.body.data.revokedAt);
    });

    it('404s for a key that does not exist and 400s on a non-uuid', async () => {
      await request(app.getHttpServer())
        .delete(`/api/api-keys/${UNKNOWN_ID}`)
        .set(asAdmin())
        .expect(404);

      await request(app.getHttpServer())
        .delete('/api/api-keys/not-a-uuid')
        .set(asAdmin())
        .expect(400);
    });
  });

  describe('scoping', () => {
    it('refuses a key against an app it was not issued for', async () => {
      const created = await createKey('app A only');
      const resolved = await apiKeys.resolve(created.key);

      if (!resolved) throw new Error('the key it just issued did not resolve');

      // The 403 half of B7's "a key for app A against app B's bundle". The
      // route that calls this arrives with B8's runtime controller.
      expect(() => apiKeys.assertServesApp(resolved, otherAppId)).toThrow(
        /not issued for this application/,
      );
      expect(() => apiKeys.assertServesApp(resolved, appId)).not.toThrow();
    });

    it('lists only the keys belonging to the app in the route', async () => {
      await createKey('belongs to other', otherAppId);

      const { body } = await request(app.getHttpServer())
        .get(`/api/apps/${appId}/api-keys`)
        .set(asAdmin())
        .expect(200);

      expect(
        body.data.every((row: { appId: string }) => row.appId === appId),
      ).toBe(true);
    });

    it('goes with its app when the app is deleted', async () => {
      const disposableId = await createApp('E2E throwaway', 'e2e-api-keys-tmp');
      const created = await createKey('disposable', disposableId);

      await dataSource.getRepository(LocalizationApp).delete(disposableId);

      expect(
        await dataSource.getRepository(ApiKey).count({
          where: { id: created.id },
        }),
      ).toBe(0);
    });
  });
});
