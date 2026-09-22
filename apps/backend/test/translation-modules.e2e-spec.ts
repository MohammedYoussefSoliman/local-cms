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

const OWNED_APP_SLUGS = ['e2e-mod-a', 'e2e-mod-b'];
/** Global modules belong to no app, so nothing cascades them away. */
const OWNED_GLOBAL_SLUGS = ['e2e-global-auth', 'e2e-global-errors'];

describe('Translation modules (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let admin: TestUser;
  let editor: TestUser;
  let appAId: string;
  let appBId: string;

  const asAdmin = () => ({ Authorization: `Bearer ${admin.accessToken}` });
  const asEditor = () => ({ Authorization: `Bearer ${editor.accessToken}` });

  async function dropOwned(): Promise<void> {
    // App-scoped modules go with their app (ON DELETE CASCADE); global ones
    // have to be named explicitly.
    await dataSource
      .getRepository(TranslationModule)
      .delete({ slug: In(OWNED_GLOBAL_SLUGS) });
    await dataSource
      .getRepository(LocalizationApp)
      .delete({ slug: In(OWNED_APP_SLUGS) });
  }

  async function createApp(slug: string): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post('/api/apps')
      .set(asAdmin())
      .send({ name: `E2E ${slug}`, slug, defaultLocaleCode: 'en' })
      .expect(201);

    return body.data.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    await dropOwned();

    admin = await signInAs(app, 'admin');
    editor = await signInAs(app, 'editor');

    appAId = await createApp('e2e-mod-a');
    appBId = await createApp('e2e-mod-b');
  });

  afterAll(async () => {
    await dropOwned();
    await deleteTestUsers(app, [admin.id, editor.id]);
    await app.close();
  });

  /**
   * One un-tokened request per endpoint, not one for the surface. A single 401
   * only proves the global `JwtAuthGuard` is registered at all — it would still
   * pass if a later change put `@Public()` on one of these routes, which is the
   * failure this sweep exists to catch (auth Rule 2).
   *
   * The id routes use a well-formed UUID that matches nothing: the guard runs
   * before the handler, so the 401 arrives whether or not the row exists.
   */
  describe('authentication', () => {
    const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

    it.each([
      ['GET /apps/:appId/modules', (): string => `/api/apps/${appAId}/modules`, 'get'],
      ['POST /apps/:appId/modules', (): string => `/api/apps/${appAId}/modules`, 'post'],
      ['GET /modules/global', (): string => '/api/modules/global', 'get'],
      ['POST /modules/global', (): string => '/api/modules/global', 'post'],
      ['GET /modules/:id', (): string => `/api/modules/${UNKNOWN_ID}`, 'get'],
      ['PATCH /modules/:id', (): string => `/api/modules/${UNKNOWN_ID}`, 'patch'],
    ] as const)('rejects %s without a token', async (_name, path, method) => {
      await request(app.getHttpServer())[method](path()).expect(401);
    });
  });

  describe('app-scoped modules', () => {
    it('gives a non-admin 403 on create, not 401', async () => {
      await request(app.getHttpServer())
        .post(`/api/apps/${appAId}/modules`)
        .set(asEditor())
        .send({ name: 'Products', slug: 'products' })
        .expect(403);
    });

    it('sets scope and appId from the route, never from the body', async () => {
      const { body } = await request(app.getHttpServer())
        .post(`/api/apps/${appAId}/modules`)
        .set(asAdmin())
        .send({ name: 'Products', slug: 'products' })
        .expect(201);

      expect(body.data).toMatchObject({
        appId: appAId,
        scope: 'app',
        slug: 'products',
        description: null,
      });
    });

    it('rejects a scope in the body with 400', async () => {
      // Rule 2 is enforced by the field's absence from the DTO plus
      // `forbidNonWhitelisted` — the body can never describe a pair that
      // `ck_modules_scope_app_id` would have to reject.
      await request(app.getHttpServer())
        .post(`/api/apps/${appAId}/modules`)
        .set(asAdmin())
        .send({ name: 'Sneaky', slug: 'sneaky', scope: 'global' })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/apps/${appAId}/modules`)
        .set(asAdmin())
        .send({ name: 'Sneaky', slug: 'sneaky', appId: null })
        .expect(400);
    });

    it('refuses a second `products` in the same app with 409', async () => {
      await request(app.getHttpServer())
        .post(`/api/apps/${appAId}/modules`)
        .set(asAdmin())
        .send({ name: 'Products again', slug: 'products' })
        .expect(409);
    });

    it('allows the same slug in a different app', async () => {
      // The namespace is per app. This is the case `uq_modules_app_slug` has to
      // permit while still refusing the duplicate above.
      const { body } = await request(app.getHttpServer())
        .post(`/api/apps/${appBId}/modules`)
        .set(asAdmin())
        .send({ name: 'Products', slug: 'products' })
        .expect(201);

      expect(body.data).toMatchObject({ appId: appBId, slug: 'products' });
    });

    it('lists only the modules of the app in the path', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/api/apps/${appAId}/modules`)
        .set(asEditor())
        .expect(200);

      expect(body.data.meta).toMatchObject({ page: 1, limit: 20, total: 1 });
      expect(body.data.records[0]).toMatchObject({
        appId: appAId,
        slug: 'products',
      });
    });

    it('keeps a search scoped to the app', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/api/apps/${appBId}/modules?search=product`)
        .set(asEditor())
        .expect(200);

      const appIds = body.data.records.map(
        (row: { appId: string }) => row.appId,
      );
      expect(appIds).toEqual([appBId]);
    });

    it('404s for an app that does not exist', async () => {
      await request(app.getHttpServer())
        .get('/api/apps/00000000-0000-4000-8000-000000000000/modules')
        .set(asAdmin())
        .expect(404);
    });
  });

  describe('global modules', () => {
    it('gives a non-admin 403 on create', async () => {
      await request(app.getHttpServer())
        .post('/api/modules/global')
        .set(asEditor())
        .send({ name: 'Auth', slug: 'e2e-global-auth' })
        .expect(403);
    });

    it('creates a global module with a null appId', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/modules/global')
        .set(asAdmin())
        .send({ name: 'Authentication', slug: 'e2e-global-auth' })
        .expect(201);

      expect(body.data).toMatchObject({
        appId: null,
        scope: 'global',
        slug: 'e2e-global-auth',
      });
    });

    it('refuses a second global module with the same slug with 409', async () => {
      // The one a plain `UNIQUE (app_id, slug)` would have allowed: in Postgres
      // NULL is distinct from NULL, so every global row would have looked
      // unique. `uq_modules_global_slug` is partial on `scope = 'global'`.
      await request(app.getHttpServer())
        .post('/api/modules/global')
        .set(asAdmin())
        .send({ name: 'Authentication again', slug: 'e2e-global-auth' })
        .expect(409);
    });

    it('allows an app module to reuse a global slug', async () => {
      const { body } = await request(app.getHttpServer())
        .post(`/api/apps/${appAId}/modules`)
        .set(asAdmin())
        .send({ name: 'Local auth', slug: 'e2e-global-auth' })
        .expect(201);

      // App and global namespaces do not collide — the runtime resolves an app
      // entry before a global one (invariant Rule 5), which only works if both
      // can exist.
      expect(body.data).toMatchObject({ appId: appAId, scope: 'app' });
    });

    it('lists global modules, and the list excludes app-scoped ones', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/modules/global?search=e2e-global')
        .set(asEditor())
        .expect(200);

      const scopes = body.data.records.map(
        (row: { scope: string }) => row.scope,
      );
      expect(scopes).not.toHaveLength(0);
      expect(new Set(scopes)).toEqual(new Set(['global']));
    });

    it('matches /modules/global ahead of /modules/:id', async () => {
      // Declaration order in the controller is what makes this work; were it
      // reversed, `global` would be parsed as an id and 400 on the UUID pipe.
      await request(app.getHttpServer())
        .get('/api/modules/global')
        .set(asAdmin())
        .expect(200);
    });
  });

  describe('by id', () => {
    let moduleId: string;

    beforeAll(async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/api/apps/${appBId}/modules`)
        .set(asAdmin())
        .expect(200);
      moduleId = body.data.records[0].id;
    });

    it('reads either scope by id', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/api/modules/${moduleId}`)
        .set(asEditor())
        .expect(200);

      expect(body.data).toMatchObject({ id: moduleId, scope: 'app' });
    });

    it('gives a non-admin 403 on update', async () => {
      await request(app.getHttpServer())
        .patch(`/api/modules/${moduleId}`)
        .set(asEditor())
        .send({ name: 'Renamed' })
        .expect(403);
    });

    it('rejects a slug or a scope in the body with 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/modules/${moduleId}`)
        .set(asAdmin())
        .send({ slug: 'renamed' })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/api/modules/${moduleId}`)
        .set(asAdmin())
        .send({ scope: 'global' })
        .expect(400);
    });

    it('updates the name and leaves slug and scope alone', async () => {
      const { body } = await request(app.getHttpServer())
        .patch(`/api/modules/${moduleId}`)
        .set(asAdmin())
        .send({ name: 'Product catalogue' })
        .expect(200);

      expect(body.data).toMatchObject({
        name: 'Product catalogue',
        slug: 'products',
        scope: 'app',
        appId: appBId,
      });
    });

    it('404s on an unknown id and 400s on a non-uuid', async () => {
      await request(app.getHttpServer())
        .get('/api/modules/00000000-0000-4000-8000-000000000000')
        .set(asAdmin())
        .expect(404);

      await request(app.getHttpServer())
        .get('/api/modules/not-a-uuid')
        .set(asAdmin())
        .expect(400);
    });
  });
});
