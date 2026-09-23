import { LocalizationApp, TranslationModule } from '@cms/database';
import request from 'supertest';
import { DataSource, In } from 'typeorm';

import {
  type TestUser,
  createTestApp,
  deleteTestUsers,
  signInAs,
} from './helpers/test-app';

import type { INestApplication } from '@nestjs/common';

const OWNED_APP_SLUGS = ['e2e-runtime', 'e2e-runtime-other'];
const OWNED_GLOBAL_SLUGS = ['e2e-runtime-shared', 'e2e-runtime-global-only'];

describe('Runtime read API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let admin: TestUser;
  let appId: string;
  let moduleId: string;
  let globalModuleId: string;
  let globalOnlyModuleId: string;
  let apiKey: string;
  let otherAppKey: string;

  const asAdmin = () => ({ Authorization: `Bearer ${admin.accessToken}` });
  const withKey = (key = apiKey) => ({ 'X-API-Key': key });

  async function dropOwned(): Promise<void> {
    await dataSource
      .getRepository(TranslationModule)
      .delete({ slug: In(OWNED_GLOBAL_SLUGS) });
    await dataSource
      .getRepository(LocalizationApp)
      .delete({ slug: In(OWNED_APP_SLUGS) });
  }

  async function createEntry(
    key: string,
    inModule: string,
  ): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post(`/api/modules/${inModule}/entries`)
      .set(asAdmin())
      .send({ key })
      .expect(201);

    return body.data.id;
  }

  /** Writes a value and, unless told otherwise, publishes it. */
  async function write(
    entryId: string,
    localeCode: string,
    value: string,
    publish = true,
  ): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .put(`/api/entries/${entryId}/translations/${localeCode}`)
      .set(asAdmin())
      .send({ value })
      .expect(200);

    if (publish) {
      await request(app.getHttpServer())
        .post(`/api/translations/${body.data.id}/publish`)
        .set(asAdmin())
        .expect(200);
    }

    return body.data.id;
  }

  async function bundleOf(localeCode: string, queryString = '') {
    const { body } = await request(app.getHttpServer())
      .get(`/api/v1/apps/e2e-runtime/locales/${localeCode}${queryString}`)
      .set(withKey())
      .expect(200);

    return body.data;
  }

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    await dropOwned();
    admin = await signInAs(app, 'admin');

    const { body: created } = await request(app.getHttpServer())
      .post('/api/apps')
      .set(asAdmin())
      .send({
        name: 'E2E runtime',
        slug: 'e2e-runtime',
        defaultLocaleCode: 'ar',
      })
      .expect(201);
    appId = created.data.id;

    await request(app.getHttpServer())
      .post(`/api/apps/${appId}/locales/en/enable`)
      .set(asAdmin())
      .expect(200);

    // `ar` falls back to `en`, so a key with no Arabic still resolves.
    await request(app.getHttpServer())
      .patch(`/api/apps/${appId}/locales/ar/fallback`)
      .set(asAdmin())
      .send({ fallbackLocaleCode: 'en' })
      .expect(200);

    const { body: appModule } = await request(app.getHttpServer())
      .post(`/api/apps/${appId}/modules`)
      .set(asAdmin())
      .send({ name: 'Checkout', slug: 'checkout' })
      .expect(201);
    moduleId = appModule.data.id;

    const { body: globalModule } = await request(app.getHttpServer())
      .post('/api/modules/global')
      .set(asAdmin())
      .send({ name: 'Shared', slug: 'e2e-runtime-shared' })
      .expect(201);
    globalModuleId = globalModule.data.id;

    // A second global namespace that no app module shadows, so "global content
    // disappeared" is distinguishable from "an app module happens to share the
    // slug".
    const { body: globalOnly } = await request(app.getHttpServer())
      .post('/api/modules/global')
      .set(asAdmin())
      .send({ name: 'Global only', slug: 'e2e-runtime-global-only' })
      .expect(201);
    globalOnlyModuleId = globalOnly.data.id;

    const { body: key } = await request(app.getHttpServer())
      .post(`/api/apps/${appId}/api-keys`)
      .set(asAdmin())
      .send({ name: 'runtime e2e' })
      .expect(201);
    apiKey = key.data.key;

    // A second app with its own key, for the cross-app 403.
    const { body: other } = await request(app.getHttpServer())
      .post('/api/apps')
      .set(asAdmin())
      .send({
        name: 'E2E runtime other',
        slug: 'e2e-runtime-other',
        defaultLocaleCode: 'ar',
      })
      .expect(201);

    const { body: otherKey } = await request(app.getHttpServer())
      .post(`/api/apps/${other.data.id}/api-keys`)
      .set(asAdmin())
      .send({ name: 'other app key' })
      .expect(201);
    otherAppKey = otherKey.data.key;
  });

  afterAll(async () => {
    await dropOwned();
    await deleteTestUsers(app, [admin.id]);
    await app.close();
  });

  describe('authentication', () => {
    it('401s with no credential at all', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/apps/e2e-runtime/locales/ar')
        .expect(401);
    });

    it('401s for a key that does not exist', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/apps/e2e-runtime/locales/ar')
        .set(withKey('cms_deadbeef.not-a-real-secret'))
        .expect(401);
    });

    it('401s once the key is revoked', async () => {
      const { body: created } = await request(app.getHttpServer())
        .post(`/api/apps/${appId}/api-keys`)
        .set(asAdmin())
        .send({ name: 'short lived' })
        .expect(201);

      await request(app.getHttpServer())
        .get('/api/v1/apps/e2e-runtime/locales/ar')
        .set(withKey(created.data.key))
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/api-keys/${created.data.id}`)
        .set(asAdmin())
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/apps/e2e-runtime/locales/ar')
        .set(withKey(created.data.key))
        .expect(401);
    });

    it('403s a key issued for another app', async () => {
      // 403, not 401: the credential is valid, it just is not valid *here*.
      await request(app.getHttpServer())
        .get('/api/v1/apps/e2e-runtime/locales/ar')
        .set(withKey(otherAppKey))
        .expect(403);
    });

    it('does not accept a CMS session token', async () => {
      // The runtime routes authenticate differently, not more loosely — a
      // bearer token carries no `X-API-Key`.
      await request(app.getHttpServer())
        .get('/api/v1/apps/e2e-runtime/locales/ar')
        .set(asAdmin())
        .expect(401);
    });

    it('is not reachable without the version segment', async () => {
      await request(app.getHttpServer())
        .get('/api/apps/e2e-runtime/locales/ar')
        .set(withKey())
        .expect(404);
    });
  });

  describe('published values only', () => {
    beforeAll(async () => {
      const publishedEntry = await createEntry('checkout.title', moduleId);
      await write(publishedEntry, 'ar', 'إتمام الشراء');

      const draftEntry = await createEntry('checkout.secret', moduleId);
      await write(draftEntry, 'ar', 'نص غير منشور', false);
    });

    it('omits a draft value from the bundle', async () => {
      const data = await bundleOf('ar');

      expect(data.bundle.checkout['checkout.title']).toBe('إتمام الشراء');
      expect(data.bundle.checkout['checkout.secret']).toBeUndefined();
    });

    it('omits an archived value from the bundle', async () => {
      const entryId = await createEntry('checkout.retired', moduleId);
      const valueId = await write(entryId, 'ar', 'نص قديم');

      expect((await bundleOf('ar')).bundle.checkout['checkout.retired']).toBe(
        'نص قديم',
      );

      await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/archive`)
        .set(asAdmin())
        .expect(200);

      expect(
        (await bundleOf('ar')).bundle.checkout['checkout.retired'],
      ).toBeUndefined();
    });
  });

  describe('resolution order', () => {
    it('falls back to the configured locale for a key with no Arabic', async () => {
      const entryId = await createEntry('checkout.english_only', moduleId);
      await write(entryId, 'en', 'English only');

      const data = await bundleOf('ar');

      expect(data.bundle.checkout['checkout.english_only']).toBe(
        'English only',
      );
    });

    it('prefers the requested locale over the fallback', async () => {
      const entryId = await createEntry('checkout.both', moduleId);
      await write(entryId, 'en', 'English');
      await write(entryId, 'ar', 'عربي');

      expect((await bundleOf('ar')).bundle.checkout['checkout.both']).toBe(
        'عربي',
      );
    });

    it('lets an app entry override a global entry with the same module slug and key', async () => {
      // Two namespaces can share a slug — `uq_modules_app_slug` and
      // `uq_modules_global_slug` are separate partial indexes precisely so they
      // can. The app's copy is the one that ships (invariant Rule 5).
      const { body: shadow } = await request(app.getHttpServer())
        .post(`/api/apps/${appId}/modules`)
        .set(asAdmin())
        .send({ name: 'Shared override', slug: 'e2e-runtime-shared' })
        .expect(201);

      const globalEntry = await createEntry('greeting', globalModuleId);
      await write(globalEntry, 'ar', 'تحية عامة');

      const appEntry = await createEntry('greeting', shadow.data.id);
      await write(appEntry, 'ar', 'تحية التطبيق');

      const data = await bundleOf('ar');

      expect(data.bundle['e2e-runtime-shared'].greeting).toBe('تحية التطبيق');
    });

    it('omits a key with nothing published in any language', async () => {
      await createEntry('checkout.never_written', moduleId);

      const data = await bundleOf('ar');

      // Step 4 of RESOLUTION_ORDER is an absence, not a self-referential entry.
      expect(data.bundle.checkout['checkout.never_written']).toBeUndefined();
    });
  });

  describe('includeGlobal', () => {
    beforeAll(async () => {
      const entryId = await createEntry('shared_notice', globalOnlyModuleId);
      await write(entryId, 'ar', 'إشعار مشترك');
    });

    it('includes global namespaces by default', async () => {
      const data = await bundleOf('ar');

      expect(data.bundle['e2e-runtime-global-only'].shared_notice).toBe(
        'إشعار مشترك',
      );
    });

    it('omits them entirely when false', async () => {
      const data = await bundleOf('ar', '?includeGlobal=false');

      expect(data.bundle.checkout).toBeDefined();
      // The string 'false' must not coerce to true — the reason
      // `enableImplicitConversion` is off.
      expect(data.bundle['e2e-runtime-global-only']).toBeUndefined();
    });
  });

  describe('response shape', () => {
    it('uses the same envelope as the rest of the API', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/v1/apps/e2e-runtime/locales/ar')
        .set(withKey())
        .expect(200);

      /**
       * Keeping the envelope here was a decision, not an accident: it is what
       * lets the dashboard's preview call these endpoints with the same axios
       * interceptor as everything else. The 304 below is the case that pushed
       * against it, and Express strips that body on its own.
       */
      expect(body).toMatchObject({
        statusCode: 200,
        message: null,
        data: {
          appSlug: 'e2e-runtime',
          localeCode: 'ar',
          releaseId: expect.any(String),
          bundle: expect.any(Object),
        },
      });
    });
  });

  describe('caching', () => {
    it('sends an ETag and Cache-Control', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/apps/e2e-runtime/locales/ar')
        .set(withKey())
        .expect(200);

      expect(response.headers.etag).toBe(`"${response.body.data.releaseId}"`);
      expect(response.headers['cache-control']).toMatch(
        /public, max-age=\d+, stale-while-revalidate=300/,
      );
    });

    it('304s on a matching If-None-Match, with no body', async () => {
      const first = await request(app.getHttpServer())
        .get('/api/v1/apps/e2e-runtime/locales/ar')
        .set(withKey())
        .expect(200);

      const second = await request(app.getHttpServer())
        .get('/api/v1/apps/e2e-runtime/locales/ar')
        .set(withKey())
        .set('If-None-Match', first.headers.etag)
        .expect(304);

      expect(second.text).toBeFalsy();
      expect(second.body).toEqual({});
    });

    it('changes the releaseId when anything is published', async () => {
      const before = (await bundleOf('ar')).releaseId;

      const entryId = await createEntry('checkout.fresh', moduleId);
      await write(entryId, 'ar', 'جديد');

      expect((await bundleOf('ar')).releaseId).not.toBe(before);
    });

    it('changes the releaseId when live copy is corrected', async () => {
      // Editing a published value keeps it published and leaves `published_at`
      // alone (B6), so a published_at digest would not move here.
      const entryId = await createEntry('checkout.typo', moduleId);
      await write(entryId, 'ar', 'نص بخطأ');

      const before = (await bundleOf('ar')).releaseId;

      await request(app.getHttpServer())
        .put(`/api/entries/${entryId}/translations/ar`)
        .set(asAdmin())
        .send({ value: 'نص مصحح' })
        .expect(200);

      const after = await bundleOf('ar');
      expect(after.releaseId).not.toBe(before);
      expect(after.bundle.checkout['checkout.typo']).toBe('نص مصحح');
    });
  });

  describe('single module', () => {
    it('returns only that namespace', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/v1/apps/e2e-runtime/locales/ar/modules/checkout')
        .set(withKey())
        .expect(200);

      expect(Object.keys(body.data.bundle)).toEqual(['checkout']);
    });

    it('404s for a slug that names nothing', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/apps/e2e-runtime/locales/ar/modules/not-a-module')
        .set(withKey())
        .expect(404);
    });
  });

  describe('locales', () => {
    it('lists the languages the app serves', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/v1/apps/e2e-runtime/locales')
        .set(withKey())
        .expect(200);

      expect(body.data.defaultLocaleCode).toBe('ar');
      expect(
        body.data.locales.map((locale: { code: string }) => locale.code).sort(),
      ).toEqual(['ar', 'en']);

      const arabic = body.data.locales.find(
        (locale: { code: string }) => locale.code === 'ar',
      );
      // The client needs `dir` before it has fetched a single string.
      expect(arabic).toMatchObject({
        direction: 'rtl',
        isDefault: true,
        fallbackLocaleCode: 'en',
      });
    });
  });

  describe('not found', () => {
    it('404s for an unknown app slug and an unserved locale', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/apps/no-such-app/locales/ar')
        .set(withKey())
        .expect(404);

      await request(app.getHttpServer())
        .get('/api/v1/apps/e2e-runtime/locales/fr')
        .set(withKey())
        .expect(404);
    });
  });
});
