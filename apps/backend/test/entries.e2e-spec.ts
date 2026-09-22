import {
  Locale,
  LocalizationApp,
  TranslationEntry,
  TranslationModule,
  TranslationValue,
} from '@cms/database';
import request from 'supertest';
import { DataSource, In } from 'typeorm';

import {
  type TestUser,
  createTestApp,
  deleteTestUsers,
  signInAs,
} from './helpers/test-app';

import type { INestApplication } from '@nestjs/common';

const OWNED_APP_SLUGS = ['e2e-entries'];
const OWNED_GLOBAL_SLUGS = ['e2e-entries-global'];

describe('Entries (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let admin: TestUser;
  let editor: TestUser;
  let appId: string;
  let moduleId: string;
  let globalModuleId: string;
  let arabicId: string;

  const asAdmin = () => ({ Authorization: `Bearer ${admin.accessToken}` });
  const asEditor = () => ({ Authorization: `Bearer ${editor.accessToken}` });

  async function dropOwned(): Promise<void> {
    await dataSource
      .getRepository(TranslationModule)
      .delete({ slug: In(OWNED_GLOBAL_SLUGS) });
    // The app cascades to modules → entries → values.
    await dataSource
      .getRepository(LocalizationApp)
      .delete({ slug: In(OWNED_APP_SLUGS) });
  }

  async function createEntry(key: string, extra: object = {}) {
    const { body } = await request(app.getHttpServer())
      .post(`/api/modules/${moduleId}/entries`)
      .set(asAdmin())
      .send({ key, ...extra })
      .expect(201);

    return body.data;
  }

  async function listEntries(queryString = '') {
    const { body } = await request(app.getHttpServer())
      .get(`/api/modules/${moduleId}/entries${queryString}`)
      .set(asEditor())
      .expect(200);

    return body.data;
  }

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    await dropOwned();

    admin = await signInAs(app, 'admin');
    editor = await signInAs(app, 'editor');

    const { body: created } = await request(app.getHttpServer())
      .post('/api/apps')
      .set(asAdmin())
      .send({
        name: 'E2E entries',
        slug: 'e2e-entries',
        defaultLocaleCode: 'ar',
      })
      .expect(201);
    appId = created.data.id;

    // Two languages, so "missing in one of them" is a real state.
    await request(app.getHttpServer())
      .post(`/api/apps/${appId}/locales/en/enable`)
      .set(asAdmin())
      .expect(200);

    const { body: appModule } = await request(app.getHttpServer())
      .post(`/api/apps/${appId}/modules`)
      .set(asAdmin())
      .send({ name: 'Copy', slug: 'copy' })
      .expect(201);
    moduleId = appModule.data.id;

    const { body: globalModule } = await request(app.getHttpServer())
      .post('/api/modules/global')
      .set(asAdmin())
      .send({ name: 'Shared', slug: 'e2e-entries-global' })
      .expect(201);
    globalModuleId = globalModule.data.id;

    const arabic = await dataSource
      .getRepository(Locale)
      .findOneOrFail({ where: { code: 'ar' } });
    arabicId = arabic.id;
  });

  afterAll(async () => {
    await dropOwned();
    await deleteTestUsers(app, [admin.id, editor.id]);
    await app.close();
  });

  /**
   * One un-tokened request per endpoint. A single 401 would only prove the
   * global guard is registered — it would still pass if a later change put
   * `@Public()` on one of these routes (auth Rule 2).
   */
  describe('authentication', () => {
    const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

    it.each([
      ['GET /modules/:moduleId/entries', (): string => `/api/modules/${moduleId}/entries`, 'get'],
      ['POST /modules/:moduleId/entries', (): string => `/api/modules/${moduleId}/entries`, 'post'],
      ['GET /entries/:id', (): string => `/api/entries/${UNKNOWN_ID}`, 'get'],
      ['PATCH /entries/:id', (): string => `/api/entries/${UNKNOWN_ID}`, 'patch'],
      ['DELETE /entries/:id', (): string => `/api/entries/${UNKNOWN_ID}`, 'delete'],
    ] as const)('rejects %s without a token', async (_name, path, method) => {
      await request(app.getHttpServer())[method](path()).expect(401);
    });
  });

  describe('POST /modules/:moduleId/entries', () => {
    it('lets an editor create a key — writing copy is the job', async () => {
      const { body } = await request(app.getHttpServer())
        .post(`/api/modules/${moduleId}/entries`)
        .set(asEditor())
        .send({ key: 'editor_made_this' })
        .expect(201);

      expect(body.data).toMatchObject({
        moduleId,
        key: 'editor_made_this',
        contentType: 'text',
        description: null,
      });
    });

    it('refuses a duplicate key in the same module with 409', async () => {
      await createEntry('add_to_cart');

      await request(app.getHttpServer())
        .post(`/api/modules/${moduleId}/entries`)
        .set(asAdmin())
        .send({ key: 'add_to_cart' })
        .expect(409);
    });

    it('allows the same key in a different module', async () => {
      // `uq_entries_module_key` is per module — a global `add_to_cart` and an
      // app one are different keys, which is what makes Rule 5's app-before-
      // global resolution meaningful.
      await request(app.getHttpServer())
        .post(`/api/modules/${globalModuleId}/entries`)
        .set(asAdmin())
        .send({ key: 'add_to_cart' })
        .expect(201);
    });

    it('rejects a malformed key and an unknown contentType with 400', async () => {
      await request(app.getHttpServer())
        .post(`/api/modules/${moduleId}/entries`)
        .set(asAdmin())
        .send({ key: '.leading-dot' })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/modules/${moduleId}/entries`)
        .set(asAdmin())
        .send({ key: 'ok_key', contentType: 'markdown' })
        .expect(400);
    });

    it('404s for a module that does not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/modules/00000000-0000-4000-8000-000000000000/entries')
        .set(asAdmin())
        .send({ key: 'orphan' })
        .expect(404);
    });
  });

  describe('GET /modules/:moduleId/entries', () => {
    beforeAll(async () => {
      await createEntry('checkout.title', { description: 'Page heading.' });

      // Values are written directly: B6 owns the write path, B5 only reads it.
      const entry = await dataSource
        .getRepository(TranslationEntry)
        .findOneOrFail({ where: { moduleId, key: 'add_to_cart' } });

      await dataSource.getRepository(TranslationValue).save({
        entryId: entry.id,
        localeId: arabicId,
        value: 'أضف إلى السلة',
        status: 'published',
        publishedAt: new Date(),
      });
    });

    it('returns one row per entry, keyed by locale code, nulls included', async () => {
      const data = await listEntries('?search=add_to_cart');
      const row = data.records[0];

      // The response is nested; the storage is one row per (entry, locale).
      // Keeping those shapes distinct is the design (invariant Rule 1).
      expect(row).toMatchObject({
        key: 'add_to_cart',
        contentType: 'text',
        values: {
          ar: { value: 'أضف إلى السلة', status: 'published', version: 1 },
          en: null,
        },
      });
    });

    it('gives every enabled language a key, even with no values at all', async () => {
      const data = await listEntries('?search=checkout');

      expect(data.records[0].values).toEqual({ ar: null, en: null });
    });

    it('filters to entries with no value in a language', async () => {
      const data = await listEntries('?missingLocale=ar');
      const keys = data.records.map((row: { key: string }) => row.key);

      expect(keys).toContain('checkout.title');
      expect(keys).not.toContain('add_to_cart');
    });

    it('404s on an unknown missingLocale', async () => {
      await request(app.getHttpServer())
        .get(`/api/modules/${moduleId}/entries?missingLocale=zz`)
        .set(asAdmin())
        .expect(404);
    });

    it('paginates, ordered by key', async () => {
      const data = await listEntries('?limit=2&page=1');

      expect(data.meta).toMatchObject({ page: 1, limit: 2 });
      expect(data.records).toHaveLength(2);

      const keys = data.records.map((row: { key: string }) => row.key);
      expect([...keys]).toEqual([...keys].sort());
    });

    it('shows every active language for a global module', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/api/modules/${globalModuleId}/entries`)
        .set(asEditor())
        .expect(200);

      // A global namespace is shared by every app, so it is not scoped to one
      // app's enabled set.
      expect(Object.keys(body.data.records[0].values).sort()).toEqual([
        'ar',
        'en',
      ]);
    });

    it('stays one values query for a large page', async () => {
      const bulk = Array.from({ length: 120 }, (_, index) => ({
        moduleId,
        key: `bulk_${String(index).padStart(3, '0')}`,
        contentType: 'text' as const,
      }));
      await dataSource.getRepository(TranslationEntry).insert(bulk);

      const data = await listEntries('?limit=100&search=bulk_');

      expect(data.records).toHaveLength(100);
      expect(data.meta.total).toBe(120);
      // Every row still carries the full column set, built in one pass.
      for (const row of data.records) {
        expect(Object.keys(row.values).sort()).toEqual(['ar', 'en']);
      }
    });
  });

  describe('PATCH and DELETE /entries/:id', () => {
    let entryId: string;

    beforeAll(async () => {
      const created = await createEntry('to_be_edited');
      entryId = created.id;
    });

    it('lets an editor edit a key', async () => {
      const { body } = await request(app.getHttpServer())
        .patch(`/api/entries/${entryId}`)
        .set(asEditor())
        .send({ description: 'Now with context.' })
        .expect(200);

      expect(body.data).toMatchObject({
        key: 'to_be_edited',
        description: 'Now with context.',
      });
    });

    it('is readable by an editor', async () => {
      // The counterpart to a 403 test for a no-role route: `UserRole` is only
      // `admin | editor`, so there is no wrong-role identity to reject with —
      // an editor succeeding is what proves the route is deliberately open.
      const { body } = await request(app.getHttpServer())
        .get(`/api/entries/${entryId}`)
        .set(asEditor())
        .expect(200);

      expect(body.data).toMatchObject({ id: entryId, moduleId });
    });

    it('rejects a moduleId in the body with 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/entries/${entryId}`)
        .set(asAdmin())
        .send({ moduleId: globalModuleId })
        .expect(400);
    });

    it('409s when a rename collides with an existing key', async () => {
      await request(app.getHttpServer())
        .patch(`/api/entries/${entryId}`)
        .set(asAdmin())
        .send({ key: 'add_to_cart' })
        .expect(409);
    });

    it('gives an editor 403 on delete, not 401', async () => {
      // Deleting cascades to every language's value and its history, so it is
      // narrower than creating.
      await request(app.getHttpServer())
        .delete(`/api/entries/${entryId}`)
        .set(asEditor())
        .expect(403);
    });

    it('lets an admin delete, and the key is gone afterwards', async () => {
      await request(app.getHttpServer())
        .delete(`/api/entries/${entryId}`)
        .set(asAdmin())
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/entries/${entryId}`)
        .set(asAdmin())
        .expect(404);
    });

    it('404s on an unknown id and 400s on a non-uuid', async () => {
      await request(app.getHttpServer())
        .delete('/api/entries/00000000-0000-4000-8000-000000000000')
        .set(asAdmin())
        .expect(404);

      await request(app.getHttpServer())
        .get('/api/entries/not-a-uuid')
        .set(asAdmin())
        .expect(400);
    });
  });
});
