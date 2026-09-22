import { AppLocale, Locale, LocalizationApp } from '@cms/database';
import request from 'supertest';
import { DataSource, In } from 'typeorm';

import {
  type TestUser,
  createTestApp,
  deleteTestUsers,
  signInAs,
} from './helpers/test-app';

import type { INestApplication } from '@nestjs/common';

/**
 * Slugs and locale codes this suite owns. The bootstrap locales `ar` and `en`
 * are seeded data and are read but never written (testing Rule 5).
 */
const OWNED_SLUGS = ['e2e-storefront', 'e2e-admin-panel', 'e2e-rollback'];
const OWNED_CODES = ['nl'];

describe('Apps (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let admin: TestUser;
  let editor: TestUser;
  let dutchId: string;

  const asAdmin = () => ({ Authorization: `Bearer ${admin.accessToken}` });
  const asEditor = () => ({ Authorization: `Bearer ${editor.accessToken}` });

  /** `app_locales` is ON DELETE CASCADE from `apps`, so the rows go with them. */
  async function dropOwnedApps(): Promise<void> {
    await dataSource
      .getRepository(LocalizationApp)
      .delete({ slug: In(OWNED_SLUGS) });
    await dataSource.getRepository(Locale).delete({ code: In(OWNED_CODES) });
  }

  /** Creates an app through the API and returns its response body. */
  async function createApp(slug: string, defaultLocaleCode = 'en') {
    const { body } = await request(app.getHttpServer())
      .post('/api/apps')
      .set(asAdmin())
      .send({ name: `E2E ${slug}`, slug, defaultLocaleCode })
      .expect(201);

    return body.data;
  }

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    // Defensive: an interrupted previous run would otherwise make the first
    // create a 409 on `uq_apps_slug`.
    await dropOwnedApps();

    admin = await signInAs(app, 'admin');
    editor = await signInAs(app, 'editor');

    // A third language, so a fallback can point somewhere that is not the
    // app's default.
    const { body } = await request(app.getHttpServer())
      .post('/api/locales')
      .set(asAdmin())
      .send({ code: 'nl', name: 'Dutch', nativeName: 'Nederlands' })
      .expect(201);
    dutchId = body.data.id;
  });

  afterAll(async () => {
    await dropOwnedApps();
    await deleteTestUsers(app, [admin.id, editor.id]);
    await app.close();
  });

  describe('GET /apps', () => {
    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/api/apps').expect(401);
    });

    it('is readable by an editor, paginated, inside the envelope', async () => {
      await createApp('e2e-storefront');

      const { body } = await request(app.getHttpServer())
        .get('/api/apps?search=e2e-storefront')
        .set(asEditor())
        .expect(200);

      expect(body).toMatchObject({
        statusCode: 200,
        message: null,
        data: {
          records: expect.any(Array),
          meta: { page: 1, limit: 20, total: expect.any(Number) },
        },
      });
      expect(body.data.records.map((row: { slug: string }) => row.slug)).toContain(
        'e2e-storefront',
      );
    });
  });

  describe('POST /apps', () => {
    it('gives a non-admin 403, not 401', async () => {
      // 401 would make the dashboard log the editor out for opening a page they
      // merely lack permission for (auth Rule 3).
      await request(app.getHttpServer())
        .post('/api/apps')
        .set(asEditor())
        .send({ name: 'Nope', slug: 'e2e-nope', defaultLocaleCode: 'en' })
        .expect(403);
    });

    it('creates the app and its default app_locales row together', async () => {
      const created = await createApp('e2e-admin-panel', 'ar');

      expect(created).toMatchObject({
        name: 'E2E e2e-admin-panel',
        slug: 'e2e-admin-panel',
        description: null,
        defaultLocaleCode: 'ar',
      });

      const { body } = await request(app.getHttpServer())
        .get(`/api/apps/${created.id}/locales`)
        .set(asEditor())
        .expect(200);

      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        isDefault: true,
        isEnabled: true,
        fallbackLocaleCode: null,
        locale: { code: 'ar', direction: 'rtl' },
      });
    });

    it('rolls back completely when the default locale does not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/apps')
        .set(asAdmin())
        .send({
          name: 'E2E rollback',
          slug: 'e2e-rollback',
          defaultLocaleCode: 'zz',
        })
        .expect(404);

      // The done-when that matters: no orphan app row survives the failure.
      const orphan = await dataSource
        .getRepository(LocalizationApp)
        .findOne({ where: { slug: 'e2e-rollback' } });

      expect(orphan).toBeNull();
    });

    it('rejects a duplicate slug with 409 from uq_apps_slug', async () => {
      await request(app.getHttpServer())
        .post('/api/apps')
        .set(asAdmin())
        .send({
          name: 'Duplicate',
          slug: 'e2e-storefront',
          defaultLocaleCode: 'en',
        })
        .expect(409);
    });

    it('rejects a slug that is not lowercase-hyphenated', async () => {
      await request(app.getHttpServer())
        .post('/api/apps')
        .set(asAdmin())
        .send({
          name: 'Bad',
          slug: '../etc/passwd',
          defaultLocaleCode: 'en',
        })
        .expect(400);
    });
  });

  describe('PATCH /apps/:id', () => {
    it('gives a non-admin 403', async () => {
      const created = await createApp('e2e-rollback');

      await request(app.getHttpServer())
        .patch(`/api/apps/${created.id}`)
        .set(asEditor())
        .send({ name: 'Renamed' })
        .expect(403);
    });

    it('rejects a slug in the body with 400', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/apps?search=e2e-storefront')
        .set(asAdmin())
        .expect(200);
      const id = body.data.records[0].id;

      // Rule 8, enforced by the field's absence from UpdateAppDto plus
      // `forbidNonWhitelisted` — not by a runtime check.
      await request(app.getHttpServer())
        .patch(`/api/apps/${id}`)
        .set(asAdmin())
        .send({ slug: 'renamed' })
        .expect(400);
    });

    it('updates the name and leaves the slug alone', async () => {
      const { body: list } = await request(app.getHttpServer())
        .get('/api/apps?search=e2e-storefront')
        .set(asAdmin())
        .expect(200);
      const id = list.data.records[0].id;

      const { body } = await request(app.getHttpServer())
        .patch(`/api/apps/${id}`)
        .set(asAdmin())
        .send({ name: 'Renamed storefront' })
        .expect(200);

      expect(body.data).toMatchObject({
        name: 'Renamed storefront',
        slug: 'e2e-storefront',
      });
    });

    it('404s on an unknown id and 400s on a non-uuid', async () => {
      await request(app.getHttpServer())
        .patch('/api/apps/00000000-0000-4000-8000-000000000000')
        .set(asAdmin())
        .send({ name: 'x' })
        .expect(404);

      await request(app.getHttpServer())
        .patch('/api/apps/not-a-uuid')
        .set(asAdmin())
        .send({ name: 'x' })
        .expect(400);
    });
  });

  describe('app locales', () => {
    let appId: string;

    beforeAll(async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/apps?search=e2e-admin-panel')
        .set(asAdmin())
        .expect(200);
      appId = body.data.records[0].id;
    });

    it('rejects an unauthenticated request to the sub-resource', async () => {
      await request(app.getHttpServer())
        .get(`/api/apps/${appId}/locales`)
        .expect(401);
    });

    /**
     * One case per mutating route rather than one for the set. These assertions
     * are the regression net under `@Roles('admin')`: dropping the decorator
     * from any of the three has to fail a test, not just an audit.
     */
    it.each([
      ['enable', () => request(app.getHttpServer()).post(`/api/apps/${appId}/locales/en/enable`)],
      ['disable', () => request(app.getHttpServer()).delete(`/api/apps/${appId}/locales/en/disable`)],
      [
        'fallback',
        () =>
          request(app.getHttpServer())
            .patch(`/api/apps/${appId}/locales/en/fallback`)
            .send({ fallbackLocaleCode: null }),
      ],
    ])('gives a non-admin 403 on %s, not 401', async (_name, call) => {
      await call().set(asEditor()).expect(403);
    });

    it('enables a locale, and is idempotent', async () => {
      const first = await request(app.getHttpServer())
        .post(`/api/apps/${appId}/locales/en/enable`)
        .set(asAdmin())
        .expect(200);

      expect(first.body.data).toMatchObject({
        isDefault: false,
        isEnabled: true,
        locale: { code: 'en' },
      });

      await request(app.getHttpServer())
        .post(`/api/apps/${appId}/locales/en/enable`)
        .set(asAdmin())
        .expect(200);

      const { body } = await request(app.getHttpServer())
        .get(`/api/apps/${appId}/locales`)
        .set(asAdmin())
        .expect(200);

      expect(body.data).toHaveLength(2);
    });

    it('resolves the locale code case-insensitively', async () => {
      // `EN` and `en` are the same language; the canonicalizer is what makes a
      // URL segment with the wrong casing resolve instead of 404.
      const { body } = await request(app.getHttpServer())
        .post(`/api/apps/${appId}/locales/EN/enable`)
        .set(asAdmin())
        .expect(200);

      expect(body.data.locale.code).toBe('en');
    });

    it('404s on a locale that does not exist', async () => {
      await request(app.getHttpServer())
        .post(`/api/apps/${appId}/locales/zz/enable`)
        .set(asAdmin())
        .expect(404);
    });

    it('refuses to disable the default locale with 422', async () => {
      await request(app.getHttpServer())
        .delete(`/api/apps/${appId}/locales/ar/disable`)
        .set(asAdmin())
        .expect(422);
    });

    it('disables a non-default locale, keeping its row and its fallback', async () => {
      await request(app.getHttpServer())
        .patch(`/api/apps/${appId}/locales/en/fallback`)
        .set(asAdmin())
        .send({ fallbackLocaleCode: 'ar' })
        .expect(200);

      const { body } = await request(app.getHttpServer())
        .delete(`/api/apps/${appId}/locales/en/disable`)
        .set(asAdmin())
        .expect(200);

      expect(body.data).toMatchObject({
        isEnabled: false,
        fallbackLocaleCode: 'ar',
      });

      // Re-enabling restores the configuration rather than starting fresh.
      const { body: reEnabled } = await request(app.getHttpServer())
        .post(`/api/apps/${appId}/locales/en/enable`)
        .set(asAdmin())
        .expect(200);

      expect(reEnabled.data).toMatchObject({
        isEnabled: true,
        fallbackLocaleCode: 'ar',
      });
    });

    it('refuses a self-referencing fallback with 422 from the CHECK constraint', async () => {
      await request(app.getHttpServer())
        .patch(`/api/apps/${appId}/locales/en/fallback`)
        .set(asAdmin())
        .send({ fallbackLocaleCode: 'en' })
        .expect(422);
    });

    it('refuses a fallback the app does not serve', async () => {
      await request(app.getHttpServer())
        .patch(`/api/apps/${appId}/locales/en/fallback`)
        .set(asAdmin())
        .send({ fallbackLocaleCode: 'nl' })
        .expect(422);
    });

    it('clears the fallback on an explicit null, and rejects an empty body', async () => {
      const { body } = await request(app.getHttpServer())
        .patch(`/api/apps/${appId}/locales/en/fallback`)
        .set(asAdmin())
        .send({ fallbackLocaleCode: null })
        .expect(200);

      expect(body.data.fallbackLocaleCode).toBeNull();

      // Omitting the field is a 400, not a silent clear.
      await request(app.getHttpServer())
        .patch(`/api/apps/${appId}/locales/en/fallback`)
        .set(asAdmin())
        .send({})
        .expect(400);
    });

    it('404s when the locale is not configured for the app', async () => {
      await request(app.getHttpServer())
        .patch(`/api/apps/${appId}/locales/nl/fallback`)
        .set(asAdmin())
        .send({ fallbackLocaleCode: 'ar' })
        .expect(404);
    });

    it('refuses a second default locale at the database level', async () => {
      // No endpoint can produce this — `enable` always writes `isDefault: false`
      // — so the partial unique index is asserted directly. It is the only
      // thing standing between a bug in a future endpoint and an app with two
      // authoring languages.
      await expect(
        dataSource.getRepository(AppLocale).insert({
          appId,
          localeId: dutchId,
          isDefault: true,
          isEnabled: true,
          fallbackLocaleId: null,
        }),
      ).rejects.toMatchObject({ constraint: 'uq_app_locales_one_default' });
    });
  });
});
